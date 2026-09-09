export const dynamic = "force-dynamic";

import { unauthorized, userFromRequest } from "@/lib/server/auth";
import { transcriptionPages } from "@/lib/server/transcriptions";

/**
 * El MusicXML de cada página reconocida. El montaje final (unir las páginas,
 * comprobar los compases) lo hace el navegador, que ya sabe hacerlo para
 * cualquier partitura y así el servidor no necesita un DOM.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const pages = await transcriptionPages(me.id, id);
  if (!pages) return Response.json({ error: "No existe" }, { status: 404 });
  return Response.json({ pages }, { headers: { "Cache-Control": "no-store" } });
}
