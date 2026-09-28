"use client";

import { useSyncExternalStore } from "react";

/**
 * Qué niveles se han superado, y con cuántas estrellas.
 *
 * `progress.ts` cuenta respuestas y `item-stats.ts` guarda una ficha por nota;
 * ninguno de los dos sabe dónde está el alumno dentro de un ejercicio por
 * niveles. Esto es esa tercera cosa: una línea por nivel con su mejor
 * resultado, que es lo que abre el siguiente y lo que se ve en el mapa.
 *
 * Vive en el dispositivo, como las fichas: es el estado del ejercicio, no un
 * resultado que enseñar, y se rehace en un par de sesiones.
 */

export interface LevelRecord {
  /** 1-3; 0 no se guarda (un nivel suspendido no deja rastro). */
  stars: number;
  /** Mejor porcentaje de aciertos, 0-100. */
  best: number;
  /** Tandas jugadas. */
  plays: number;
}

/** exerciseId → levelId → resultado. */
export type AllLevels = Record<string, Record<string, LevelRecord>>;

const STORAGE_KEY = "etude:practice-levels";
const EMPTY: AllLevels = {};
const NO_LEVELS: Record<string, LevelRecord> = {};

let cached: AllLevels | null = null;
const listeners = new Set<() => void>();

function read(): AllLevels {
  if (cached) return cached;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cached = raw ? (JSON.parse(raw) as AllLevels) : {};
  } catch {
    cached = {};
  }
  return cached ?? EMPTY;
}

function write(next: AllLevels) {
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* sin almacenamiento */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function levelsOf(exerciseId: string): Record<string, LevelRecord> {
  return read()[exerciseId] ?? NO_LEVELS;
}

/** Guarda una tanda. Las estrellas y el porcentaje solo suben: se conserva la mejor pasada. */
export function recordLevel(exerciseId: string, levelId: string, stars: number, score: number) {
  const all = read();
  const levels = all[exerciseId] ?? {};
  const prev = levels[levelId];
  write({
    ...all,
    [exerciseId]: {
      ...levels,
      [levelId]: {
        stars: Math.max(prev?.stars ?? 0, stars),
        best: Math.max(prev?.best ?? 0, score),
        plays: (prev?.plays ?? 0) + 1,
      },
    },
  });
}

export function clearLevelProgress() {
  write({});
}

export function useLevelProgress(exerciseId: string): Record<string, LevelRecord> {
  return useSyncExternalStore(
    subscribe,
    () => read()[exerciseId] ?? NO_LEVELS,
    () => NO_LEVELS,
  );
}

/**
 * Hasta dónde se puede jugar: el primer nivel siempre, y cada uno más en
 * cuanto el anterior se aprueba. Devuelve cuántos están abiertos.
 */
export function unlockedCount(ids: readonly string[], records: Record<string, LevelRecord>): number {
  let open = 1;
  for (const id of ids) {
    if ((records[id]?.stars ?? 0) > 0) open++;
    else break;
  }
  return Math.min(open, ids.length);
}

/** Estrellas conseguidas y posibles, para la cabecera del mapa. */
export function starTotals(ids: readonly string[], records: Record<string, LevelRecord>) {
  const earned = ids.reduce((sum, id) => sum + (records[id]?.stars ?? 0), 0);
  return { earned, possible: ids.length * 3 };
}
