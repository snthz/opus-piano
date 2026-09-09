import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

/**
 * What the server's own API key is allowed to spend, and on whom.
 *
 * Two limits, and they answer different questions. The per-user caps
 * (`PLANS_PER_DAY`, `PLAN_QUESTIONS_PER_HOUR`) keep one student from
 * monopolising the teacher; they used to live in a `Map` and reset on every
 * deploy, so they're counted from the database now. The monthly budget is the
 * one that protects the card: it's global, and once the month's estimated
 * spend reaches it, nothing else goes out until the next month.
 */

/** Dollars per million tokens, as billed by the Anthropic API. */
const PRICES: Record<string, { in: number; out: number }> = {
  "claude-fable-5-1": { in: 10, out: 50 },
  "claude-fable-5": { in: 10, out: 50 },
  "claude-opus-5": { in: 5, out: 25 },
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-opus-4-7": { in: 5, out: 25 },
  "claude-opus-4-6": { in: 5, out: 25 },
  "claude-sonnet-5": { in: 2, out: 10 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};

/**
 * `STUDY_PLAN_MODEL` can name a model released after this table was written.
 * Charging it at the priciest rate we know overestimates the bill, which is
 * the right way to be wrong when the number guards a budget.
 */
const UNKNOWN_MODEL = { in: 10, out: 50 };

/** Reading from the cache costs a tenth of a fresh input token; writing to it, a quarter more. */
const CACHE_READ_FACTOR = 0.1;
const CACHE_WRITE_FACTOR = 1.25;

const MICROS_PER_DOLLAR = 1_000_000;

export interface CallUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/** The SDK's usage block, with the fields we bill on and nulls flattened to 0. */
export function readUsage(usage: Anthropic.Usage | null | undefined): CallUsage {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
  };
}

/**
 * Estimated cost of one call, in millionths of a dollar. The prices are per
 * million tokens and a micro is a millionth of a dollar, so the two millions
 * cancel: one token costs exactly `price` micros.
 */
export function costMicros(model: string, usage: CallUsage): number {
  const price = PRICES[model] ?? UNKNOWN_MODEL;
  return Math.round(
    usage.inputTokens * price.in +
      usage.outputTokens * price.out +
      usage.cacheReadTokens * price.in * CACHE_READ_FACTOR +
      usage.cacheWriteTokens * price.in * CACHE_WRITE_FACTOR,
  );
}

/** "2026-09": the bucket a call's spend counts against. */
export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

/** Monthly ceiling in dollars. 0 (or unset) means no ceiling — only the per-user caps apply. */
export const monthlyBudget = () => Math.max(0, Number(process.env.AI_MONTHLY_BUDGET_USD ?? 20) || 0);

export interface Spend {
  /** Spent so far this month, in millionths of a dollar. */
  micros: number;
  /** The ceiling in the same unit; 0 if there is none. */
  budgetMicros: number;
  /** Nothing else goes out until next month. */
  exhausted: boolean;
}

/**
 * The month's spend so far. One indexed aggregate over a table that grows by
 * a few rows per student per day, so it can run before every call.
 */
export async function monthSpend(now = new Date()): Promise<Spend> {
  const budgetMicros = Math.round(monthlyBudget() * MICROS_PER_DOLLAR);
  if (!budgetMicros) return { micros: 0, budgetMicros: 0, exhausted: false };
  let micros = 0;
  try {
    const sum = await prisma.aiCall.aggregate({ _sum: { costMicros: true }, where: { month: monthKey(now) } });
    micros = sum._sum.costMicros ?? 0;
  } catch (e) {
    // A database that won't answer is not a reason to start spending blind.
    console.error("ai-budget: could not read the month's spend", e);
    return { micros: budgetMicros, budgetMicros, exhausted: true };
  }
  return { micros, budgetMicros, exhausted: micros >= budgetMicros };
}

/**
 * The budget is checked before a call and charged after it, so the call that
 * crosses the line still goes through — by design. The overshoot is bounded
 * by one request (~15 cents for a plan), and the alternative, reserving an
 * estimate up front, would refuse cheap calls on a guess.
 */
export async function budgetExhausted(now = new Date()): Promise<boolean> {
  return (await monthSpend(now)).exhausted;
}

/** Message shown when the ceiling is reached; deliberately says nothing about the amount. */
export const BUDGET_MESSAGE =
  "El profesor ha agotado su presupuesto de este mes. Vuelve el mes que viene o avisa por el formulario de contacto.";

/** Rows older than this are only dead weight: the widest per-user window is a day. */
const KEEP_DAYS = 90;

/** Records what a call cost. Never throws: losing the receipt must not break a reply already streamed. */
export async function recordCall(input: {
  userId: string;
  kind: string;
  model: string;
  usage: CallUsage;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  try {
    await prisma.aiCall.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        model: input.model,
        at: now,
        ...input.usage,
        costMicros: costMicros(input.model, input.usage),
        month: monthKey(now),
      },
    });
  } catch (e) {
    console.error("ai-budget: could not record the call", e);
    return;
  }
  // Cheap enough to piggyback on a request that just waited on a model.
  if (Math.random() < 0.02) {
    const cutoff = new Date(now.getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000);
    await prisma.aiCall.deleteMany({ where: { at: { lt: cutoff } } }).catch(() => {});
  }
}

export interface CallLimit {
  max: number;
  windowMs: number;
}

/**
 * Whether this user has used up `limit` calls of `kind` within the window.
 * Counted from the rows written by `recordCall`, so a redeploy no longer
 * hands everyone a fresh allowance.
 */
export async function overCallLimit(userId: string, kind: string, limit: CallLimit, now = new Date()): Promise<boolean> {
  if (!limit.max) return true;
  try {
    const used = await prisma.aiCall.count({
      where: { userId, kind, at: { gte: new Date(now.getTime() - limit.windowMs) } },
    });
    return used >= limit.max;
  } catch (e) {
    console.error("ai-budget: could not count the user's calls", e);
    return true; // same reasoning as the budget: unknown means no.
  }
}
