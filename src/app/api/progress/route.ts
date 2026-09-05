import { prisma } from "@/lib/db";
import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { progressMap } from "@/lib/server/progress-service";

export async function GET(req: Request) {
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  return Response.json(await progressMap(me.id), { headers: { "Cache-Control": "no-store" } });
}

/** Borra todo el progreso del usuario (Ajustes → borrar progreso). */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  await prisma.$transaction([
    prisma.exerciseProgress.deleteMany({ where: { userId: me.id } }),
    prisma.dailyActivity.deleteMany({ where: { userId: me.id } }),
  ]);
  return new Response(null, { status: 204 });
}
