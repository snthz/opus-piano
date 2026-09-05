"use client";

import { useEffect } from "react";
import { refreshUser } from "@/lib/auth";
import { flushQueue, syncProgress } from "@/lib/progress";
import { syncScores } from "@/lib/scores-sync";

/** Comprueba la sesión y sincroniza progreso y biblioteca al arrancar y cada vez que vuelve la conexión. */
export function ProgressSync() {
  useEffect(() => {
    void refreshUser().then(() => Promise.all([syncProgress(), syncScores()]));
    const onOnline = () => void flushQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
  return null;
}
