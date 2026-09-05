"use client";

import { useEffect } from "react";
import { flushQueue, syncProgress } from "@/lib/progress";

/** Sincroniza el progreso al arrancar y cada vez que vuelve la conexión. */
export function ProgressSync() {
  useEffect(() => {
    void syncProgress();
    const onOnline = () => void flushQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
  return null;
}
