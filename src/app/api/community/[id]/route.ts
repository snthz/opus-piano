export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { isScoreId } from "@/lib/server/score-files";
import { SHARED_WHERE, toSharedMeta } from "@/lib/server/scores-service";

type Ctx = { params: Promise<{ id: string }> };

/** Ficha pública de una partitura compartida (por enlace o en la lista). Privada = no existe. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isScoreId(id)) return Response.json({ error: "No existe" }, { status: 404 });
  const row = await prisma.score.findFirst({ where: { id, ...SHARED_WHERE }, include: { user: { select: { name: true } } } });
  if (!row) return Response.json({ error: "No existe o ya no está compartida" }, { status: 404 });
  return Response.json(toSharedMeta(row), { headers: { "Cache-Control": "public, max-age=60" } });
}
