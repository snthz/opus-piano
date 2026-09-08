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
 * El lado del navegador del plan de estudio: reúne lo que el profesor tiene que
 * ver —las páginas del PDF dibujadas y el MusicXML resumido— y lo manda a
 * `/api/study-plan`, que es quien habla con el modelo con la clave del
 * servidor. Aquí no hay ninguna clave de API.
 *
 * Las dos rutas contestan con líneas JSON, no de una vez: preparar un plan son
 * minutos y una respuesta del profesor llega palabra a palabra.
 */

export interface PlanService {
  /** Está configurado en el servidor (hay ANTHROPIC_API_KEY) */
  enabled: boolean;
  /** Planes por usuario y día que deja hacer este servidor */
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
    return OFF; // sin conexión: la aplicación sigue, solo que sin esta opción
  }
}

/**
 * Convierte las primeras páginas del PDF en PNG para que el modelo pueda
 * leerlas.
 *
 * En PNG y no en JPEG porque una partitura es línea fina de alto contraste
 * (pentagramas, plicas, puntillos) y ahí es donde la compresión con pérdida
 * deja artefactos. Además sale más ligera: medido sobre una página densa a
 * 1400 px, 283 KB en PNG frente a 366 KB en JPEG de calidad 0,82 — el JPEG
 * gasta bits en los bordes y el PNG comprime bien el blanco del papel.
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
  /** Fracción hecha (0 a 1) mientras se preparan las páginas; null mientras responde el modelo, que no avisa de su avance */
  onProgress?: (fraction: number | null) => void;
  signal?: AbortSignal;
}

/** Genera el plan: resume el MusicXML, dibuja las páginas del PDF y se lo pide al servidor. */
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

  input.onStatus?.("El profesor está estudiando la partitura y preparando el plan… suele tardar uno o dos minutos.");
  input.onProgress?.(null);

  const res = await post("/api/study-plan", { body }, input.signal);
  let done: { plan: unknown; model: unknown } | null = null;
  let failure: string | null = null;
  await readNdjson(res, (event) => {
    if (event.type === "done") done = event as { plan: unknown; model: unknown };
    else if (event.type === "error") failure = typeof event.message === "string" ? event.message : "No se ha podido preparar el plan.";
  });

  if (failure) throw new UserError(failure);
  if (!done) throw new UserError("El plan se ha cortado antes de terminar. Vuelve a intentarlo.");
  const { plan, model } = done as { plan: unknown; model: unknown };
  const state = planStateSchema.safeParse({ plan, progress: {}, model: typeof model === "string" ? model : "", createdAt: Date.now() });
  if (!state.success) throw new UserError("El plan recibido no tiene el formato esperado. Vuelve a intentarlo.");
  return state.data;
}

export interface AskInput {
  scoreName: string;
  naming: NamingSystem;
  state: PlanState;
  parsed: ParsedScore | null;
  /** Conversación hasta ahora, incluida la pregunta nueva al final */
  history: ChatTurn[];
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

/** Pregunta al profesor sobre el plan; `onDelta` recibe cada trozo de la respuesta. */
export async function askTeacher(input: AskInput): Promise<void> {
  const res = await post(
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
 * Manda la petición y devuelve el cuerpo, ya con los fallos de antes de empezar
 * —sesión caducada, límite diario, datos— convertidos en un mensaje que se
 * puede enseñar tal cual.
 */
async function post(url: string, init: RequestInit, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
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
