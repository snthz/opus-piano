"use client";

import { useSyncExternalStore } from "react";
import { applyAnswer, chooseItem, weakest, type ItemStats, type WeakItem } from "./scheduler";

/**
 * Per-item practice record, kept on the device.
 *
 * `progress.ts` counts answers per exercise ("notas: 240 respuestas, 88 %"),
 * which says how much you practise but not what you get wrong. This is the
 * other half: one record per question — the F on the bass staff, E flat
 * major, a rising sixth — which is what lets the generator insist on what
 * fails (see `scheduler.ts`).
 *
 * It stays local even with an account, unlike progress: it's the exercise's
 * scratchpad, not a result to show off, and it's rebuilt in a few sessions on
 * any new device. Signing out clears it, so two people on one device don't
 * inherit each other's weak points.
 */

export type AllItemStats = Record<string, ItemStats>;

const STORAGE_KEY = "etude:practice-items";
const EMPTY: AllItemStats = {};
const NO_ITEMS: ItemStats = {};

let cached: AllItemStats | null = null;
const listeners = new Set<() => void>();

function read(): AllItemStats {
  if (cached) return cached;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cached = raw ? (JSON.parse(raw) as AllItemStats) : {};
  } catch {
    cached = {};
  }
  return cached ?? EMPTY;
}

function write(next: AllItemStats) {
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* no storage available */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The items of one exercise; a stable empty object when there are none. */
export function itemsOf(exerciseId: string): ItemStats {
  return read()[exerciseId] ?? NO_ITEMS;
}

/**
 * The next question of an exercise, weighted by its record. Read outside of
 * React on purpose: it's called when the user asks for the next question, so
 * it should see what was just answered, not what the last render saw.
 */
export function nextItem<T>(exerciseId: string, pool: readonly T[], keyOf: (item: T) => string, prev?: T): T {
  return chooseItem(pool, keyOf, itemsOf(exerciseId), {
    now: Date.now(),
    exclude: prev === undefined ? undefined : keyOf(prev),
  });
}

export function recordItem(exerciseId: string, itemId: string, correct: boolean, now = Date.now()) {
  const all = read();
  const items = all[exerciseId] ?? {};
  write({ ...all, [exerciseId]: { ...items, [itemId]: applyAnswer(items[itemId], correct, now) } });
}

export function clearItemStats() {
  write({});
}

export function useItemStats(exerciseId: string): ItemStats {
  return useSyncExternalStore(
    subscribe,
    () => read()[exerciseId] ?? NO_ITEMS,
    () => NO_ITEMS,
  );
}

/** The weak points across every exercise, worst first. */
export function useWeakItems(limit = 6): WeakItem[] {
  const all = useSyncExternalStore(subscribe, read, () => EMPTY);
  return weakest(all, limit);
}
