// evaluated per request: key and model come from env, not the build
export const dynamic = "force-dynamic";

import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { rateLimited } from "@/lib/server/rate-limit";
import { generatePlan, planEnabled, planLimit, planModel, PlanError } from "@/lib/server/study-plan";
import { dedupeGoalIds, MAX_PAGES, planRequestSchema, studyPlanSchema } from "@/lib/study-plan";

/**
 * Study plan for a score. The browser renders the PDF pages and posts them
 * here with what it knows about the piece; this server forwards it to Claude
 * with its own API key and returns the validated plan.
 *
 * The response streams NDJSON lines like `/api/omr`, since preparing a plan
 * takes a minute or two and a silent request that long gets cut by some
 * proxy along the way. Errors before the stream starts (session, limit,
 * data) are normal responses with a status code.
 */

/** A page rendered at 1568 px is ~300 KB as PNG; this leaves margin. */
const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

/** How often a heartbeat is sent while the model works. */
const HEARTBEAT_MS = 10_000;

/** So the app knows whether to offer the option and how many plans fit per day. */
export function GET() {
  return Response.json({ enabled: planEnabled(), perDay: planLimit().max }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  if (!planEnabled()) return Response.json({ error: "El plan de estudio con IA no está disponible en este servidor." }, { status: 503 });

  // requires an account: the server pays for each plan
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

  // closing the tab mid-plan is normal (it takes minutes); once the client
  // disconnects, stop sending and clear the heartbeat
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
            console.error("study-plan: unexpected failure", e);
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
      // stop any proxy from buffering lines and eating heartbeats
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
 * The API's strict schema already enforces shape, but not that linked
 * lessons exist or that goal ids are unique — checked here before the plan
 * gets saved.
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
