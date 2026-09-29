"use client";

import { useSyncExternalStore } from "react";

/**
 * Qué piezas del cuaderno de lectura se han leído ya.
 *
 * `level-progress.ts` guarda estrellas y porcentajes, y aquí no hay ni de lo
 * uno ni de lo otro: el cuaderno es material, se lee en el piano y nadie puede
 * corregirlo desde la pantalla. Lo único que se puede guardar es lo que diga
 * el alumno, así que eso es lo que se guarda: una marca y la fecha.
 *
 * Vive en el dispositivo. Es el punto del libro por el que uno va, no un
 * resultado que enseñar.
 */

const STORAGE_KEY = "etude:reading-book";
const EMPTY: Record<string, number> = {};

let cached: Record<string, number> | null = null;
const listeners = new Set<() => void>();

function read(): Record<string, number> {
  if (cached) return cached;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cached = raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    cached = {};
  }
  return cached ?? EMPTY;
}

function write(next: Record<string, number>) {
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

/** Marca o desmarca una pieza. Devuelve si queda marcada. */
export function toggleMark(id: string, now = Date.now()): boolean {
  const all = read();
  if (all[id]) {
    const rest = { ...all };
    delete rest[id];
    write(rest);
    return false;
  }
  write({ ...all, [id]: now });
  return true;
}

export function clearReadMarks() {
  write({});
}

export function useReadMarks(): Record<string, number> {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Cuántas de estas piezas están marcadas. */
export function countMarked(ids: readonly string[], marks: Record<string, number>): number {
  return ids.reduce((sum, id) => sum + (marks[id] ? 1 : 0), 0);
}
