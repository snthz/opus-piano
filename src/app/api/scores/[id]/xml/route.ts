import { prisma } from "@/lib/db";
import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { MAX_XML_BYTES, TooLargeError, isScoreId, quotaBytes, readStream, removeFile, writeUpload } from "@/lib/server/score-files";
import { toMeta, usedBytes } from "@/lib/server/scores-service";

type Ctx = { params: Promise<{ id: string }> };

async function own(req: Request, id: string) {
  const me = await userFromRequest(req);
  if (!me) return { me: null, row: null };
  const row = isScoreId(id) ? await prisma.score.findFirst({ where: { id, userId: me.id } }) : null;
  return { me, row };
}

/** MusicXML vinculado a un PDF (para escucharlo). */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { me, row } = await own(req, id);
  if (!me) return unauthorized();
  const stream = row && row.xmlSize > 0 ? await readStream(me.id, id, "xml") : null;
  if (!row || !stream) return Response.json({ error: "No existe" }, { status: 404 });
  return new Response(stream, {
    headers: { "Content-Type": "application/vnd.recordare.musicxml+xml", "Content-Length": String(row.xmlSize), "Cache-Control": "private, no-store" },
  });
}

export async function PUT(req: Request, ctx: Ctx) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const { id } = await ctx.params;
  const { me, row } = await own(req, id);
  if (!me) return unauthorized();
  if (!row) return Response.json({ error: "No existe" }, { status: 404 });
  const used = (await usedBytes(me.id)) - row.xmlSize;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (used + declared > quotaBytes()) return Response.json({ error: "Has llenado el espacio de tu biblioteca" }, { status: 507 });
  try {
    const xmlSize = await writeUpload(me.id, id, "xml", req.body, Math.min(MAX_XML_BYTES, quotaBytes() - used));
    const updated = await prisma.score.update({ where: { id }, data: { xmlSize } });
    return Response.json(toMeta(updated));
  } catch (e) {
    if (e instanceof TooLargeError) return Response.json({ error: "El MusicXML es demasiado grande" }, { status: 413 });
    throw e;
  }
}

/** Desvincular el MusicXML. */
export async function DELETE(req: Request, ctx: Ctx) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const { id } = await ctx.params;
  const { me, row } = await own(req, id);
  if (!me) return unauthorized();
  if (!row) return Response.json({ error: "No existe" }, { status: 404 });
  await removeFile(me.id, id, "xml"); // el archivo principal se conserva
  const updated = await prisma.score.update({ where: { id }, data: { xmlSize: 0 } });
  return Response.json(toMeta(updated));
}
