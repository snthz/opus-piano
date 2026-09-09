"use client";

import { useSyncExternalStore } from "react";
import type { PlanState } from "@/lib/study-plan";
import type { OmrOutcome } from "@/lib/omr/client";
import { isAbort, UserError } from "@/lib/user-error";

/**
 * Long-running tasks for a score that run in the background: the study plan
 * and score recognition (OMR). Live outside React so closing the panel, or
 * the whole reader, doesn't interrupt them. At most one task per type per
 * score; starting another cancels the previous one.
 *
 * A task here is what *this tab* is doing about the work, which is not always
 * the work itself: recognition happens on the server and survives the tab, so
 * its task is really a watcher that reports progress and, if cancelled, tells
 * the server to stop (see `omr/client.ts`).
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
  /** What it's doing right now, shown next to the progress ring. */
  label: string;
  /** Fraction done (0-1), or null when unknowable (waiting on the model). */
  progress: number | null;
  startedAt: number;
}

type JobOf<K extends JobKind> =
  | (JobBase<K> & { status: "running"; abort: AbortController })
  | (JobBase<K> & { status: "done"; result: JobResult[K] })
  | (JobBase<K> & { status: "error"; error: string });

/** Distributive: plain `Job` is the union of both types, discriminated by `kind`. */
export type Job<K extends JobKind = JobKind> = K extends JobKind ? JobOf<K> : never;

export interface JobContext {
  signal: AbortSignal;
  /** Updates the text and/or progress; whatever isn't passed stays as-is. */
  report: (update: { label?: string; progress?: number | null }) => void;
}

const keyOf = (kind: JobKind, scoreId: string) => `${kind}:${scoreId}`;

const jobs = new Map<string, Job>();
const listeners = new Set<() => void>();
/** Immutable snapshot for useSyncExternalStore: replaced on every change. */
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
 * Starts a task. `run` gets the cancel signal and a way to report progress;
 * its result is kept until dismissed. Cancelling just removes it from the
 * list; an error is kept so the user sees it even with the panel closed.
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
  // only this run may touch its entry; stays quiet if another one replaced it
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
      // only errors meant for the user are shown as-is
      const error = e instanceof UserError ? e.message : fallbackError;
      set<K>({ ...base, status: "error", label: "Ha fallado", progress: null, error });
    });
}

/** Cancels the task if still running; removes it from the list. */
export function cancelJob(kind: JobKind, scoreId: string) {
  const j = jobs.get(keyOf(kind, scoreId));
  if (!j) return;
  if (j.status === "running") j.abort.abort();
  jobs.delete(keyOf(kind, scoreId));
  emit();
}

/** Removes an already-seen result or error. Doesn't touch a running task. */
export function dismissJob(kind: JobKind, scoreId: string) {
  const j = jobs.get(keyOf(kind, scoreId));
  if (!j || j.status === "running") return;
  jobs.delete(keyOf(kind, scoreId));
  emit();
}

/**
 * Subscription outside a hook: notifies immediately with what's there (in
 * case a task finished while the listener wasn't mounted) and on every change.
 */
export function onJobsChange(listener: (all: readonly Job[]) => void): () => void {
  const l = () => listener(snapshot);
  const off = subscribe(l);
  l();
  return off;
}

/** All tasks (running, done, or failed). */
export function useJobs(): readonly Job[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** The task of one type for a score, if any. */
export function useJob<K extends JobKind>(kind: K, scoreId: string): Job<K> | undefined {
  const all = useJobs();
  return all.find((j) => j.kind === kind && j.scoreId === scoreId) as Job<K> | undefined;
}

// Closing the tab with the study plan half-made would lose it (and the model
// call that paid for it). Recognition is not in the same boat: it's a job the
// server keeps, so leaving costs nothing and only the user can stop it.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (snapshot.some((j) => j.kind === "plan" && j.status === "running")) e.preventDefault();
  });
}
