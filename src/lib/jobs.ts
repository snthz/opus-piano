"use client";

import { useSyncExternalStore } from "react";
import type { PlanState } from "@/lib/study-plan";
import type { OmrOutcome } from "@/lib/omr/client";
import { isAbort, UserError } from "@/lib/user-error";

/**
 * Tareas largas de una partitura que corren en segundo plano: el plan de
 * estudio y el reconocimiento de la partitura (OMR). Viven fuera de React para
 * que cerrar el panel, o el lector entero, no las interrumpa: el usuario sigue
 * leyendo la partitura y un anillo de progreso le dice por dónde va. Hay como
 * mucho una tarea de cada tipo por partitura; empezar otra cancela la anterior.
 */
export type JobKind = "omr" | "plan";

interface JobResult {
  omr: OmrOutcome;
  plan: PlanState;
}

interface JobBase<K extends JobKind> {
  kind: K;
  scoreId: string;
  scoreName: string;
  /** Qué está haciendo ahora mismo, para enseñarlo junto al anillo */
  label: string;
  /** Fracción hecha (0 a 1), o null cuando no se puede saber (esperando al modelo) */
  progress: number | null;
  startedAt: number;
}

type JobOf<K extends JobKind> =
  | (JobBase<K> & { status: "running"; abort: AbortController })
  | (JobBase<K> & { status: "done"; result: JobResult[K] })
  | (JobBase<K> & { status: "error"; error: string });

/** Distributiva: `Job` a secas es la unión de los dos tipos, discriminada por `kind`. */
export type Job<K extends JobKind = JobKind> = K extends JobKind ? JobOf<K> : never;

export interface JobContext {
  signal: AbortSignal;
  /** Actualiza el texto y/o el progreso; lo que no se pasa se conserva */
  report: (update: { label?: string; progress?: number | null }) => void;
}

const keyOf = (kind: JobKind, scoreId: string) => `${kind}:${scoreId}`;

const jobs = new Map<string, Job>();
const listeners = new Set<() => void>();
/** Instantánea inmutable para useSyncExternalStore: se sustituye en cada cambio. */
let snapshot: readonly Job[] = [];
const EMPTY: readonly Job[] = [];

function emit() {
  snapshot = Array.from(jobs.values());
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => EMPTY;

function set<K extends JobKind>(job: JobOf<K>) {
  jobs.set(keyOf(job.kind, job.scoreId), job as Job);
  emit();
}

export const getJob = <K extends JobKind>(kind: K, scoreId: string) => jobs.get(keyOf(kind, scoreId)) as Job<K> | undefined;

/**
 * Lanza una tarea. `run` recibe la señal de cancelación y una función para
 * informar del avance; su resultado queda guardado hasta que se descarta.
 * Cancelarla la quita de la lista sin más; un error se conserva para que el
 * usuario lo vea aunque tuviera el panel cerrado.
 */
export function startJob<K extends JobKind>(
  kind: K,
  score: { id: string; name: string },
  run: (ctx: JobContext) => Promise<JobResult[K]>,
  fallbackError: string,
): void {
  cancelJob(kind, score.id);
  const abort = new AbortController();
  const base: JobBase<K> = { kind, scoreId: score.id, scoreName: score.name, label: "Empezando…", progress: 0, startedAt: Date.now() };
  const key = keyOf(kind, score.id);
  const current = () => jobs.get(key) as JobOf<K> | undefined;
  // Solo esta ejecución puede tocar su entrada: si otra la sustituyó, se calla.
  const mine = () => {
    const j = current();
    return j?.status === "running" && j.abort === abort;
  };
  set<K>({ ...base, status: "running", abort });

  const report: JobContext["report"] = (update) => {
    const j = current();
    if (!j || !mine()) return;
    set<K>({ ...j, label: update.label ?? j.label, progress: update.progress === undefined ? j.progress : update.progress });
  };

  run({ signal: abort.signal, report })
    .then((result) => {
      if (!mine()) return;
      set<K>({ ...base, status: "done", label: "Listo", progress: 1, result });
    })
    .catch((e: unknown) => {
      if (!mine()) return;
      if (isAbort(e)) {
        jobs.delete(key);
        emit();
        return;
      }
      // Solo los errores pensados para el usuario se enseñan tal cual.
      const error = e instanceof UserError ? e.message : fallbackError;
      set<K>({ ...base, status: "error", label: "Ha fallado", progress: null, error });
    });
}

/** Cancela la tarea si sigue en marcha; desaparece de la lista. */
export function cancelJob(kind: JobKind, scoreId: string) {
  const j = jobs.get(keyOf(kind, scoreId));
  if (!j) return;
  if (j.status === "running") j.abort.abort();
  jobs.delete(keyOf(kind, scoreId));
  emit();
}

/** Quita un resultado o un error ya atendidos. No toca una tarea en marcha. */
export function dismissJob(kind: JobKind, scoreId: string) {
  const j = jobs.get(keyOf(kind, scoreId));
  if (!j || j.status === "running") return;
  jobs.delete(keyOf(kind, scoreId));
  emit();
}

/**
 * Suscripción fuera de un hook: avisa al momento con lo que hay (por si una
 * tarea acabó mientras quien escucha no estaba montado) y en cada cambio.
 */
export function onJobsChange(listener: (all: readonly Job[]) => void): () => void {
  const l = () => listener(snapshot);
  const off = subscribe(l);
  l();
  return off;
}

/** Todas las tareas (en marcha, listas o fallidas). */
export function useJobs(): readonly Job[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** La tarea de un tipo para una partitura, si existe. */
export function useJob<K extends JobKind>(kind: K, scoreId: string): Job<K> | undefined {
  const all = useJobs();
  return all.find((j) => j.kind === kind && j.scoreId === scoreId) as Job<K> | undefined;
}

// Con una tarea en marcha, cerrar la pestaña la perdería (y el gasto en el proveedor con ella).
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (snapshot.some((j) => j.status === "running")) e.preventDefault();
  });
}
