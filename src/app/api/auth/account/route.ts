import { prisma } from "@/lib/db";
import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { verifyPassword } from "@/lib/server/password";
import { clearedCookie } from "@/lib/server/session";
import { readJson } from "@/lib/server/user-json";
import { removeUserDir } from "@/lib/server/score-files";
import { deleteAccountSchema } from "@/lib/validation";

/** Borra la cuenta y todo su progreso. Pide la contraseña para confirmar (si la cuenta tiene una; con Google puede no tenerla). */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  const parsed = deleteAccountSchema.safeParse((await readJson(req)) ?? {});
  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user || !parsed.success) return Response.json({ error: "Petición no válida." }, { status: 400 });
  if (user.passwordHash && !(await verifyPassword(parsed.data.password ?? "", user.passwordHash))) {
    return Response.json({ error: "Contraseña incorrecta." }, { status: 403 });
  }
  // Sesiones, progreso y partituras caen en cascada; los archivos se borran del disco.
  await prisma.user.delete({ where: { id: me.id } });
  await removeUserDir(me.id);
  return new Response(null, { status: 204, headers: { "Set-Cookie": clearedCookie() } });
}
