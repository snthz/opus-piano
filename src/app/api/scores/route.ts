import { prisma } from "@/lib/db";
import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { quotaBytes } from "@/lib/server/score-files";
import { scoreCreateSchema, toMeta, usedBytes } from "@/lib/server/scores-service";
import { readJson } from "@/lib/server/user-json";
import { firstIssue } from "@/lib/validation";

/** Biblioteca del usuario: metadatos de todas sus partituras (sin archivos). */
export async function GET(req: Request) {
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  const rows = await prisma.score.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" } });
  return Response.json(
    { scores: rows.map(toMeta), used: await usedBytes(me.id), quota: quotaBytes() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Paso 1 de la subida: los metadatos. El archivo va después a PUT /api/scores/:id/file. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  const parsed = scoreCreateSchema.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed) }, { status: 400 });
  const d = parsed.data;

  const existing = await prisma.score.findUnique({ where: { id: d.id } });
  if (existing && existing.userId !== me.id) return Response.json({ error: "Id en uso" }, { status: 409 });

  const data = {
    name: d.name,
    kind: d.kind,
    notes: d.notes,
    pageCount: d.pageCount,
    thumbnail: d.thumbnail,
    annotations: d.annotations ?? undefined,
    plan: d.plan ?? undefined,
    updatedAt: BigInt(d.updatedAt),
  };
  const row = existing
    ? await prisma.score.update({ where: { id: d.id }, data })
    : await prisma.score.create({
        data: { id: d.id, userId: me.id, ...data, createdAt: d.createdAt ? new Date(d.createdAt) : undefined },
      });
  return Response.json(toMeta(row), { status: existing ? 200 : 201 });
}
