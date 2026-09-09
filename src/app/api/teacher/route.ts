export const dynamic = "force-dynamic";

import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { budgetExhausted, BUDGET_MESSAGE, overCallLimit, readUsage, recordCall } from "@/lib/server/ai-budget";
import { askLimit, planEnabled, planModel, PlanError } from "@/lib/server/study-plan";
import { askGeneralTeacher } from "@/lib/server/teacher";
import { teacherRequestSchema } from "@/lib/teacher";

/**
 * El profesor general: preguntas de música que no van sobre ninguna partitura
 * concreta. Mismo trato que `/api/study-plan/ask` —cuenta obligatoria, el
 * mismo límite por hora y el mismo techo de gasto— y la misma respuesta en
 * líneas NDJSON, que llegan según las escribe el modelo:
 *
 *   {"type":"delta","text":"La armadura te dice"}
 *   {"type":"error","message":"…"}
 *
 * Comparte cupo con las preguntas sobre una partitura (`kind: "ask"`): para
 * el bolsillo del servidor son la misma llamada.
 */
export async function GET() {
  const enabled = planEnabled() && !(await budgetExhausted());
  return Response.json({ enabled }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  if (!planEnabled()) return Response.json({ error: "El profesor no está disponible en este servidor." }, { status: 503 });

  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  const limit = askLimit();
  if (await overCallLimit(me.id, "ask", limit)) {
    return Response.json({ error: `Has llegado al límite de ${limit.max} preguntas por hora. Prueba más tarde.` }, { status: 429 });
  }
  if (await budgetExhausted()) return Response.json({ error: BUDGET_MESSAGE }, { status: 503 });

  const parsed = teacherRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "La pregunta no tiene el formato esperado" }, { status: 400 });

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

      const spent = { usage: null as ReturnType<typeof readUsage> | null };
      try {
        for await (const text of askGeneralTeacher(parsed.data, req.signal, (u) => (spent.usage = readUsage(u)))) {
          send({ type: "delta", text });
        }
      } catch (e) {
        if (!req.signal.aborted) {
          if (e instanceof PlanError) send({ type: "error", message: e.message });
          else {
            console.error("teacher: fallo inesperado", e);
            send({ type: "error", message: "No se ha podido obtener respuesta. Vuelve a intentarlo." });
          }
        }
      }
      if (spent.usage) await recordCall({ userId: me.id, kind: "ask", model: planModel(), usage: spent.usage });
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
