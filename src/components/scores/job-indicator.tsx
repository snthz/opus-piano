"use client";

import type { Job } from "@/lib/jobs";
import { ProgressRing } from "@/components/ui/progress-ring";

const KIND_LABEL = { omr: "Reconocimiento", plan: "Plan de estudio" } as const;

/** Cómo se llama cada tarea de cara al usuario. */
export const jobLabel = (kind: Job["kind"]) => KIND_LABEL[kind];

/** Texto corto de la tarea para un título o un lector de pantalla. */
export function describeJob(job: Job): string {
  const what = KIND_LABEL[job.kind];
  if (job.status === "done") return `${what} lista. Toca para verla.`;
  if (job.status === "error") return `${what}: ${job.error}`;
  const pct = job.progress === null ? "" : ` ${Math.round(job.progress * 100)} %`;
  return `${what} en marcha${pct}: ${job.label}`;
}

/**
 * Botón circular con el anillo de progreso de una tarea de IA que corre en
 * segundo plano. Pulsarlo abre el panel correspondiente.
 */
export function JobIndicator({ job, onOpen, className = "w-9 h-9" }: { job: Job; onOpen: () => void; className?: string }) {
  const tone = job.status === "done" ? "bg-ok-soft text-ok" : job.status === "error" ? "bg-bad-soft text-bad" : "bg-surface text-ink";
  return (
    <button
      type="button"
      onClick={onOpen}
      title={describeJob(job)}
      aria-label={describeJob(job)}
      className={`relative shrink-0 rounded-full grid place-items-center ${tone} ${className}`}
    >
      <ProgressRing progress={job.progress} status={job.status} className="w-full h-full p-0.5" />
    </button>
  );
}
