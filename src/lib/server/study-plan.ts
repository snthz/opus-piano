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
 * Opus Piano's AI teacher: Claude, called with the server's own API key. The
 * student pays nothing directly. Disabled without `ANTHROPIC_API_KEY`, same as
 * OMR without `OMR_URL`.
 *
 * What each call is allowed to cost lives in `ai-budget.ts`: the per-user caps
 * declared here are enforced from the database, and a monthly ceiling
 * (`AI_MONTHLY_BUDGET_USD`) stops everything when the bill gets there. This
 * module only reports what a call consumed, through `UsageSink`.
 */

const HOUR = 60 * 60 * 1000;

const apiKey = () => (process.env.ANTHROPIC_API_KEY ?? "").trim();

export const planEnabled = () => !!apiKey();

/** Sonnet reads a scanned score well for a fraction of Opus's cost; Haiku is cheaper but misses accidentals and note values. */
const DEFAULT_MODEL = "claude-sonnet-5";

export const planModel = () => (process.env.STUDY_PLAN_MODEL || DEFAULT_MODEL).trim();

/** Plans per user per day; each one costs ~10-15 cents on the server's bill. */
export const planLimit = () => ({ max: Number(process.env.PLANS_PER_DAY || 3), windowMs: 24 * HOUR });

/** Teacher questions per user per hour: cheap (no images), but not unlimited. */
export const askLimit = () => ({ max: Number(process.env.PLAN_QUESTIONS_PER_HOUR || 40), windowMs: HOUR });

/**
 * Streamed because a plan takes a minute or two, and a silent HTTP request
 * that long gets cut by some proxy along the way. These caps are generous on
 * purpose: they're not the budget, just where a half-finished reply gets cut
 * off after the whole request was already paid for.
 */
const PLAN_MAX_TOKENS = 16_000;
const ASK_MAX_TOKENS = 4_000;

/** Message already written for the student; technical detail stays in the log. */
export class PlanError extends Error {}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: apiKey() });
  return client;
}

/** Translates a provider failure into a message the student can act on (retry or not). */
function translate(e: unknown): PlanError {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    console.error("study-plan: server API key is invalid", e.message);
    return new PlanError("El profesor no está disponible ahora mismo. Avisa por el formulario de contacto si sigue así.");
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new PlanError("Hay demasiadas peticiones ahora mismo. Espera un par de minutos y vuelve a intentarlo.");
  }
  if (e instanceof Anthropic.APIError) {
    // 400 with "credit" = out of balance; 529 = provider overloaded
    if (e.status === 529 || (e.status ?? 0) >= 500) return new PlanError("El profesor está saturado en este momento. Inténtalo en unos minutos.");
    console.error(`study-plan: API returned ${e.status}`, e.message);
    return new PlanError("No se ha podido analizar la partitura. Vuelve a intentarlo en un rato.");
  }
  console.error("study-plan: unexpected failure", e);
  return new PlanError("No se ha podido analizar la partitura. Vuelve a intentarlo en un rato.");
}

/** Reasons the model stopped early; none of them fix themselves with a plain retry. */
function checkStop(stopReason: string | null | undefined, truncated: string) {
  if (stopReason === "refusal") throw new PlanError("El profesor no ha querido responder a esta petición.");
  if (stopReason === "max_tokens") throw new PlanError(truncated);
}

/** Told what a finished call consumed, so the route can charge it to the budget. */
export type UsageSink = (usage: Anthropic.Usage) => void;

/** Requests the plan and returns raw JSON (the caller validates it with a zod schema). Pages go as base64 PNGs. */
export async function generatePlan(req: PlanRequest, pages: string[], signal?: AbortSignal, onUsage?: UsageSink): Promise<string> {
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
    if (signal?.aborted) throw e; // cancelled by the student, not a real failure
    throw translate(e);
  }
  // Reported before the checks below: a plan that came back truncated was paid for all the same.
  onUsage?.(message.usage);

  checkStop(message.stop_reason, "El análisis se ha quedado sin espacio a mitad. Prueba con una partitura de menos páginas.");
  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  if (!text.trim()) throw new PlanError("El profesor no ha devuelto ningún análisis. Vuelve a intentarlo.");
  return text;
}

/**
 * A chat answer, streamed chunk by chunk as the model writes it. Only the
 * system prompt changes between the teacher who knows one score
 * (`askTeacher`) and the one who knows the course (`src/lib/server/teacher.ts`),
 * so the call, the error handling and the receipt live here once.
 */
export async function* streamAnswer(system: string, history: ChatTurn[], signal?: AbortSignal, onUsage?: UsageSink): AsyncGenerator<string> {
  const stream = anthropic().messages.stream(
    {
      model: planModel(),
      max_tokens: ASK_MAX_TOKENS,
      system,
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
    // response already streamed; this only catches a reply left half-finished
    const final = await stream.finalMessage();
    onUsage?.(final.usage);
    checkStop(final.stop_reason, "La respuesta se ha cortado. Prueba a preguntar algo más concreto.");
  } catch (e) {
    if (e instanceof PlanError || signal?.aborted) throw e;
    throw translate(e);
  }
}

/** Answers a question about the plan of one score. */
export function askTeacher(ctx: AskContext, history: ChatTurn[], signal?: AbortSignal, onUsage?: UsageSink): AsyncGenerator<string> {
  return streamAnswer(askInstructions(ctx), history, signal, onUsage);
}
