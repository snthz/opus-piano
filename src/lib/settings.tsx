"use client";

import { useSyncExternalStore } from "react";
import type { NamingSystem } from "@/lib/music/pitch";
import type { Level } from "@/lib/study-plan";
import type { Theme } from "@/lib/theme";

export interface Settings {
  /** Sistema de nombres de notas */
  naming: NamingSystem;
  /**
   * Mostrar también el otro sistema en pequeño ("do (C)"). Los acordes y casi
   * todo el material que hay fuera vienen en cifrado americano, y así se
   * aprende sin dejar de leer con los nombres de siempre.
   */
  dualNames: boolean;
  /** Sonido activado */
  sound: boolean;
  /** Volumen 0–1 */
  volume: number;
  /** Mostrar nombres de las teclas en el piano virtual */
  keyLabels: boolean;
  /** Tema de la interfaz; "system" sigue al sistema operativo */
  theme: Theme;
  /** Escuchar el teclado MIDI (si el navegador puede); se reconecta solo al abrir la app */
  midi: boolean;
  /** Puerto MIDI elegido; null = todos los conectados */
  midiDevice: string | null;
  /**
   * Por dónde anda el alumno. Es la respuesta por defecto al analizar una
   * partitura y lo que el profesor general da por supuesto al contestar:
   * hasta ahora había que decírselo cada vez, o no se decía nunca.
   */
  level: Level;
  /**
   * La clave con la que se practica por defecto. Quien se atasca con la mano
   * izquierda practica en fa, y no tiene por qué cambiarlo en cada ejercicio.
   */
  defaultClef: "treble" | "bass" | "both";
  /**
   * Manual correction, in milliseconds, on top of the latency the browser
   * reports for the rhythm exercise. Positive = the taps are counted earlier.
   * Headphones, Bluetooth and the microphone each add a delay nobody can
   * measure from here; the exercise offers to set it after a round.
   */
  rhythmOffset: number;
}

export const DEFAULT_SETTINGS: Settings = {
  naming: "latino",
  dualNames: true,
  sound: true,
  volume: 0.7,
  keyLabels: true,
  theme: "system",
  midi: false,
  midiDevice: null,
  level: "principiante",
  defaultClef: "treble",
  rhythmOffset: 0,
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

/** Los ajustes fuera de React (los módulos que no son componentes). */
export function getSettings(): Settings {
  return read();
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
