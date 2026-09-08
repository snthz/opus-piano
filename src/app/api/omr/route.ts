// Se evalúa en cada petición: OMR_URL llega por entorno, no en el build.
export const dynamic = "force-dynamic";

import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { OmrError, omrEnabled, omrLimit, recognisePage } from "@/lib/server/omr";
import { rateLimited } from "@/lib/server/rate-limit";

/**
 * Reconocimiento de una página de partitura. El navegador dibuja la página del
 * PDF, la manda aquí y este servidor se la pasa al servicio de OMR.
 *
 * La respuesta es un flujo de líneas JSON en vez de una sola respuesta al
 * final. Reconocer una página lleva minutos, y una petición HTTP que se pasa
 * ese rato sin decir nada la corta cualquier proxy por el camino; además así el
 * usuario ve que aquello sigue vivo. Cada línea es un objeto:
 *
 *   {"type":"working","seconds":30}
 *   {"type":"done","musicxml":"…","seconds":58}
 *   {"type":"error","code":"EMPTY_SCORE","message":"…"}
 *
 * Los errores de antes de empezar (sesión, límite, archivo) sí son respuestas
 * normales con su código de estado.
 */

/** La imagen de una página; el servicio corta en 10 MB y aquí se deja margen. */
const MAX_PAGE_BYTES = 12 * 1024 * 1024;

/** Cada cuánto se manda señal de vida mientras el servicio trabaja. */
const HEARTBEAT_MS = 10_000;

/** Para que la aplicación sepa si ofrecer la opción. */
export function GET() {
  return Response.json({ enabled: omrEnabled() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  if (!omrEnabled()) return Response.json({ error: "El reconocimiento de partituras no está disponible en este servidor." }, { status: 503 });

  // Con cuenta: el reconocimiento gasta CPU de verdad y la paga el servidor,
  // no el usuario con su clave como en la transcripción con IA.
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

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const send = (line: object) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
        } catch {
          open = false; // el navegador ha cerrado: da igual, el finally limpia
        }
      };

      const beat = setInterval(() => send({ type: "working", seconds: Math.round((Date.now() - started) / 1000) }), HEARTBEAT_MS);
      send({ type: "working", seconds: 0 });

      recognisePage(file, req.signal)
        .then((page) => send({ type: "done", musicxml: page.musicxml, seconds: page.seconds }))
        .catch((e: unknown) => {
          if (req.signal.aborted) return;
          if (e instanceof OmrError) send({ type: "error", code: e.code, message: e.message });
          else {
            console.error("omr: fallo inesperado", e);
            send({ type: "error", code: "INTERNAL", message: "No se ha podido reconocer la partitura." });
          }
        })
        .finally(() => {
          clearInterval(beat);
          if (open) controller.close();
          open = false;
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Que nadie por el camino junte las líneas y se coma las señales de
      // vida: ni el proxy (X-Accel-Buffering) ni una compresión que se guarde
      // los trozos hasta llenar su búfer (Content-Encoding).
      "X-Accel-Buffering": "no",
      "Content-Encoding": "identity",
    },
  });
}
