export const dynamic = "force-dynamic";

import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { rateLimited } from "@/lib/server/rate-limit";
import { askLimit, askTeacher, planEnabled, PlanError } from "@/lib/server/study-plan";
import { askRequestSchema } from "@/lib/study-plan";

/**
 * Preguntas al profesor sobre el plan ya hecho. Igual que `/api/study-plan`,
 * pero la respuesta llega palabra a palabra según la escribe el modelo, así que
 * las líneas JSON son trozos de texto:
 *
 *   {"type":"delta","text":"Empieza por la mano izquierda"}
 *   {"type":"error","message":"…"}
 *
 * El plan y el resumen de la partitura los manda el navegador, que es quien los
 * tiene: una partitura puede no estar sincronizada con la cuenta.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  if (!planEnabled()) return Response.json({ error: "El profesor no está disponible en este servidor." }, { status: 503 });

  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  const limit = askLimit();
  if (rateLimited(`plan-ask:${me.id}`, Date.now(), limit)) {
    return Response.json({ error: `Has llegado al límite de ${limit.max} preguntas por hora. Prueba más tarde.` }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = askRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "La pregunta no tiene el formato esperado" }, { status: 400 });
  const { history, ...ctx } = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (line: object) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
        } catch {
          open = false;
        }
      };
      try {
        for await (const text of askTeacher(ctx, history, req.signal)) send({ type: "delta", text });
      } catch (e) {
        if (!req.signal.aborted) {
          if (e instanceof PlanError) send({ type: "error", message: e.message });
          else {
            console.error("study-plan/ask: fallo inesperado", e);
            send({ type: "error", message: "No se ha podido obtener respuesta. Vuelve a intentarlo." });
          }
        }
      }
      open = false;
      try {
        controller.close();
      } catch {
        // El navegador ya se había ido.
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "identity",
    },
  });
}
