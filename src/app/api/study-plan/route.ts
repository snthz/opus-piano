// evaluated per request: key and model come from env, not the build
export const dynamic = "force-dynamic";

import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { budgetExhausted, BUDGET_MESSAGE, overCallLimit, readUsage, recordCall } from "@/lib/server/ai-budget";
import { ndjsonJob } from "@/lib/server/ndjson-job";
import { generatePlan, planEnabled, planLimit, planModel, PlanError } from "@/lib/server/study-plan";
import { dedupeGoalIds, MAX_PAGES, planRequestSchema, studyPlanSchema } from "@/lib/study-plan";

/**
 * Study plan for a score. The browser renders the PDF pages and posts them
 * here with what it knows about the piece; this server forwards it to Claude
 * with its own API key and returns the validated plan.
 *
 * The response streams NDJSON lines (`ndjsonJob`), since preparing a plan
 * takes a minute or two and a silent request that long gets cut by some
 * proxy along the way. Errors before the stream starts (session, limit,
 * data) are normal responses with a status code.
 */

/** A page rendered at 1568 px is ~300 KB as PNG; this leaves margin. */
const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

/**
 * So the app knows whether to offer the option and how many plans fit per day.
 * A server that has run out of budget for the month reports itself as off:
 * better a hidden button than one that always answers with an error.
 */
export async function GET() {
  const enabled = planEnabled() && !(await budgetExhausted());
  return Response.json({ enabled, perDay: planLimit().max }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  if (!planEnabled()) return Response.json({ error: "El análisis con IA no está disponible en este servidor." }, { status: 503 });

  // requires an account: the server pays for each plan
  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  const limit = planLimit();
  if (await overCallLimit(me.id, "plan", limit)) {
    return Response.json({ error: `Has llegado al límite de ${limit.max} análisis al día. Vuelve mañana.` }, { status: 429 });
  }
  if (await budgetExhausted()) return Response.json({ error: BUDGET_MESSAGE }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const parsed = planRequestSchema.safeParse(json(form?.get("data")));
  if (!parsed.success) return Response.json({ error: "Faltan datos para analizar la partitura" }, { status: 400 });

  const files = (form?.getAll("page") ?? []).filter((p): p is File => p instanceof File && p.size > 0);
  if (files.length > MAX_PAGES) return Response.json({ error: `Como mucho se pueden enviar ${MAX_PAGES} páginas` }, { status: 400 });
  if (files.some((f) => f.size > MAX_PAGE_BYTES) || files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) {
    return Response.json({ error: "Las páginas de la partitura pesan demasiado" }, { status: 413 });
  }
  const pages = await Promise.all(files.map(async (f) => Buffer.from(await f.arrayBuffer()).toString("base64")));

  // A plan is billed whether or not it parses, so the receipt is written
  // from the callback rather than from a successful outcome.
  const spent = { usage: null as ReturnType<typeof readUsage> | null };
  return ndjsonJob({
    signal: req.signal,
    run: async (signal) => {
      const text = await generatePlan(parsed.data, pages, signal, (u) => (spent.usage = readUsage(u)));
      return { plan: validate(text), model: planModel() };
    },
    after: async () => {
      if (spent.usage) await recordCall({ userId: me.id, kind: "plan", model: planModel(), usage: spent.usage });
    },
    userFacing: (e): e is PlanError => e instanceof PlanError,
    fallback: "No se ha podido analizar la partitura. Vuelve a intentarlo.",
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
    throw new PlanError("El profesor no ha devuelto un análisis legible. Vuelve a intentarlo.");
  }
  const plan = studyPlanSchema.safeParse(raw);
  if (!plan.success) throw new PlanError("El análisis recibido no tiene el formato esperado. Vuelve a intentarlo.");
  return dedupeGoalIds(plan.data);
}
