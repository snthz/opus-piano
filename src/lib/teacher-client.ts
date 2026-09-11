"use client";

import { readNdjson } from "@/lib/ndjson";
import { postStream } from "@/lib/plan/client";
import type { NamingSystem } from "@/lib/music/pitch";
import { HISTORY_TURNS, type ChatTurn, type Level } from "@/lib/study-plan";
import { UserError } from "@/lib/user-error";

/**
 * Lado del navegador del profesor general. La respuesta llega palabra a
 * palabra, igual que la del profesor de una partitura; la diferencia es que
 * aquí no hay nada que mandar salvo la conversación.
 */

export async function teacherAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/teacher", { cache: "no-store" });
    if (!res.ok) return false;
    const body = (await res.json()) as { enabled?: boolean };
    return !!body.enabled;
  } catch {
    return false; // sin conexión: el resto de la app sigue funcionando
  }
}

export interface AskTeacherInput {
  naming: NamingSystem;
  /** Por dónde anda el alumno, del ajuste; el profesor ajusta lo que da por sabido. */
  level?: Level;
  /** La conversación hasta ahora, con la pregunta nueva al final. */
  history: ChatTurn[];
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

export async function askGeneralTeacher(input: AskTeacherInput): Promise<void> {
  const res = await postStream(
    "/api/teacher",
    {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naming: input.naming, level: input.level, history: input.history.slice(-HISTORY_TURNS) }),
    },
    input.signal,
  );

  let failure: string | null = null;
  await readNdjson(res, (event) => {
    if (event.type === "delta" && typeof event.text === "string") input.onDelta(event.text);
    else if (event.type === "error") failure = typeof event.message === "string" ? event.message : "No se ha podido obtener respuesta.";
  });
  if (failure) throw new UserError(failure);
}
