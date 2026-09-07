"use client";

import { getPageSize, renderPage } from "@/lib/pdf-thumbnail";
import type { ParsedScore } from "@/lib/music/musicxml";
import type { NamingSystem } from "@/lib/music/pitch";
import {
  askInstructions,
  planInstructions,
  planUserMessage,
  studyPlanSchema,
  summarizeScore,
  STUDY_PLAN_SCHEMA,
  type Level,
  type PlanState,
  type StudyPlan,
} from "@/lib/study-plan";
import { requestJson, streamText } from "./client";
import type { AiTarget } from "./config";
import { maxImageEdge } from "./models";
import { AiError, type ChatTurn, type InputPart } from "./errors";

/** Páginas del PDF que se envían como imagen (las primeras). */
export const MAX_PAGES = 12;

/**
 * Convierte las primeras páginas del PDF en PNG (data URL) para que el modelo
 * pueda leerlas. `maxEdge` es el lado largo que el modelo admite sin reescalar.
 *
 * En PNG y no en JPEG porque una partitura es línea fina de alto contraste
 * (pentagramas, plicas, puntillos) y ahí es donde la compresión con pérdida
 * deja artefactos. Además sale más ligera: medido sobre una página densa a
 * 1400 px, 283 KB en PNG frente a 366 KB en JPEG de calidad 0,82 — el JPEG
 * gasta bits en los bordes y el PNG comprime bien el blanco del papel.
 */
export async function renderPagesForAi(pdf: Blob, pageCount: number, maxEdge: number, onProgress?: (done: number, total: number) => void): Promise<string[]> {
  const total = Math.min(pageCount, MAX_PAGES);
  const out: string[] = [];
  for (let n = 1; n <= total; n++) {
    const { width, height } = await getPageSize(pdf, n);
    const canvas = await renderPage(pdf, n, maxEdge / Math.max(width, height));
    out.push(canvas.toDataURL("image/png"));
    onProgress?.(n, total);
  }
  return out;
}

export interface GenerateInput {
  target: AiTarget;
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
  signal?: AbortSignal;
}

/** Genera el plan: resume el MusicXML, dibuja las páginas del PDF y pide el JSON al modelo. */
export async function generatePlan(input: GenerateInput): Promise<PlanState> {
  const summary = input.parsed ? summarizeScore(input.parsed) : "";
  let pages: string[] = [];
  if (input.pdf) {
    input.onStatus?.("Preparando las páginas de la partitura…");
    const edge = maxImageEdge(input.target.provider, input.target.model);
    pages = await renderPagesForAi(input.pdf.blob, input.pdf.pageCount, edge, (n, t) => input.onStatus?.(`Preparando la página ${n} de ${t}…`));
  }
  const req = {
    level: input.level,
    minutesPerDay: input.minutesPerDay,
    daysPerWeek: input.daysPerWeek,
    goal: input.goal,
    naming: input.naming,
    scoreName: input.scoreName,
    notes: input.notes,
    summary,
    pages: input.pdf ? { sent: pages.length, total: input.pdf.pageCount } : null,
  };
  const content: InputPart[] = [{ type: "text", text: planUserMessage(req) }, ...pages.map((p): InputPart => ({ type: "image", dataUrl: p }))];
  input.onStatus?.("El profesor está estudiando la partitura y preparando el plan… suele tardar uno o dos minutos.");
  const text = await requestJson(
    input.target,
    { instructions: planInstructions(req), content, schemaName: "plan_de_estudio", schema: STUDY_PLAN_SCHEMA, effort: "medium", maxOutputTokens: 16_000 },
    input.signal,
  );
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AiError("El modelo no ha devuelto un plan legible. Vuelve a intentarlo.");
  }
  const parsed = studyPlanSchema.safeParse(raw);
  if (!parsed.success) throw new AiError("El plan recibido no tiene el formato esperado. Vuelve a intentarlo o prueba otro modelo.");
  return { plan: dedupeGoalIds(parsed.data), progress: {}, model: input.target.model, createdAt: Date.now() };
}

/** Los ids de los objetivos deben ser únicos: si el modelo repite alguno, se renumeran. */
export function dedupeGoalIds(plan: StudyPlan): StudyPlan {
  const seen = new Set<string>();
  const goals = plan.goals.map((g, i) => {
    const id = seen.has(g.id) || !g.id ? `g${i + 1}` : g.id;
    seen.add(id);
    return { ...g, id };
  });
  return { ...plan, goals };
}

export interface AskInput {
  target: AiTarget;
  scoreName: string;
  naming: NamingSystem;
  state: PlanState;
  parsed: ParsedScore | null;
  /** Conversación hasta ahora, incluida la pregunta nueva al final */
  history: ChatTurn[];
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

/** Los últimos turnos que se envían al modelo (la instrucción ya lleva el plan y la partitura). */
const HISTORY_TURNS = 12;

export function askTeacher(input: AskInput): Promise<string> {
  const instructions = askInstructions({
    naming: input.naming,
    scoreName: input.scoreName,
    plan: input.state.plan,
    progress: input.state.progress,
    summary: input.parsed ? summarizeScore(input.parsed) : "",
  });
  return streamText(input.target, { instructions, history: input.history.slice(-HISTORY_TURNS), effort: "low", maxOutputTokens: 2_000 }, input.onDelta, input.signal);
}
