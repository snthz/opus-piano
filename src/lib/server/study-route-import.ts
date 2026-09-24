import { generateJson, PlanError, type UsageSink } from "@/lib/server/study-plan";
import { importedRouteSchema, importInstructions, ROUTE_IMPORT_SCHEMA, type ImportedRoute } from "@/lib/study-route";

/**
 * Reads a study plan written as text (pasted, or pulled out of a PDF) and
 * returns it as a route. Same key, same budget and same error messages as
 * the study plan (`study-plan.ts`); only the prompt and the schema differ.
 */
export async function importRoute(text: string, signal?: AbortSignal, onUsage?: UsageSink): Promise<ImportedRoute> {
  const raw = await generateJson(
    {
      system: importInstructions(),
      content: [{ type: "text", text: `Plan de estudio:\n\n${text}` }],
      schema: ROUTE_IMPORT_SCHEMA,
      truncated: "El plan es demasiado largo para leerlo entero. Pega solo la parte de las piezas, la rutina y los objetivos.",
      empty: "No se ha podido leer el plan. Vuelve a intentarlo.",
    },
    signal,
    onUsage,
  );
  let json: unknown;
  try {
    json = JSON.parse(raw) as unknown;
  } catch {
    throw new PlanError("La lectura del plan no ha devuelto un resultado legible. Vuelve a intentarlo.");
  }
  const parsed = importedRouteSchema.safeParse(json);
  if (!parsed.success) throw new PlanError("El plan leído no tiene el formato esperado. Vuelve a intentarlo.");
  return parsed.data;
}
