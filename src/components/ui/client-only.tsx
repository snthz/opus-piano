"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Renderiza los hijos solo en el cliente, tras la hidratación.
 * Útil para componentes con estado aleatorio (ejercicios) o que dependen de APIs del navegador.
 */
export function ClientOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return mounted ? <>{children}</> : <>{fallback}</>;
}
