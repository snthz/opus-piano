"use client";

import { useSyncExternalStore } from "react";
import { getUser, onAuthChange } from "@/lib/auth";
import { clearItemStats } from "@/lib/practice/item-stats";

/**
 * Exercise progress.
 *
 * The device keeps a localStorage copy for instant responses and offline
 * use. Every answer is saved locally and queued; if signed in, the queue is
 * sent to the server (Postgres) once there's network, and the server's
 * response becomes the local copy — so every device on the account sees the
 * same thing. Without an account, everything stays local and uploads as soon
 * as the user signs in.
 */
export interface ExerciseProgress {
  attempts: number;
  correct: number;
  bestStreak: number;
  lastPlayed: string;
  /** Activity by day: "2026-09-04" → { attempts, correct }. */
  days: Record<string, { attempts: number; correct: number }>;
}

export type ProgressMap = Record<string, ExerciseProgress>;

export interface SyncState {
  /** null = never; ISO timestamp of the last successful sync. */
  lastSync: string | null;
  /** false = no account: progress lives only on this device. */
  account: boolean;
  /** Answers pending upload. */
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
    /* no storage available */
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

  // batches consecutive answers into a single upload
  if (flushTimer) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => void flushQueue(), 1500);
}

/** Sends the queue to the server and adopts its response. Silent if offline or signed out. */
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
    // only clears what was sent; anything queued in the meantime stays
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

/** On startup: sends what's pending and fetches progress from the server. */
export async function syncProgress(): Promise<void> {
  if (typeof window === "undefined") return;
  const saved = readJson<{ lastSync: string | null }>(SYNC_KEY, { lastSync: null });
  syncState = { ...syncState, lastSync: saved.lastSync, pending: queue().length, account: !!getUser() };
  await flushQueue();
}

/** Clears the local copy without touching the server (on sign out, so accounts don't mix on one device). */
export function clearLocalProgress() {
  writeJson(QUEUE_KEY, []);
  write({});
  // the per-item record never leaves the device, so nothing restores it: it
  // goes with the progress it belongs to
  clearItemStats();
  setSync({ lastSync: null, pending: 0, error: null, busy: false, account: !!getUser() });
}

export async function resetProgress() {
  writeJson(QUEUE_KEY, []);
  write({});
  clearItemStats();
  setSync({ pending: 0 });
  if (getUser()) await fetch("/api/progress", { method: "DELETE" }).catch(() => {});
}

// on sign in, uploads what was done without an account and adopts the server's progress;
// on sign out, clears the local copy
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

/** Answers in a day that close the "today" ring. */
export const DAILY_GOAL = 20;

/** Today so far: answers, hits and accuracy (null until the first answer). */
export function summarizeToday(p: ProgressMap, day = todayKey()) {
  let attempts = 0;
  let correct = 0;
  for (const ex of Object.values(p)) {
    const d = ex.days[day];
    if (d) {
      attempts += d.attempts;
      correct += d.correct;
    }
  }
  return { attempts, correct, accuracy: attempts ? Math.round((correct / attempts) * 100) : null };
}

/** Global summary: attempts, correct answers, and distinct days with activity. */
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

/** Streak of consecutive days (including today or yesterday). */
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
