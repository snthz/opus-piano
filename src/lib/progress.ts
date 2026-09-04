"use client";

import { useSyncExternalStore } from "react";

/**
 * Progreso de los ejercicios, guardado en localStorage.
 */
export interface ExerciseProgress {
  attempts: number;
  correct: number;
  bestStreak: number;
  lastPlayed: string;
  /** Actividad por día: "2026-09-04" → { attempts, correct } */
  days: Record<string, { attempts: number; correct: number }>;
}

export type ProgressMap = Record<string, ExerciseProgress>;

const STORAGE_KEY = "etude:progress";
let cached: ProgressMap | null = null;
const listeners = new Set<() => void>();
const EMPTY: ProgressMap = {};

function read(): ProgressMap {
  if (cached) return cached;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cached = raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    cached = {};
  }
  return cached;
}

function write(next: ProgressMap) {
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

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function recordAnswer(exerciseId: string, correct: boolean, streak: number) {
  const all = { ...read() };
  const prev = all[exerciseId] ?? { attempts: 0, correct: 0, bestStreak: 0, lastPlayed: "", days: {} };
  const key = todayKey();
  const day = prev.days[key] ?? { attempts: 0, correct: 0 };
  all[exerciseId] = {
    attempts: prev.attempts + 1,
    correct: prev.correct + (correct ? 1 : 0),
    bestStreak: Math.max(prev.bestStreak, streak),
    lastPlayed: new Date().toISOString(),
    days: { ...prev.days, [key]: { attempts: day.attempts + 1, correct: day.correct + (correct ? 1 : 0) } },
  };
  write(all);
}

export function resetProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorar */
  }
  cached = null;
  write({});
}

export function useProgress(): ProgressMap {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Resumen global: intentos, aciertos y días distintos con actividad. */
export function summarize(p: ProgressMap) {
  let attempts = 0;
  let correct = 0;
  const days = new Set<string>();
  for (const ex of Object.values(p)) {
    attempts += ex.attempts;
    correct += ex.correct;
    for (const d of Object.keys(ex.days)) days.add(d);
  }
  return { attempts, correct, days: days.size, accuracy: attempts ? Math.round((correct / attempts) * 100) : 0 };
}

/** Racha de días consecutivos (incluyendo hoy o ayer). */
export function dayStreak(p: ProgressMap): number {
  const days = new Set<string>();
  for (const ex of Object.values(p)) for (const d of Object.keys(ex.days)) days.add(d);
  let streak = 0;
  const cursor = new Date();
  if (!days.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(todayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
