export const dynamic = "force-dynamic";

import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { getTranscription, removeTranscription } from "@/lib/server/transcriptions";

/**
 * Cómo va un reconocimiento, y cómo se para.
 *
 * `DELETE` es lo mismo para las dos cosas que puede querer el usuario:
 * cancelar lo que está en marcha y quitar de en medio lo que ya ha recogido.
 * En ambos casos se borra la fila y las páginas: un reconocimiento es un
 * encargo, no un historial.
 */

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const job = await getTranscription(me.id, id);
  if (!job) return Response.json({ error: "No existe" }, { status: 404 });
  return Response.json({ job }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request, { params }: Params) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;
  const removed = await removeTranscription(me.id, id);
  if (!removed) return Response.json({ error: "No existe" }, { status: 404 });
  return Response.json({ ok: true });
}
