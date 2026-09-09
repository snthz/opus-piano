import { CATALOG } from "@/data/catalog";
import { EXERCISES } from "@/data/exercises";
import { ALL_LESSONS } from "@/data/lessons";
import { PATH, type PathStage, type PathStep } from "@/data/path";
import type { ProgressMap } from "@/lib/progress";
import { exercisePath, lessonPath } from "@/lib/routes";

/**
 * En qué punto de la ruta está el alumno.
 *
 * Nada de esto se guarda: se deduce cada vez de lo que ya sabemos —el
 * progreso de los ejercicios, las lecciones abiertas y las piezas que tiene
 * en la biblioteca—. Así no hay un segundo estado que pueda contradecir al
 * primero, y quien ya llevaba medio curso hecho no empieza la ruta a cero.
 */

/** Un ejercicio cuenta como hecho con suficientes intentos y suficiente acierto: uno solo de los dos se engaña fácil. */
export const MASTERY_ATTEMPTS = 20;
export const MASTERY_ACCURACY = 80;

export type StepState = "done" | "current" | "todo";

export interface ResolvedStep {
  step: PathStep;
  state: StepState;
  title: string;
  href: string;
  /** Lo que se muestra debajo del título: minutos, acierto, compases… */
  detail: string;
}

export interface ResolvedStage extends Omit<PathStage, "steps"> {
  steps: ResolvedStep[];
  done: number;
  total: number;
}

export interface ResolvedPath {
  stages: ResolvedStage[];
  /** El primer paso sin hacer: es el que la portada ofrece continuar. */
  next: ResolvedStep | null;
  done: number;
  total: number;
}

export interface PathInput {
  progress: ProgressMap;
  lessonsRead: readonly string[];
  /** Piezas del catálogo que ya están en la biblioteca: id de la pieza → id de la partitura. */
  ownedPieces: Map<string, string>;
}

/** Aciertos sobre intentos, redondeado; null si nunca se ha jugado. */
export function accuracyOf(progress: ProgressMap, exerciseId: string): number | null {
  const p = progress[exerciseId];
  if (!p?.attempts) return null;
  return Math.round((p.correct / p.attempts) * 100);
}

function resolveStep(step: PathStep, input: PathInput): Omit<ResolvedStep, "state"> & { done: boolean } {
  if (step.kind === "lesson") {
    const lesson = ALL_LESSONS.find((l) => l.slug === step.ref);
    return {
      step,
      title: lesson?.title ?? step.ref,
      href: lessonPath(step.ref),
      detail: lesson ? `Lección · ${lesson.minutes} min` : "Lección",
      done: input.lessonsRead.includes(step.ref),
    };
  }
  if (step.kind === "exercise") {
    const exercise = EXERCISES.find((e) => e.id === step.ref);
    const p = input.progress[step.ref];
    const accuracy = accuracyOf(input.progress, step.ref);
    const done = !!p && p.attempts >= MASTERY_ATTEMPTS && (accuracy ?? 0) >= MASTERY_ACCURACY;
    return {
      step,
      title: exercise?.title ?? step.ref,
      href: exercisePath(step.ref),
      detail: p?.attempts
        ? `Práctica · ${p.attempts} respuestas, ${accuracy}% de acierto`
        : `Práctica · ${MASTERY_ATTEMPTS} respuestas con un ${MASTERY_ACCURACY}%`,
      done,
    };
  }
  const piece = CATALOG.find((p) => p.id === step.ref);
  const scoreId = input.ownedPieces.get(step.ref);
  return {
    step,
    title: piece?.title ?? step.ref,
    href: scoreId ? `/scores?score=${encodeURIComponent(scoreId)}` : "/scores/catalog",
    detail: piece ? `Partitura · ${piece.music.measures.length} compases` : "Partitura",
    done: !!scoreId,
  };
}

/**
 * La ruta con cada paso marcado. «Actual» es el primer paso sin hacer, aunque
 * queden pendientes anteriores en otra etapa: nada se bloquea, la ruta
 * propone un orden pero no impide saltárselo.
 */
export function resolvePath(input: PathInput): ResolvedPath {
  let next: ResolvedStep | null = null;
  let done = 0;
  let total = 0;

  const stages = PATH.map((stage): ResolvedStage => {
    const steps = stage.steps.map((step): ResolvedStep => {
      const resolved = resolveStep(step, input);
      total++;
      if (resolved.done) done++;
      const state: StepState = resolved.done ? "done" : next ? "todo" : "current";
      const out: ResolvedStep = { step: resolved.step, title: resolved.title, href: resolved.href, detail: resolved.detail, state };
      if (state === "current") next = out;
      return out;
    });
    return { ...stage, steps, done: steps.filter((s) => s.state === "done").length, total: steps.length };
  });

  return { stages, next, done, total };
}
