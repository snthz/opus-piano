export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { SHARED_WHERE, toSharedMeta } from "@/lib/server/scores-service";

/** Cuántas caben en la lista: la comunidad es pequeña y una página basta. */
const LIMIT = 100;

/**
 * Las partituras que sus dueños han puesto en público, de la más reciente a
 * la más antigua. Sin cuenta: es la escaparate. Las compartidas «por enlace»
 * no salen aquí; se abren con su dirección.
 */
export async function GET() {
  const rows = await prisma.score.findMany({
    where: { ...SHARED_WHERE, visibility: "public" },
    orderBy: [{ sharedAt: "desc" }, { createdAt: "desc" }],
    take: LIMIT,
    include: { user: { select: { name: true } } },
  });
  return Response.json({ scores: rows.map(toSharedMeta) }, { headers: { "Cache-Control": "public, max-age=60" } });
}
