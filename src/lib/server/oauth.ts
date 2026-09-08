import { Google, decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { prisma } from "@/lib/db";
import { readCookie } from "@/lib/server/session";

/**
 * Google sign-in (OAuth 2 / OpenID Connect) via `arctic`, which only builds
 * URLs and exchanges the code — no sessions or separate DB of its own.
 * Identity links to a user by the provider's `sub`; an existing email links
 * to that account instead of creating a new one. No credentials, no button.
 */
export type Provider = "google";
export const PROVIDERS: Provider[] = ["google"];

/** App's public URL, for building the callback URL registered with Google. */
export function appUrl(req?: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (!req) return "http://localhost:3000";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const callbackUrl = (provider: Provider, req?: Request) => `${appUrl(req)}/api/auth/oauth/${provider}/callback`;

/** Which providers have credentials configured; the UI only shows those buttons. */
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

/* ---------- State cookie (protects the exchange against CSRF) ---------- */

const STATE_COOKIE = "opus_oauth";
const STATE_MAX_AGE = 10 * 60; // seconds

export interface OAuthState {
  state: string;
  /** PKCE */
  verifier: string;
  /** Where to return after signing in. */
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

/** Internal routes only: prevents open redirects to other sites. */
export function safeReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/api/")) return "/";
  return raw;
}

/* ---------- Step 1: authorization URL ---------- */

export function authorizationUrl(req: Request, returnTo: string): { url: URL; cookie: string } {
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = google(req).createAuthorizationURL(state, verifier, ["openid", "email", "profile"]);
  return { url, cookie: stateCookie({ state, verifier, returnTo }) };
}

/* ---------- Step 2: exchange the code and get the identity ---------- */

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
  // id_token comes straight from Google over TLS, so decoding it is enough
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

/* ---------- Step 3: database user ---------- */

/**
 * Returns the user linked to that identity; if none exists, links it to the
 * account with the same email (only if the provider verified it) or creates
 * a new passwordless account.
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
