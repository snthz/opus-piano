"use client";

import { useSyncExternalStore } from "react";
import { getUser, onAuthChange } from "@/lib/auth";

/**
 * Progreso de los ejercicios.
 *
 * El dispositivo lleva una copia en localStorage para responder al instante y
 * funcionar sin conexión. Cada respuesta se guarda en local y se encola; si hay
 * una sesión iniciada, la cola se envía al servidor (Postgres) cuando hay red y
 * lo que devuelve el servidor pasa a ser la copia local. Así todos los
 * dispositivos de la misma cuenta ven lo mismo. Sin cuenta, todo queda en local
 * y se sube en cuanto el usuario inicia sesión.
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

export interface SyncState {
  /** null = nunca; ISO de la última sincronización correcta */
  lastSync: string | null;
  /** false = sin cuenta: el progreso solo está en este dispositivo */
  account: boolean;
  /** Respuestas pendientes de enviar */
  pending: number;
  error: string | null;
  busy: boolean;
}

interface QueuedAnswer {
  exerciseId: string;
  correct: boolean;
  streak: number;
  day: string;
  at: string;
}

const STORAGE_KEY = "etude:progress";
const QUEUE_KEY = "etude:progress-queue";
const SYNC_KEY = "etude:progress-sync";
const EMPTY: ProgressMap = {};

let cached: ProgressMap | null = null;
let syncState: SyncState = { lastSync: null, account: false, pending: 0, error: null, busy: false };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento */
  }
}

function read(): ProgressMap {
  if (cached) return cached;
  if (typeof window === "undefined") return EMPTY;
  cached = readJson<ProgressMap>(STORAGE_KEY, {});
  return cached;
}

function write(next: ProgressMap) {
  cached = next;
  writeJson(STORAGE_KEY, next);
  notify();
}

function setSync(patch: Partial<SyncState>) {
  syncState = { ...syncState, ...patch };
  writeJson(SYNC_KEY, { lastSync: syncState.lastSync });
  notify();
}

function queue(): QueuedAnswer[] {
  return readJson<QueuedAnswer[]>(QUEUE_KEY, []);
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

let flushTimer: number | null = null;

export function recordAnswer(exerciseId: string, correct: boolean, streak: number) {
  const all = { ...read() };
  const prev = all[exerciseId] ?? { attempts: 0, correct: 0, bestStreak: 0, lastPlayed: "", days: {} };
  const key = todayKey();
  const day = prev.days[key] ?? { attempts: 0, correct: 0 };
  const at = new Date().toISOString();
  all[exerciseId] = {
    attempts: prev.attempts + 1,
    correct: prev.correct + (correct ? 1 : 0),
    bestStreak: Math.max(prev.bestStreak, streak),
    lastPlayed: at,
    days: { ...prev.days, [key]: { attempts: day.attempts + 1, correct: day.correct + (correct ? 1 : 0) } },
  };
  write(all);

  const q = queue();
  q.push({ exerciseId, correct, streak, day: key, at });
  writeJson(QUEUE_KEY, q);
  setSync({ pending: q.length });

  // Se agrupan respuestas seguidas en un solo envío.
  if (flushTimer) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => void flushQueue(), 1500);
}

/** Envía la cola al servidor y adopta lo que devuelve. Silencioso si no hay red o no hay cuenta. */
export async function flushQueue(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  if (!getUser()) {
    setSync({ account: false, error: null, busy: false });
    return false;
  }
  const answers = queue();
  setSync({ account: true, busy: true });
  try {
    const res = await fetch("/api/progress/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
      cache: "no-store",
    });
    if (res.status === 401) throw new Error("La sesión ha caducado");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const map = (await res.json()) as ProgressMap;
    // Solo se vacía lo que se envió: lo que llegue mientras tanto sigue en cola.
    const remaining = queue().slice(answers.length);
    writeJson(QUEUE_KEY, remaining);
    write(map);
    setSync({ lastSync: new Date().toISOString(), pending: remaining.length, error: null, busy: false });
    return true;
  } catch (e) {
    setSync({ error: e instanceof Error ? e.message : "No se pudo sincronizar", busy: false });
    return false;
  }
}

/** Al arrancar: envía lo pendiente y trae el progreso del servidor. */
export async function syncProgress(): Promise<void> {
  if (typeof window === "undefined") return;
  const saved = readJson<{ lastSync: string | null }>(SYNC_KEY, { lastSync: null });
  syncState = { ...syncState, lastSync: saved.lastSync, pending: queue().length, account: !!getUser() };
  await flushQueue();
}

/** Vacía la copia local sin tocar el servidor (al cerrar sesión, para no mezclar cuentas en un mismo dispositivo). */
export function clearLocalProgress() {
  writeJson(QUEUE_KEY, []);
  write({});
  setSync({ lastSync: null, pending: 0, error: null, busy: false, account: !!getUser() });
}

export async function resetProgress() {
  writeJson(QUEUE_KEY, []);
  write({});
  setSync({ pending: 0 });
  if (getUser()) await fetch("/api/progress", { method: "DELETE" }).catch(() => {});
}

// Al iniciar sesión se sube lo hecho sin cuenta y se adopta el progreso del servidor;
// al cerrarla se limpia la copia local.
if (typeof window !== "undefined") {
  onAuthChange((user) => {
    if (user) void flushQueue();
    else clearLocalProgress();
  });
}

export function useProgress(): ProgressMap {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

const SYNC_SERVER: SyncState = { lastSync: null, account: false, pending: 0, error: null, busy: false };
export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, () => syncState, () => SYNC_SERVER);
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
