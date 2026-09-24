"use client";

import { readNdjson } from "@/lib/ndjson";
import { postStream } from "@/lib/plan/client";
import { dayKey } from "@/lib/agenda";
import { importedRouteSchema, routeFromImport, type StudyRoute } from "@/lib/study-route";
import { UserError } from "@/lib/user-error";

/**
 * Browser side of the route import: posts the plan's text to
 * `/api/routes/import` and turns the answer into a route ready to save.
 * Whether the server offers it at all is the same question as for the study
 * plan (`planService()` in `plan/client.ts`).
 */
export async function importRouteFromText(text: string, opts: { onStatus?: (text: string) => void; signal?: AbortSignal } = {}): Promise<StudyRoute> {
  opts.onStatus?.("Leyendo el plan… suele tardar menos de un minuto.");
  const res = await postStream("/api/routes/import", { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }, opts.signal);

  let done: unknown = null;
  let failure: string | null = null;
  await readNdjson(res, (event) => {
    if (event.type === "done") done = event.route;
    else if (event.type === "error") failure = typeof event.message === "string" ? event.message : "No se ha podido leer el plan.";
  });
  if (failure) throw new UserError(failure);
  if (!done) throw new UserError("La lectura se ha cortado antes de terminar. Vuelve a intentarlo.");

  const parsed = importedRouteSchema.safeParse(done);
  if (!parsed.success) throw new UserError("El plan leído no tiene el formato esperado. Vuelve a intentarlo.");
  return routeFromImport(parsed.data, dayKey(new Date()));
}
