import { prisma } from "@/lib/db";
import { sameOrigin } from "@/lib/server/auth";
import { hashPassword } from "@/lib/server/password";
import { clientIp, rateLimited } from "@/lib/server/rate-limit";
import { createSession, sessionCookie } from "@/lib/server/session";
import { publicUser, readJson } from "@/lib/server/user-json";
import { firstIssue, registerSchema } from "@/lib/validation";

/** Crea la cuenta e inicia sesión en el mismo paso. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  if (rateLimited(`register:${clientIp(req)}`)) {
    return Response.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
  }

  const parsed = registerSchema.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed) }, { status: 400 });
  const { name, email, password } = parsed.data;

  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await prisma.user.create({ data: { email, name, passwordHash } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return Response.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
    }
    throw e;
  }

  const { token, expiresAt } = await createSession(user.id, req.headers.get("user-agent"));
  return Response.json(publicUser(user), { status: 201, headers: { "Set-Cookie": sessionCookie(token, expiresAt) } });
}
