import { z } from "zod";
import { prisma } from "@/lib/db";
import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { readJson } from "@/lib/server/user-json";
import { studyRouteSchema } from "@/lib/study-route";
import { firstIssue } from "@/lib/validation";

/**
 * Study routes of the account. The document travels whole (`studyRouteSchema`);
 * the device sets `updatedAt` and the newest version wins, as with the scores.
 */

type Row = NonNullable<Awaited<ReturnType<typeof prisma.studyRoute.findFirst>>>;

export const toRouteMeta = (r: Row) => ({ id: r.id, data: r.data, updatedAt: Number(r.updatedAt), createdAt: r.createdAt.getTime() });

const upsertSchema = z.object({
  id: z.string().min(1).max(64),
  data: studyRouteSchema,
  updatedAt: z.number().int().positive(),
});

export async function GET(req: Request) {
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  const rows = await prisma.studyRoute.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" } });
  return Response.json({ routes: rows.map(toRouteMeta) }, { headers: { "Cache-Control": "no-store" } });
}

/** Creates or replaces a route. An older version than the one stored is ignored, and the stored one comes back. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  const parsed = upsertSchema.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed) }, { status: 400 });
  const d = parsed.data;
  if (d.data.id !== d.id) return Response.json({ error: "El id de la ruta no coincide" }, { status: 400 });

  const existing = await prisma.studyRoute.findUnique({ where: { id: d.id } });
  if (existing && existing.userId !== me.id) return Response.json({ error: "Id en uso" }, { status: 409 });
  if (existing && existing.updatedAt > BigInt(d.updatedAt)) return Response.json(toRouteMeta(existing));

  const data = { name: d.data.name, data: d.data, updatedAt: BigInt(d.updatedAt) };
  const row = existing
    ? await prisma.studyRoute.update({ where: { id: d.id }, data })
    : await prisma.studyRoute.create({ data: { id: d.id, userId: me.id, ...data, createdAt: new Date(d.data.createdAt) } });
  return Response.json(toRouteMeta(row), { status: existing ? 200 : 201 });
}
