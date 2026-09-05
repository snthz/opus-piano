import { Google, decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { prisma } from "@/lib/db";
import { readCookie } from "@/lib/server/session";

/**
 * Inicio de sesión con Google (OAuth 2 / OpenID Connect) usando `arctic`, que
 * solo construye las URL y canjea el código: sin sesiones propias ni base de
 * datos aparte. La identidad se vincula al usuario por el `sub` del proveedor; si
 * el correo ya tiene cuenta, se vincula a esa cuenta en vez de crear otra.
 * Si faltan las credenciales, el botón no aparece.
 */
export type Provider = "google";
export const PROVIDERS: Provider[] = ["google"];

/** URL pública de la app, para construir la URL de retorno que se registra en Google. */
export function appUrl(req?: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (!req) return "http://localhost:3000";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const callbackUrl = (provider: Provider, req?: Request) => `${appUrl(req)}/api/auth/oauth/${provider}/callback`;

/** Qué proveedores tienen credenciales configuradas; la interfaz solo muestra esos botones. */
export function enabledProviders(): Record<Provider, boolean> {
  return {
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  };
}

export function isProvider(x: string): x is Provider {
  return (PROVIDERS as string[]).includes(x);
}

function google(req: Request) {
  return new Google(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!, callbackUrl("google", req));
}

/* ---------- Cookie de estado (protege el intercambio contra CSRF) ---------- */

const STATE_COOKIE = "opus_oauth";
const STATE_MAX_AGE = 10 * 60; // segundos

export interface OAuthState {
  state: string;
  /** PKCE */
  verifier: string;
  /** A dónde volver después de entrar */
  returnTo: string;
}

export function stateCookie(value: OAuthState): string {
  const encoded = encodeURIComponent(JSON.stringify(value));
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${STATE_COOKIE}=${encoded}; Path=/api/auth/oauth; HttpOnly; SameSite=Lax${secure}; Max-Age=${STATE_MAX_AGE}`;
}

export const clearedStateCookie = () => `${STATE_COOKIE}=; Path=/api/auth/oauth; HttpOnly; Max-Age=0`;

export function readState(req: Request): OAuthState | null {
  const raw = readCookie(req, STATE_COOKIE);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as OAuthState;
    return typeof v.state === "string" && typeof v.verifier === "string" && typeof v.returnTo === "string" ? v : null;
  } catch {
    return null;
  }
}

/** Solo rutas internas: evita redirecciones abiertas a otros sitios. */
export function safeReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/api/")) return "/";
  return raw;
}

/* ---------- Paso 1: URL de autorización ---------- */

export function authorizationUrl(req: Request, returnTo: string): { url: URL; cookie: string } {
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = google(req).createAuthorizationURL(state, verifier, ["openid", "email", "profile"]);
  return { url, cookie: stateCookie({ state, verifier, returnTo }) };
}

/* ---------- Paso 2: canjear el código y obtener la identidad ---------- */

export interface Identity {
  provider: Provider;
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

interface IdClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
  family_name?: string;
}

export async function exchangeCode(req: Request, code: string, saved: OAuthState): Promise<Identity> {
  const tokens = await google(req).validateAuthorizationCode(code, saved.verifier);
  // El id_token llega directamente de Google por TLS, por eso basta con decodificarlo.
  const claims = decodeIdToken(tokens.idToken()) as IdClaims;
  if (!claims.sub || !claims.email) throw new Error("Google no ha devuelto el correo.");
  const name = claims.name ?? [claims.given_name, claims.family_name].filter(Boolean).join(" ");
  return {
    provider: "google",
    providerAccountId: claims.sub,
    email: claims.email.trim().toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: name || null,
  };
}

/* ---------- Paso 3: usuario de la base de datos ---------- */

/**
 * Devuelve el usuario vinculado a esa identidad; si no existe, vincula la
 * identidad a la cuenta con el mismo correo (solo si el proveedor lo ha
 * verificado) o crea una cuenta nueva sin contraseña.
 */
export async function findOrCreateOAuthUser(id: Identity): Promise<{ id: string; email: string; name: string }> {
  const linked = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: id.provider, providerAccountId: id.providerAccountId } },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (linked) return linked.user;

  const existing = await prisma.user.findUnique({ where: { email: id.email }, select: { id: true, email: true, name: true } });
  if (existing) {
    if (!id.emailVerified) throw new Error("Ese correo ya tiene cuenta; entra con tu contraseña.");
    await prisma.oAuthAccount.create({ data: { provider: id.provider, providerAccountId: id.providerAccountId, userId: existing.id } });
    return existing;
  }

  const name = id.name?.slice(0, 60) || id.email.split("@")[0]!.slice(0, 60);
  const user = await prisma.user.create({
    data: {
      email: id.email,
      name,
      accounts: { create: { provider: id.provider, providerAccountId: id.providerAccountId } },
    },
    select: { id: true, email: true, name: true },
  });
  return user;
}
