import { prisma } from "@/lib/db";
import { sameOrigin } from "@/lib/server/auth";
import { verifyPassword } from "@/lib/server/password";
import { clearRateLimit, clientIp, rateLimited } from "@/lib/server/rate-limit";
import { createSession, pruneSessions, sessionCookie } from "@/lib/server/session";
import { publicUser, readJson } from "@/lib/server/user-json";
import { loginSchema } from "@/lib/validation";

const invalid = () => Response.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const parsed = loginSchema.safeParse(await readJson(req));
  if (!parsed.success) return invalid();
  const { email, password } = parsed.data;

  const key = `login:${clientIp(req)}:${email}`;
  if (rateLimited(key)) return Response.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });

  const user = await prisma.user.findUnique({ where: { email } });
  // Se comprueba siempre un hash para que el tiempo de respuesta no delate si el correo existe.
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) return invalid();

  clearRateLimit(key);
  void pruneSessions();
  const { token, expiresAt } = await createSession(user.id, req.headers.get("user-agent"));
  return Response.json(publicUser(user), { headers: { "Set-Cookie": sessionCookie(token, expiresAt) } });
}

const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
