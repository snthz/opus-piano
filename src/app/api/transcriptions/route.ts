// evaluada en cada petición: OMR_URL viene del entorno, no del build
export const dynamic = "force-dynamic";

import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { omrEnabled, omrLimit } from "@/lib/server/omr";
import { rateLimited } from "@/lib/server/rate-limit";
import { hasUnfinished, listTranscriptions, startTranscription } from "@/lib/server/transcriptions";
import { MAX_PAGE_BYTES } from "@/lib/server/transcription-files";
import { MAX_OMR_PAGES } from "@/lib/omr/shared";
import { isScoreId } from "@/lib/server/score-files";

/**
 * Los reconocimientos de partitura de quien pregunta.
 *
 * El navegador renderiza las páginas del PDF y las manda aquí de una vez; a
 * partir de ese momento el trabajo es del servidor y el navegador solo
 * pregunta cómo va. Puede cerrar la pestaña: al volver, `GET` le dice qué
 * hay en marcha y qué está listo para recoger.
 */

const disabled = () =>
  Response.json({ error: "El reconocimiento de partituras no está disponible en este servidor." }, { status: 503 });

export async function GET(req: Request) {
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  return Response.json({ jobs: await listTranscriptions(me.id) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  if (!omrEnabled()) return disabled();

  // requiere cuenta: reconocer gasta CPU de verdad que paga el servidor, igual que `/api/study-plan`
  const me = await userFromRequest(req);
  if (!me) return unauthorized();

  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Petición mal formada" }, { status: 400 });

  const scoreId = String(form.get("scoreId") ?? "");
  const scoreName = String(form.get("scoreName") ?? "").trim().slice(0, 200);
  const fromPage = Number(form.get("fromPage") ?? 1);
  if (!isScoreId(scoreId)) return Response.json({ error: "Partitura no válida" }, { status: 400 });
  if (!scoreName) return Response.json({ error: "Falta el nombre de la partitura" }, { status: 400 });

  const files = form.getAll("pages").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return Response.json({ error: "No has enviado ninguna página" }, { status: 400 });
  if (files.length > MAX_OMR_PAGES) {
    return Response.json({ error: `Se reconocen ${MAX_OMR_PAGES} páginas como mucho de una vez.` }, { status: 400 });
  }
  if (files.some((f) => f.size > MAX_PAGE_BYTES)) {
    return Response.json({ error: "Alguna página pesa demasiado" }, { status: 413 });
  }

  // uno cada vez: el servicio de reconocimiento atiende una partitura a la vez
  if (await hasUnfinished(me.id)) {
    return Response.json({ error: "Ya tienes una partitura en la cola. Espera a que acabe o cancélala." }, { status: 409 });
  }

  const now = Date.now();
  const limit = omrLimit();
  for (let i = 0; i < files.length; i++) {
    if (rateLimited(`omr:${me.id}`, now, limit)) {
      return Response.json({ error: `Has llegado al límite de ${limit.max} páginas por hora. Prueba más tarde.` }, { status: 429 });
    }
  }

  const images = await Promise.all(files.map(async (f) => new Uint8Array(await f.arrayBuffer())));

  try {
    const job = await startTranscription({
      userId: me.id,
      scoreId,
      scoreName,
      fromPage: Number.isFinite(fromPage) && fromPage > 0 ? Math.trunc(fromPage) : 1,
      images,
    });
    return Response.json({ job }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("transcriptions: no se ha podido encargar", e);
    return Response.json({ error: "No se ha podido empezar el reconocimiento." }, { status: 500 });
  }
}
