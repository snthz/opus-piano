import { prisma } from "@/lib/db";
import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { MAX_FILE_BYTES, TooLargeError, isScoreId, quotaBytes, readStream, writeUpload } from "@/lib/server/score-files";
import { toMeta, usedBytes } from "@/lib/server/scores-service";

type Ctx = { params: Promise<{ id: string }> };

/** Descarga del archivo principal (PDF o MusicXML), en streaming desde disco. */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  if (!isScoreId(id)) return Response.json({ error: "No existe" }, { status: 404 });
  const row = await prisma.score.findFirst({ where: { id, userId: me.id } });
  const stream = row?.uploaded ? await readStream(me.id, id, "file") : null;
  if (!row || !stream) return Response.json({ error: "No existe" }, { status: 404 });
  return new Response(stream, {
    headers: {
      "Content-Type": row.kind === "pdf" ? "application/pdf" : "application/vnd.recordare.musicxml+xml",
      "Content-Length": String(row.size),
      "Cache-Control": "private, no-store",
    },
  });
}

/** Paso 2 de la subida: el archivo en crudo como cuerpo de la petición. */
export async function PUT(req: Request, ctx: Ctx) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const { id } = await ctx.params;
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  if (!isScoreId(id)) return Response.json({ error: "No existe" }, { status: 404 });
  const row = await prisma.score.findFirst({ where: { id, userId: me.id } });
  if (!row) return Response.json({ error: "No existe" }, { status: 404 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_FILE_BYTES) return Response.json({ error: "El archivo supera los 25 MB" }, { status: 413 });
  const used = (await usedBytes(me.id)) - row.size;
  if (used + declared > quotaBytes()) return Response.json({ error: "Has llenado el espacio de tu biblioteca" }, { status: 507 });

  try {
    const size = await writeUpload(me.id, id, "file", req.body, Math.min(MAX_FILE_BYTES, quotaBytes() - used));
    if (!size) return Response.json({ error: "Archivo vacío" }, { status: 400 });
    const updated = await prisma.score.update({ where: { id }, data: { size, uploaded: true } });
    return Response.json(toMeta(updated));
  } catch (e) {
    if (e instanceof TooLargeError) return Response.json({ error: "El archivo es demasiado grande" }, { status: 413 });
    throw e;
  }
}
