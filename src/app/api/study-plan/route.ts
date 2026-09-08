// Se evalúa en cada petición: la clave y el modelo llegan por entorno, no en el build.
export const dynamic = "force-dynamic";

import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { rateLimited } from "@/lib/server/rate-limit";
import { generatePlan, planEnabled, planLimit, planModel, PlanError } from "@/lib/server/study-plan";
import { dedupeGoalIds, MAX_PAGES, planRequestSchema, studyPlanSchema } from "@/lib/study-plan";

/**
 * Plan de estudio de una partitura. El navegador dibuja las páginas del PDF y
 * las manda aquí con lo que sabe de la pieza; este servidor se lo pasa a Claude
 * con su propia clave de API y devuelve el plan ya validado.
 *
 * La respuesta es un flujo de líneas JSON en vez de una sola respuesta al
 * final, como en `/api/omr`: preparar un plan lleva uno o dos minutos y una
 * petición HTTP que se pasa ese rato callada la corta cualquier proxy por el
 * camino. Cada línea es un objeto:
 *
 *   {"type":"working","seconds":30}
 *   {"type":"done","plan":{…},"model":"claude-sonnet-5"}
 *   {"type":"error","message":"…"}
 *
 * Los errores de antes de empezar (sesión, límite, datos) sí son respuestas
 * normales con su código de estado.
 */

/** Una página dibujada a 1568 px pesa unos 300 KB en PNG; aquí se deja margen. */
const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

/** Cada cuánto se manda señal de vida mientras el modelo trabaja. */
const HEARTBEAT_MS = 10_000;

/** Para que la aplicación sepa si ofrecer la opción y cuántos planes caben al día. */
export function GET() {
  return Response.json({ enabled: planEnabled(), perDay: planLimit().max }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  if (!planEnabled()) return Response.json({ error: "El plan de estudio con IA no está disponible en este servidor." }, { status: 503 });

  // Con cuenta: cada plan lo paga el servidor, así que hay a quién contárselo.
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  const limit = planLimit();
  if (rateLimited(`plan:${me.id}`, Date.now(), limit)) {
    return Response.json({ error: `Has llegado al límite de ${limit.max} planes al día. Vuelve mañana.` }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const parsed = planRequestSchema.safeParse(json(form?.get("data")));
  if (!parsed.success) return Response.json({ error: "Faltan datos para preparar el plan" }, { status: 400 });

  const files = (form?.getAll("page") ?? []).filter((p): p is File => p instanceof File && p.size > 0);
  if (files.length > MAX_PAGES) return Response.json({ error: `Como mucho se pueden enviar ${MAX_PAGES} páginas` }, { status: 400 });
  if (files.some((f) => f.size > MAX_PAGE_BYTES) || files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) {
    return Response.json({ error: "Las páginas de la partitura pesan demasiado" }, { status: 413 });
  }
  const pages = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer()).toString("base64")));

  const started = Date.now();
  const encoder = new TextEncoder();

  // Cerrar la pestaña a mitad de un plan es lo normal —son minutos—, así que el
  // flujo tiene que sobrevivir a que el destinatario se vaya: en cuanto eso
  // pasa se deja de escribir y se para el latido.
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

      generatePlan(parsed.data, pages, req.signal)
        .then((text) => send({ type: "done", plan: validate(text), model: planModel() }))
        .catch((e: unknown) => {
          if (req.signal.aborted) return;
          if (e instanceof PlanError) send({ type: "error", message: e.message });
          else {
            console.error("study-plan: fallo inesperado", e);
            send({ type: "error", message: "No se ha podido preparar el plan. Vuelve a intentarlo." });
          }
        })
        .finally(() => {
          const wasOpen = open;
          finish();
          if (!wasOpen) return;
          try {
            controller.close();
          } catch {
            // Ya lo había cerrado el propio servidor al irse el navegador.
          }
        });
    },
    // Lo llama el servidor cuando el navegador se desconecta.
    cancel: finish,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Que nadie por el camino junte las líneas y se coma las señales de vida.
      "X-Accel-Buffering": "no",
      "Content-Encoding": "identity",
    },
  });
}

function json(value: FormDataEntryValue | null | undefined): unknown {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

/**
 * El esquema estricto de la API ya obliga a la forma, pero no a que las
 * lecciones enlazadas existan ni a que los objetivos tengan ids distintos: eso
 * se comprueba aquí antes de que el plan llegue a guardarse.
 */
function validate(text: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new PlanError("El profesor no ha devuelto un plan legible. Vuelve a intentarlo.");
  }
  const plan = studyPlanSchema.safeParse(raw);
  if (!plan.success) throw new PlanError("El plan recibido no tiene el formato esperado. Vuelve a intentarlo.");
  return dedupeGoalIds(plan.data);
}
