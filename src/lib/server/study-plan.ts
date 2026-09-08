import Anthropic from "@anthropic-ai/sdk";
import { toJsonSchema } from "@/lib/plan/schema";
import {
  askInstructions,
  planInstructions,
  planUserMessage,
  STUDY_PLAN_SCHEMA,
  type AskContext,
  type ChatTurn,
  type PlanRequest,
} from "@/lib/study-plan";

/**
 * El profesor con IA de Opus Piano: Claude, llamado con la clave de API del
 * servidor. El alumno no pone nada de su parte —ni clave ni tarjeta—, así que
 * el gasto lo controla quien despliega con `PLANS_PER_DAY` y con el modelo que
 * elija en `STUDY_PLAN_MODEL`.
 *
 * Sin `ANTHROPIC_API_KEY` la función queda desactivada y la aplicación no
 * ofrece la opción, igual que pasa con el OMR sin `OMR_URL`.
 */

const HOUR = 60 * 60 * 1000;

const apiKey = () => (process.env.ANTHROPIC_API_KEY ?? "").trim();

export const planEnabled = () => !!apiKey();

/**
 * Sonnet lee bien una partitura escaneada y cuesta una fracción de lo que
 * cuesta Opus; Haiku es la mitad de caro pero se le escapan alteraciones y
 * figuras, que es justo lo que no puede fallar en un plan de estudio.
 */
const DEFAULT_MODEL = "claude-sonnet-5";

export const planModel = () => (process.env.STUDY_PLAN_MODEL || DEFAULT_MODEL).trim();

/** Planes por usuario y día. Cada uno son unos 10-15 céntimos de la cuenta del servidor. */
export const planLimit = () => ({ max: Number(process.env.PLANS_PER_DAY || 3), windowMs: 24 * HOUR });

/** Preguntas al profesor por usuario y hora: son baratas (sin imágenes), pero no infinitas. */
export const askLimit = () => ({ max: Number(process.env.PLAN_QUESTIONS_PER_HOUR || 40), windowMs: HOUR });

/**
 * Un plan tarda uno o dos minutos: siempre en streaming, porque una petición
 * HTTP muda tanto rato la corta cualquier proxy por el camino.
 *
 * Los topes van holgados aposta. No son el presupuesto —solo se paga lo que se
 * escribe, y lo condensado se pide en las instrucciones— sino el punto en el
 * que la respuesta se corta a medias, y ahí se ha pagado la petición entera
 * para tirarla. Cuentan también los tokens de razonamiento.
 */
const PLAN_MAX_TOKENS = 16_000;
const ASK_MAX_TOKENS = 4_000;

/** Mensaje ya escrito para el alumno; el detalle técnico se queda en el registro. */
export class PlanError extends Error {}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: apiKey() });
  return client;
}

/**
 * Traduce el fallo del proveedor. El alumno no puede arreglar ninguno de estos
 * —la clave y el saldo son del servidor—, así que lo único útil es decirle si
 * vale la pena volver a intentarlo.
 */
function translate(e: unknown): PlanError {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    console.error("study-plan: la clave de API del servidor no vale", e.message);
    return new PlanError("El profesor no está disponible ahora mismo. Avisa por el formulario de contacto si sigue así.");
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new PlanError("Hay demasiadas peticiones ahora mismo. Espera un par de minutos y vuelve a intentarlo.");
  }
  if (e instanceof Anthropic.APIError) {
    // 400 con «credit» es la cuenta sin saldo; 529 es el proveedor saturado.
    if (e.status === 529 || (e.status ?? 0) >= 500) return new PlanError("El profesor está saturado en este momento. Inténtalo en unos minutos.");
    console.error(`study-plan: la API ha devuelto ${e.status}`, e.message);
    return new PlanError("No se ha podido preparar el plan. Vuelve a intentarlo en un rato.");
  }
  console.error("study-plan: fallo inesperado", e);
  return new PlanError("No se ha podido preparar el plan. Vuelve a intentarlo en un rato.");
}

/** Lo que el modelo dejó de escribir por su cuenta: ninguno se arregla reintentando igual. */
function checkStop(stopReason: string | null | undefined, truncated: string) {
  if (stopReason === "refusal") throw new PlanError("El profesor no ha querido responder a esta petición.");
  if (stopReason === "max_tokens") throw new PlanError(truncated);
}

/**
 * Pide el plan y devuelve el JSON sin analizar (lo valida quien llama, con el
 * esquema de zod). Las páginas van como PNG en base64.
 */
export async function generatePlan(req: PlanRequest, pages: string[], signal?: AbortSignal): Promise<string> {
  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: planUserMessage(req) },
    ...pages.map((data): Anthropic.ContentBlockParam => ({ type: "image", source: { type: "base64", media_type: "image/png", data } })),
  ];

  let message: Anthropic.Message;
  try {
    const stream = anthropic().messages.stream(
      {
        model: planModel(),
        max_tokens: PLAN_MAX_TOKENS,
        system: planInstructions(req),
        messages: [{ role: "user", content }],
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: { type: "json_schema", schema: toJsonSchema(STUDY_PLAN_SCHEMA) } },
      },
      { signal },
    );
    message = await stream.finalMessage();
  } catch (e) {
    if (signal?.aborted) throw e; // lo ha cancelado el alumno: no es un fallo
    throw translate(e);
  }

  checkStop(message.stop_reason, "El plan se ha quedado sin espacio a mitad. Prueba con una partitura de menos páginas.");
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text.trim()) throw new PlanError("El profesor no ha devuelto ningún plan. Vuelve a intentarlo.");
  return text;
}

/**
 * Responde a una pregunta sobre el plan, trozo a trozo según lo va escribiendo
 * el modelo, para que el alumno vea la respuesta aparecer en vez de esperar.
 */
export async function* askTeacher(ctx: AskContext, history: ChatTurn[], signal?: AbortSignal): AsyncGenerator<string> {
  const stream = anthropic().messages.stream(
    {
      model: planModel(),
      max_tokens: ASK_MAX_TOKENS,
      system: askInstructions(ctx),
      messages: history.map((t) => ({ role: t.role, content: t.content })),
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
    },
    { signal },
  );

  try {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
    }
    // La respuesta ya se ha ido enviando; esto solo cubre lo que el modelo
    // dejó a medias, para que el alumno no se quede con media frase sin saberlo.
    checkStop((await stream.finalMessage()).stop_reason, "La respuesta se ha cortado. Prueba a preguntar algo más concreto.");
  } catch (e) {
    if (e instanceof PlanError || signal?.aborted) throw e;
    throw translate(e);
  }
}
