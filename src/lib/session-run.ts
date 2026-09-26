"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SessionStep } from "@/lib/agenda";

/**
 * The clock of a study session: which step is on, how far into it, and
 * whether it's running. Kept in localStorage so a reload (or a wander to the
 * score and back) picks the session up where it was, and cleared when the
 * session ends.
 *
 * Elapsed time is wall-clock arithmetic (`startedAt` plus what was banked
 * before the last pause), not a counter: a throttled background tab still
 * ends the step on time.
 */
export interface RunState {
  index: number;
  /** Milliseconds banked in the current step before `startedAt`. */
  elapsed: number;
  /** Epoch ms when the current stretch started; null while paused. */
  startedAt: number | null;
  finished: boolean;
}

const key = (scoreId: string, day: string) => `etude:session:${scoreId}:${day}`;

export function readRun(scoreId: string, day: string): RunState | null {
  try {
    const raw = localStorage.getItem(key(scoreId, day));
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<RunState>;
    if (typeof s.index !== "number" || typeof s.elapsed !== "number") return null;
    return { index: s.index, elapsed: s.elapsed, startedAt: typeof s.startedAt === "number" ? s.startedAt : null, finished: !!s.finished };
  } catch {
    return null;
  }
}

function writeRun(scoreId: string, day: string, state: RunState | null) {
  try {
    if (state) localStorage.setItem(key(scoreId, day), JSON.stringify(state));
    else localStorage.removeItem(key(scoreId, day));
  } catch {
    /* no storage available */
  }
}

/** True while a session has been started and not finished: the card offers "continue" instead of "start". */
export const runInProgress = (s: RunState | null) => !!s && !s.finished && (s.index > 0 || s.elapsed > 0 || s.startedAt !== null);

export interface SessionRun {
  state: RunState;
  step: SessionStep | undefined;
  /** Milliseconds into the current step. */
  elapsed: number;
  remaining: number;
  /** 0-1 of the current step. */
  fraction: number;
  /** Minutes done over the whole session, including the current step. */
  minutesDone: number;
  running: boolean;
  start: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  reset: () => void;
}

const TICK_MS = 250;

/* ---------- The clock on show ----------
   The runner that's mounted publishes where its clock is, so the reader can
   float it over the score and the pomodoro can pause it without either one
   reaching into the runner. One at a time: whoever published last. */

export interface SessionClock {
  scoreId: string;
  day: string;
  /** Index of the step on, with the step itself. */
  index: number;
  step: SessionStep | undefined;
  running: boolean;
  /** Started and not finished: worth showing even while paused. */
  active: boolean;
  remaining: number;
  fraction: number;
  pause: () => void;
}

let shown: SessionClock | null = null;
const clockListeners = new Set<() => void>();
const publish = (next: SessionClock | null) => {
  shown = next;
  clockListeners.forEach((l) => l());
};
const subscribeClock = (l: () => void) => {
  clockListeners.add(l);
  return () => {
    clockListeners.delete(l);
  };
};

/** The session clock on show, if any runner is mounted. */
export const useSessionClock = () =>
  useSyncExternalStore(
    subscribeClock,
    () => shown,
    () => null,
  );

/** Pauses the session on show: two clocks running at once would count the same minutes twice. */
export const pauseSessionClock = () => shown?.pause();

export function useSessionRun(
  scoreId: string,
  day: string,
  steps: SessionStep[],
  events: { onStepEnd?: (step: SessionStep, last: boolean) => void; onFinish?: () => void } = {},
): SessionRun {
  const [state, setState] = useState<RunState>(() => readRun(scoreId, day) ?? { index: 0, elapsed: 0, startedAt: null, finished: false });
  const [now, setNow] = useState(() => Date.now());
  // latest callbacks, read from the interval without restarting it
  const handlers = useRef(events);
  useEffect(() => {
    handlers.current = events;
  });

  useEffect(() => writeRun(scoreId, day, state.finished ? null : state), [scoreId, day, state]);

  const step = steps[state.index];
  const stepMs = (step?.minutes ?? 0) * 60_000;
  const running = state.startedAt !== null && !state.finished;
  const elapsed = Math.min(stepMs, state.elapsed + (state.startedAt !== null ? Math.max(0, now - state.startedAt) : 0));

  // the clock: ticks while running, and closes the step when its time is up
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      setState((s) => {
        if (s.startedAt === null || s.finished) return s;
        const done = s.elapsed + (t - s.startedAt);
        const current = steps[s.index];
        if (!current || done < current.minutes * 60_000) return s;
        const last = s.index >= steps.length - 1;
        // a chime that fails (no audio, a browser quirk) must not stop the clock
        try {
          handlers.current.onStepEnd?.(current, last);
        } catch (e) {
          console.warn("session step chime:", e);
        }
        if (last) {
          handlers.current.onFinish?.();
          return { ...s, elapsed: current.minutes * 60_000, startedAt: null, finished: true };
        }
        return { index: s.index + 1, elapsed: 0, startedAt: t, finished: false };
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, steps]);

  const start = useCallback(() => {
    setNow(Date.now());
    setState((s) => (s.finished ? { index: 0, elapsed: 0, startedAt: Date.now(), finished: false } : { ...s, startedAt: Date.now() }));
  }, []);
  const pause = useCallback(() => {
    setState((s) => (s.startedAt === null ? s : { ...s, elapsed: s.elapsed + (Date.now() - s.startedAt), startedAt: null }));
  }, []);
  const goTo = useCallback(
    (index: number) => {
      const i = Math.max(0, Math.min(steps.length - 1, index));
      setNow(Date.now());
      setState((s) => ({ index: i, elapsed: 0, startedAt: s.startedAt === null ? null : Date.now(), finished: false }));
    },
    [steps.length],
  );
  const next = useCallback(() => {
    setState((s) => {
      if (s.index >= steps.length - 1) {
        handlers.current.onFinish?.();
        return { ...s, startedAt: null, finished: true };
      }
      return { index: s.index + 1, elapsed: 0, startedAt: s.startedAt === null ? null : Date.now(), finished: false };
    });
  }, [steps.length]);
  const prev = useCallback(() => goTo(state.index - 1), [goTo, state.index]);
  const reset = useCallback(() => setState({ index: 0, elapsed: 0, startedAt: null, finished: false }), []);

  const remaining = Math.max(0, stepMs - elapsed);
  const fraction = stepMs ? elapsed / stepMs : 0;
  const active = runInProgress(state);
  useEffect(() => {
    // only when something visible changes: the ticks come every 250 ms, the clock reads in seconds
    const same =
      shown &&
      shown.scoreId === scoreId &&
      shown.day === day &&
      shown.index === state.index &&
      shown.running === running &&
      shown.active === active &&
      Math.ceil(shown.remaining / 1000) === Math.ceil(remaining / 1000);
    if (!same) publish({ scoreId, day, index: state.index, step, running, active, remaining, fraction, pause });
  });
  useEffect(
    () => () => {
      if (shown?.scoreId === scoreId && shown.day === day) publish(null);
    },
    [scoreId, day],
  );

  const before = steps.slice(0, state.index).reduce((n, s) => n + s.minutes, 0);
  return {
    state,
    step,
    elapsed,
    remaining,
    fraction,
    minutesDone: state.finished ? steps.reduce((n, s) => n + s.minutes, 0) : before + elapsed / 60_000,
    running,
    start,
    pause,
    next,
    prev,
    goTo,
    reset,
  };
}

/** "12:05" from milliseconds, rounded up so the last second reads 0:01, not 0:00. */
export function clock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
