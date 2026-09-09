"use client";

import { readNdjson } from "@/lib/ndjson";
import { getPageSize, renderPage } from "@/lib/pdf-thumbnail";
import type { ParsedScore } from "@/lib/music/musicxml";
import type { NamingSystem } from "@/lib/music/pitch";
import { UserError } from "@/lib/user-error";
import {
  HISTORY_TURNS,
  MAX_PAGES,
  PAGE_EDGE,
  planStateSchema,
  summarizeScore,
  type ChatTurn,
  type Level,
  type PlanState,
} from "@/lib/study-plan";

/**
 * Browser side of the study plan: gathers what the teacher needs to see —
 * rendered PDF pages and the summarized MusicXML — and posts it to
 * `/api/study-plan`, which talks to the model with the server's own key. No
 * API key lives here.
 *
 * Both routes reply with NDJSON lines, not all at once: preparing a plan
 * takes minutes and the teacher's answer arrives word by word.
 */

export interface PlanService {
  /** Whether the server has it configured (ANTHROPIC_API_KEY set). */
  enabled: boolean;
  /** Plans per user per day this server allows. */
  perDay: number;
}

const OFF: PlanService = { enabled: false, perDay: 0 };

export async function planService(): Promise<PlanService> {
  try {
    const res = await fetch("/api/study-plan", { cache: "no-store" });
    if (!res.ok) return OFF;
    const body = (await res.json()) as Partial<PlanService>;
    return { enabled: !!body.enabled, perDay: Number(body.perDay) || 0 };
  } catch {
    return OFF; // offline: the app still works, just without this option
  }
}

/**
 * Converts the PDF's first pages to PNG for the model to read.
 *
 * PNG over JPEG because a score is thin high-contrast lines (staves, stems,
 * dots), exactly where lossy compression leaves artifacts, and it's lighter
 * too: on a dense page at 1400 px, 283 KB PNG vs 366 KB JPEG at quality 0.82.
 */
export async function renderPages(pdf: Blob, pageCount: number, onProgress?: (done: number, total: number) => void): Promise<Blob[]> {
  const total = Math.min(pageCount, MAX_PAGES);
  const out: Blob[] = [];
  for (let n = 1; n <= total; n++) {
    const { width, height } = await getPageSize(pdf, n);
    const canvas = await renderPage(pdf, n, PAGE_EDGE / Math.max(width, height));
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new UserError("No se ha podido preparar la imagen de una página.");
    out.push(blob);
    onProgress?.(n, total);
  }
  return out;
}

export interface GenerateInput {
  scoreName: string;
  notes: string;
  level: Level;
  minutesPerDay: number;
  daysPerWeek: number;
  goal: string;
  naming: NamingSystem;
  parsed: ParsedScore | null;
  pdf: { blob: Blob; pageCount: number } | null;
  onStatus?: (text: string) => void;
  /** Fraction done (0-1) while pages render; null while the model answers, which doesn't report progress. */
  onProgress?: (fraction: number | null) => void;
  signal?: AbortSignal;
}

/** Generates the plan: summarizes the MusicXML, renders the PDF pages, and asks the server. */
export async function generatePlan(input: GenerateInput): Promise<PlanState> {
  let pages: Blob[] = [];
  if (input.pdf) {
    input.onStatus?.("Preparando las páginas de la partitura…");
    pages = await renderPages(input.pdf.blob, input.pdf.pageCount, (n, t) => {
      input.onStatus?.(`Preparando la página ${n} de ${t}…`);
      input.onProgress?.(n / t);
    });
  }

  const body = new FormData();
  body.append(
    "data",
    JSON.stringify({
      level: input.level,
      minutesPerDay: input.minutesPerDay,
      daysPerWeek: input.daysPerWeek,
      goal: input.goal,
      naming: input.naming,
      scoreName: input.scoreName,
      notes: input.notes,
      summary: input.parsed ? summarizeScore(input.parsed) : "",
      pages: input.pdf ? { sent: pages.length, total: input.pdf.pageCount } : null,
    }),
  );
  for (const [i, page] of pages.entries()) body.append("page", page, `p${i + 1}.png`);

  input.onStatus?.("El profesor está estudiando la partitura… suele tardar uno o dos minutos.");
  input.onProgress?.(null);

  const res = await postStream("/api/study-plan", { body }, input.signal);
  let done: { plan: unknown; model: unknown } | null = null;
  let failure: string | null = null;
  await readNdjson(res, (event) => {
    if (event.type === "done") done = event as { plan: unknown; model: unknown };
    else if (event.type === "error") failure = typeof event.message === "string" ? event.message : "No se ha podido analizar la partitura.";
  });

  if (failure) throw new UserError(failure);
  if (!done) throw new UserError("El análisis se ha cortado antes de terminar. Vuelve a intentarlo.");
  const { plan, model } = done as { plan: unknown; model: unknown };
  const state = planStateSchema.safeParse({ plan, progress: {}, model: typeof model === "string" ? model : "", createdAt: Date.now() });
  if (!state.success) throw new UserError("El análisis recibido no tiene el formato esperado. Vuelve a intentarlo.");
  return state.data;
}

export interface AskInput {
  scoreName: string;
  naming: NamingSystem;
  state: PlanState;
  parsed: ParsedScore | null;
  /** Conversation so far, including the new question at the end. */
  history: ChatTurn[];
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

/** Asks the teacher about the plan; `onDelta` receives each chunk of the answer. */
export async function askTeacher(input: AskInput): Promise<void> {
  const res = await postStream(
    "/api/study-plan/ask",
    {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        naming: input.naming,
        scoreName: input.scoreName,
        plan: input.state.plan,
        progress: input.state.progress,
        summary: input.parsed ? summarizeScore(input.parsed) : "",
        history: input.history.slice(-HISTORY_TURNS),
      }),
    },
    input.signal,
  );

  let failure: string | null = null;
  await readNdjson(res, (event) => {
    if (event.type === "delta" && typeof event.text === "string") input.onDelta(event.text);
    else if (event.type === "error") failure = typeof event.message === "string" ? event.message : "No se ha podido obtener respuesta.";
  });
  if (failure) throw new UserError(failure);
}

/**
 * Sends the request and returns the body, with early failures (expired
 * session, daily limit, bad data) already turned into a message fit to show
 * as-is. Exported because the general teacher (`teacher-client.ts`) talks to
 * an NDJSON route with the same failure modes.
 */
export async function postStream(url: string, init: RequestInit, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", ...init, signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new UserError("No hay conexión con el servidor. Comprueba la red e inténtalo de nuevo.");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new UserError(data?.error ?? "El profesor no está disponible ahora mismo.");
  }
  if (!res.body) throw new UserError("El servidor no ha devuelto ninguna respuesta.");
  return res.body;
}
