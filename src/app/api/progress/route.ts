import { prisma } from "@/lib/db";
import { profileFromRequest, unauthorized } from "@/lib/server/auth";
import { progressMap } from "@/lib/server/progress-service";

export async function GET(req: Request) {
  const me = await profileFromRequest(req);
  if (!me) return unauthorized();
  return Response.json(await progressMap(me.id));
}

/** Borra todo el progreso del perfil (Ajustes → borrar progreso). */
export async function DELETE(req: Request) {
  const me = await profileFromRequest(req);
  if (!me) return unauthorized();
  await prisma.$transaction([
    prisma.exerciseProgress.deleteMany({ where: { profileId: me.id } }),
    prisma.dailyActivity.deleteMany({ where: { profileId: me.id } }),
  ]);
  return new Response(null, { status: 204 });
}
