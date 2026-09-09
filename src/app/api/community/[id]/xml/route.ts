import { prisma } from "@/lib/db";
import { isScoreId, readStream } from "@/lib/server/score-files";
import { SHARED_WHERE } from "@/lib/server/scores-service";

type Ctx = { params: Promise<{ id: string }> };

/** El MusicXML vinculado a un PDF compartido, para que también suene fuera de la biblioteca de su dueño. */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!isScoreId(id)) return Response.json({ error: "No existe" }, { status: 404 });
  const row = await prisma.score.findFirst({ where: { id, ...SHARED_WHERE } });
  const stream = row && row.xmlSize > 0 ? await readStream(row.userId, id, "xml") : null;
  if (!row || !stream) return Response.json({ error: "No existe" }, { status: 404 });
  return new Response(stream, {
    headers: { "Content-Type": "application/vnd.recordare.musicxml+xml", "Content-Length": String(row.xmlSize), "Cache-Control": "public, max-age=300" },
  });
}
