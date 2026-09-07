"use client";

import { useSyncExternalStore } from "react";
import { defaultModel, type Provider } from "./models";

/**
 * Configuración de la IA guardada solo en este dispositivo (localStorage):
 * proveedor elegido, una clave por proveedor y el modelo de cada uno. La clave
 * nunca se envía al servidor de Opus Piano; las peticiones van del navegador
 * directamente a OpenAI o Anthropic.
 */
export interface AiConfig {
  provider: Provider;
  keys: Record<Provider, string>;
  models: Record<Provider, string>;
}

const STORAGE_KEY = "etude:ai";
const EMPTY: AiConfig = {
  provider: "openai",
  keys: { openai: "", anthropic: "" },
  models: { openai: defaultModel("openai"), anthropic: defaultModel("anthropic") },
};

let cached: AiConfig | null = null;
const listeners = new Set<() => void>();

function read(): AiConfig {
  if (cached) return cached;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<AiConfig>) : {};
    cached = {
      provider: saved.provider === "anthropic" ? "anthropic" : "openai",
      keys: { ...EMPTY.keys, ...(saved.keys ?? {}) },
      models: { ...EMPTY.models, ...(saved.models ?? {}) },
    };
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function write(next: AiConfig) {
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* sin almacenamiento */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const getAiConfig = read;
export const setProvider = (provider: Provider) => write({ ...read(), provider });
export const setKey = (provider: Provider, key: string) => write({ ...read(), keys: { ...read().keys, [provider]: key.trim() } });
export const setModel = (provider: Provider, model: string) => write({ ...read(), models: { ...read().models, [provider]: model.trim() } });
export const clearAiConfig = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorar */
  }
  cached = null;
  write(EMPTY);
};

export function useAiConfig(): AiConfig {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** Proveedor, clave y modelo activos, listos para hacer una petición. */
export interface AiTarget {
  provider: Provider;
  apiKey: string;
  model: string;
}

export function activeTarget(c: AiConfig): AiTarget {
  return { provider: c.provider, apiKey: c.keys[c.provider], model: c.models[c.provider] };
}

export const isAiReady = (c: AiConfig) => activeTarget(c).apiKey.length > 0 && activeTarget(c).model.length > 0;
