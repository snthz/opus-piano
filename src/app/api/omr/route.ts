// evaluated per request: OMR_URL comes from env, not the build
export const dynamic = "force-dynamic";

import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { OmrError, omrEnabled, omrLimit, recognisePage } from "@/lib/server/omr";
import { rateLimited } from "@/lib/server/rate-limit";

/**
 * Recognizes one score page; the browser renders the PDF page and posts it
 * here, then this server forwards it to the OMR service.
 *
 * The response streams NDJSON lines (e.g. {"type":"working","seconds":30})
 * instead of one final response, since recognition takes minutes and a
 * silent request that long gets cut by some proxy along the way. Errors
 * before the stream starts (session, limit, file) are normal responses with
 * a status code.
 */

/** One page's image; the service caps at 10 MB, this leaves margin. */
const MAX_PAGE_BYTES = 12 * 1024 * 1024;

/** How often a heartbeat is sent while the service works. */
const HEARTBEAT_MS = 10_000;

/** So the app knows whether to offer the option. */
export function GET() {
  return Response.json({ enabled: omrEnabled() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  if (!omrEnabled()) return Response.json({ error: "El reconocimiento de partituras no está disponible en este servidor." }, { status: 503 });

  // requires an account: recognition spends real CPU that the server pays for, same as `/api/study-plan`
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  if (rateLimited(`omr:${me.id}`, Date.now(), omrLimit())) {
    return Response.json({ error: `Has llegado al límite de ${omrLimit().max} páginas por hora. Prueba más tarde.` }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0) return Response.json({ error: "Falta la imagen de la página" }, { status: 400 });
  if (file.size > MAX_PAGE_BYTES) return Response.json({ error: "La imagen de la página es demasiado grande" }, { status: 413 });

  const started = Date.now();
  const encoder = new TextEncoder();

  // closing the tab mid-recognition is normal (it takes minutes); once the
  // client disconnects, stop sending and clear the heartbeat
  let open = true;
  let beat: ReturnType<typeof setInterval> | undefined;
  const finish = () => {
    open = false;
    clearInterval(beat);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (line: object) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
        } catch {
          finish();
        }
      };

      beat = setInterval(() => send({ type: "working", seconds: Math.round((Date.now() - started) / 1000) }), HEARTBEAT_MS);
      send({ type: "working", seconds: 0 });

      recognisePage(file, req.signal)
        .then((page) => send({ type: "done", musicxml: page.musicxml, seconds: page.seconds }))
        .catch((e: unknown) => {
          if (req.signal.aborted) return;
          if (e instanceof OmrError) send({ type: "error", code: e.code, message: e.message });
          else {
            console.error("omr: unexpected failure", e);
            send({ type: "error", code: "INTERNAL", message: "No se ha podido reconocer la partitura." });
          }
        })
        .finally(() => {
          const wasOpen = open;
          finish();
          if (!wasOpen) return;
          try {
            controller.close();
          } catch {
            // already closed by the runtime when the browser left
          }
        });
    },
    // called by the runtime when the browser disconnects
    cancel: finish,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // stop any proxy or compression from buffering lines and eating heartbeats
      "X-Accel-Buffering": "no",
      "Content-Encoding": "identity",
    },
  });
}
