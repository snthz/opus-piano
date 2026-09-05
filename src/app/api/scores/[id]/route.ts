import { prisma } from "@/lib/db";
import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { isScoreId, removeFiles } from "@/lib/server/score-files";
import { scorePatchSchema, toMeta } from "@/lib/server/scores-service";
import { readJson } from "@/lib/server/user-json";
import { firstIssue } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

async function own(req: Request, id: string) {
  const me = await userFromRequest(req);
  if (!me) return { me: null, row: null };
  if (!isScoreId(id)) return { me, row: null };
  const row = await prisma.score.findFirst({ where: { id, userId: me.id } });
  return { me, row };
}

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { me, row } = await own(req, id);
  if (!me) return unauthorized();
  if (!row) return Response.json({ error: "No existe" }, { status: 404 });
  return Response.json(toMeta(row), { headers: { "Cache-Control": "no-store" } });
}

/** Nombre, notas y trazos. `updatedAt` lo pone el dispositivo; gana el más reciente. */
export async function PATCH(req: Request, ctx: Ctx) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const { id } = await ctx.params;
  const { me, row } = await own(req, id);
  if (!me) return unauthorized();
  if (!row) return Response.json({ error: "No existe" }, { status: 404 });
  const parsed = scorePatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed) }, { status: 400 });
  const d = parsed.data;
  if (BigInt(d.updatedAt) < row.updatedAt) return Response.json(toMeta(row)); // el servidor tiene algo más nuevo
  const updated = await prisma.score.update({
    where: { id },
    data: {
      name: d.name,
      notes: d.notes,
      // null = borrar trazos; undefined = no tocar
      annotations: d.annotations === null ? { set: null } : d.annotations,
      updatedAt: BigInt(d.updatedAt),
    },
  });
  return Response.json(toMeta(updated));
}

export async function DELETE(req: Request, ctx: Ctx) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const { id } = await ctx.params;
  const { me, row } = await own(req, id);
  if (!me) return unauthorized();
  if (row) {
    await prisma.score.delete({ where: { id } });
    await removeFiles(me.id, id);
  }
  return new Response(null, { status: 204 });
}
