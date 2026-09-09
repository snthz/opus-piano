import { prisma } from "@/lib/db";
import { isScoreId, readStream } from "@/lib/server/score-files";
import { SHARED_WHERE } from "@/lib/server/scores-service";

type Ctx = { params: Promise<{ id: string }> };

/** El archivo de una partitura compartida, tal cual lo subió su dueño. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isScoreId(id)) return Response.json({ error: "No existe" }, { status: 404 });
  const row = await prisma.score.findFirst({ where: { id, ...SHARED_WHERE } });
  const stream = row ? await readStream(row.userId, id, "file") : null;
  if (!row || !stream) return Response.json({ error: "No existe o ya no está compartida" }, { status: 404 });
  return new Response(stream, {
    headers: {
      "Content-Type": row.kind === "pdf" ? "application/pdf" : "application/vnd.recordare.musicxml+xml",
      "Content-Length": String(row.size),
      "Cache-Control": "public, max-age=300",
    },
  });
}
