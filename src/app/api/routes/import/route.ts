// evaluated per request: key and model come from env, not the build
export const dynamic = "force-dynamic";

import { sameOrigin, unauthorized, userFromRequest } from "@/lib/server/auth";
import { budgetExhausted, BUDGET_MESSAGE, overCallLimit, readUsage, recordCall } from "@/lib/server/ai-budget";
import { ndjsonJob } from "@/lib/server/ndjson-job";
import { planEnabled, planModel, PlanError, routeImportLimit } from "@/lib/server/study-plan";
import { importRoute } from "@/lib/server/study-route-import";
import { readJson } from "@/lib/server/user-json";
import { importRequestSchema } from "@/lib/study-route";
import { firstIssue } from "@/lib/validation";

/**
 * Turns a study plan written as text into a route. The browser sends the
 * text (pasted, or extracted from a PDF); the model reads it with the
 * server's key and the validated route comes back as the `done` line.
 * Nothing is saved here: the device keeps the route and syncs it like the rest.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Origen no permitido" }, { status: 403 });
  if (!planEnabled()) return Response.json({ error: "La lectura de planes con IA no está disponible en este servidor." }, { status: 503 });

  const me = await userFromRequest(req);
  if (!me) return unauthorized();
  const limit = routeImportLimit();
  if (await overCallLimit(me.id, "route-import", limit)) {
    return Response.json({ error: `Has llegado al límite de ${limit.max} planes leídos al día. Vuelve mañana.` }, { status: 429 });
  }
  if (await budgetExhausted()) return Response.json({ error: BUDGET_MESSAGE }, { status: 503 });

  const parsed = importRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed) }, { status: 400 });

  const spent = { usage: null as ReturnType<typeof readUsage> | null };
  return ndjsonJob({
    signal: req.signal,
    run: async (signal) => ({ route: await importRoute(parsed.data.text, signal, (u) => (spent.usage = readUsage(u))) }),
    after: async () => {
      if (spent.usage) await recordCall({ userId: me.id, kind: "route-import", model: planModel(), usage: spent.usage });
    },
    userFacing: (e): e is PlanError => e instanceof PlanError,
    fallback: "No se ha podido leer el plan. Vuelve a intentarlo.",
  });
}
