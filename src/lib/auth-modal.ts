"use client";

import { useSyncExternalStore } from "react";

/** Estado global del modal de acceso: cualquier botón de la app puede abrirlo. */
export type AuthMode = "login" | "register";

let open: AuthMode | null = null;
const listeners = new Set<() => void>();

export function openAuthModal(mode: AuthMode = "login") {
  open = mode;
  listeners.forEach((l) => l());
}

export function closeAuthModal() {
  open = null;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useAuthModal(): AuthMode | null {
  return useSyncExternalStore(subscribe, () => open, () => null);
}
