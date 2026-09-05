"use client";

import { useSyncExternalStore } from "react";
import type { NamingSystem } from "@/lib/music/pitch";

export interface Settings {
  /** Sistema de nombres de notas */
  naming: NamingSystem;
  /** Sonido activado */
  sound: boolean;
  /** Volumen 0–1 */
  volume: number;
  /** Mostrar nombres de las teclas en el piano virtual */
  keyLabels: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  naming: "latino",
  sound: true,
  volume: 0.7,
  keyLabels: true,
};

const STORAGE_KEY = "etude:settings";

/* Store externo mínimo: evita setState en efectos y mantiene la hidratación estable. */
let cached: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  if (cached) return cached;
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cached = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    cached = DEFAULT_SETTINGS;
  }
  return cached ?? DEFAULT_SETTINGS;
}

function write(next: Settings) {
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* almacenamiento no disponible */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cached = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function updateSettings(patch: Partial<Settings>) {
  write({ ...read(), ...patch });
}

export function resetSettings() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorar */
  }
  cached = null;
  write(DEFAULT_SETTINGS);
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, read, () => DEFAULT_SETTINGS);
  return { settings, update: updateSettings, reset: resetSettings };
}
