import type { ExerciseInfo } from "@/data/exercises";
import type { ProgressMap } from "@/lib/progress";

export type SuggestionReason = "reforzar" | "empezar" | "retomar" | "seguir";

export interface Suggestion {
  exercise: ExerciseInfo;
  reason: SuggestionReason;
  /** Texto corto para la interfaz, ya en español. */
  label: string;
}

/** Por debajo de esta precisión (con intentos suficientes) el ejercicio se marca para reforzar. */
const WEAK_ACCURACY = 75;
const MIN_ATTEMPTS = 5;
/** Días sin tocar un ejercicio a partir de los cuales conviene retomarlo. */
const STALE_DAYS = 3;

function daysSince(iso: string, now: Date): number {
  const ms = now.getTime() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

/**
 * Prácticas sugeridas a partir del progreso guardado. Prioridad: primero lo
 * que va flojo, luego lo que no se ha empezado, después lo que lleva días
 * sin tocarse y, si todo va bien, lo que menos se ha practicado.
 */
export function suggestExercises(progress: ProgressMap, exercises: ExerciseInfo[], limit = 3, now = new Date()): Suggestion[] {
  const scored = exercises.map((exercise, index) => {
    const p = progress[exercise.id];
    if (!p || !p.attempts) {
      return { exercise, reason: "empezar" as const, label: "Sin empezar", rank: 1, tiebreak: index };
    }
    const accuracy = Math.round((p.correct / p.attempts) * 100);
    if (p.attempts >= MIN_ATTEMPTS && accuracy < WEAK_ACCURACY) {
      return { exercise, reason: "reforzar" as const, label: `Para reforzar · ${accuracy}%`, rank: 0, tiebreak: accuracy };
    }
    const stale = daysSince(p.lastPlayed, now);
    if (stale >= STALE_DAYS) {
      return { exercise, reason: "retomar" as const, label: `Hace ${stale} días`, rank: 2, tiebreak: -stale };
    }
    return { exercise, reason: "seguir" as const, label: `${accuracy}% · sigue así`, rank: 3, tiebreak: p.attempts };
  });

  return scored
    .sort((a, b) => a.rank - b.rank || a.tiebreak - b.tiebreak)
    .slice(0, limit)
    .map(({ exercise, reason, label }) => ({ exercise, reason, label }));
}
