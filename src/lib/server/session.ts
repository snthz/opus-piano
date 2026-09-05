import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Sesiones guardadas en la base de datos. El navegador recibe un token aleatorio
 * en una cookie HttpOnly; en la tabla solo se guarda su SHA-256, así una copia de
 * la base de datos no sirve para suplantar a nadie.
 */
export const COOKIE = "opus_session";
const DAYS = 90;
export const SESSION_MS = DAYS * 24 * 60 * 60 * 1000;
/** Si a la sesión le queda menos de esto, se alarga al usarla. */
const RENEW_BEFORE_MS = SESSION_MS / 2;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  /** false si entró solo con Google y nunca puso contraseña */
  hasPassword: boolean;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

export async function createSession(userId: string, userAgent?: string | null): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt, userAgent: userAgent?.slice(0, 200) ?? null },
  });
  return { token, expiresAt };
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Cabecera Set-Cookie. `Secure` solo fuera de desarrollo, para que funcione en http://localhost. */
export function sessionCookie(token: string, expiresAt: Date): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${secure}`;
}

export function clearedCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Usuario de la sesión de la cookie, o null. Alarga la sesión si está a punto de caducar. */
export async function userFromRequest(req: Request): Promise<(SessionUser & { sessionId: string }) | null> {
  const token = readCookie(req, COOKIE);
  if (!token || !/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, createdAt: true, passwordHash: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.expiresAt.getTime() - Date.now() < RENEW_BEFORE_MS) {
    await prisma.session
      .update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() + SESSION_MS) } })
      .catch(() => {});
  }
  const { passwordHash, ...user } = session.user;
  return { ...user, hasPassword: !!passwordHash, sessionId: session.id };
}

export async function destroySession(req: Request): Promise<void> {
  const token = readCookie(req, COOKIE);
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Limpieza ocasional de sesiones caducadas (se llama al iniciar sesión). */
export async function pruneSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
}
