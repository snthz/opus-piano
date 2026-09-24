import { prisma } from "@/lib/db";
import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { toRouteMeta } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  const row = await prisma.studyRoute.findFirst({ where: { id, userId: me.id } });
  if (!row) return Response.json({ error: "No existe" }, { status: 404 });
  return Response.json(toRouteMeta(row), { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request, ctx: Ctx) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const { id } = await ctx.params;
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  await prisma.studyRoute.deleteMany({ where: { id, userId: me.id } });
  return new Response(null, { status: 204 });
}
