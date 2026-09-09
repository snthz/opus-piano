"use client";

import { useSyncExternalStore } from "react";

/**
 * Qué lecciones ha abierto ya el usuario, para que la ruta de aprendizaje
 * sepa por dónde va.
 *
 * Vive solo en este dispositivo, a diferencia del progreso de los ejercicios,
 * que sí sube a la cuenta. Es a propósito: esto no es un dato del alumno sino
 * una pista para ordenar la ruta, y no vale una tabla, una migración y un
 * endpoint. Si se pierde, la ruta vuelve a sugerir una lección ya leída y no
 * pasa nada más.
 *
 * Se marca al abrir la lección, no al terminarla: no hay forma honesta de
 * saber que alguien ha leído algo, y la alternativa —un botón de «hecho»—
 * pide trabajo para dar lo mismo.
 */

const STORAGE_KEY = "etude:lessons-read";
const EMPTY: readonly string[] = [];

let cached: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  if (cached) return cached;
  if (typeof window === "undefined") return cached ?? [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cached = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    cached = [];
  }
  return cached;
}

export function markLessonRead(slug: string): void {
  const current = read();
  if (current.includes(slug)) return;
  cached = [...current, slug];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    /* sin almacenamiento: la ruta seguirá funcionando, solo que sin memoria */
  }
  listeners.forEach((l) => l());
}

export function clearLessonsRead(): void {
  cached = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nada que borrar */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Los slugs de las lecciones ya abiertas. En el servidor, ninguna. */
export function useLessonsRead(): readonly string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
