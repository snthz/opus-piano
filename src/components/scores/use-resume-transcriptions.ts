"use client";

import { useEffect } from "react";
import { getJob, startJob } from "@/lib/jobs";
import { followTranscription, listTranscriptions } from "@/lib/omr/client";
import { listScores } from "@/lib/scores-db";

/**
 * Recoge los reconocimientos que se quedaron en el servidor.
 *
 * Reconocer una partitura son minutos, y lo normal es irse a otra cosa
 * mientras tanto. Al volver a la biblioteca —da igual si es otro día u otro
 * dispositivo— se pregunta qué hay encargado y se vuelve a enganchar cada
 * cosa a su partitura, con su anillo de progreso, como si no se hubiera ido
 * nadie.
 *
 * Solo se enganchan los de partituras que están en este dispositivo: el
 * resultado se vincula a una partitura, y sin ella no hay dónde ponerlo.
 */
export function useResumeTranscriptions(): void {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [jobs, scores] = await Promise.all([listTranscriptions(), listScores()]);
      if (cancelled) return;
      for (const job of jobs) {
        const score = scores.find((s) => s.id === job.scoreId);
        // ya hay una tarea para esa partitura: la que la creó, sin ir más lejos
        if (!score || getJob("omr", job.scoreId)) continue;
        startJob(
          "omr",
          { id: score.id, name: score.name },
          ({ signal, report }) =>
            followTranscription(job, {
              onStatus: (label) => report({ label }),
              onProgress: (progress) => report({ progress }),
              signal,
            }),
          "No se pudo reconocer la partitura. Vuelve a intentarlo.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
