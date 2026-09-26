"use client";

import { useEffect, useSyncExternalStore } from "react";
import { playChime } from "@/lib/audio/synth";
import { pauseSessionClock } from "@/lib/session-run";
import { getSettings } from "@/lib/settings";

/**
 * A pomodoro for studying at the piano: blocks of focused work with a short
 * break between them and a longer one after a few rounds. One clock for the
 * whole app (a module store), so the panel beside the score and the chip in
 * the reader's toolbar show the same time, and it survives closing the score
 * or reloading: the state lives in localStorage and time is wall-clock
 * arithmetic, not a counter, so a throttled background tab still ends the
 * block on time.
 *
 * When a study block ends the break starts by itself; when the break ends the
 * next block waits for the player to come back and press play.
 */
export type Phase = "focus" | "break" | "long";

export interface PomodoroConfig {
  /** Minutes of each study block. */
  focus: number;
  /** Minutes of the short break. */
  short: number;
  /** Minutes of the long break. */
  long: number;
  /** Study blocks before the long break. */
  rounds: number;
}

export interface PomodoroState {
  phase: Phase;
  /** Study block within the cycle, from 1 to `rounds`. */
  round: number;
  /** Milliseconds banked in the current phase before `startedAt`. */
  elapsed: number;
  /** Epoch ms when the current stretch started; null while paused. */
  startedAt: number | null;
  /** Study blocks completed since the last reset. */
  done: number;
}

export const DEFAULT_CONFIG: PomodoroConfig = { focus: 25, short: 5, long: 15, rounds: 4 };
export const CONFIG_LIMITS: Record<keyof PomodoroConfig, { min: number; max: number; step: number }> = {
  focus: { min: 5, max: 90, step: 5 },
  short: { min: 1, max: 30, step: 1 },
  long: { min: 5, max: 60, step: 5 },
  rounds: { min: 2, max: 8, step: 1 },
};

export const PHASE_LABELS: Record<Phase, string> = { focus: "Estudio", break: "Descanso", long: "Descanso largo" };

const IDLE: PomodoroState = { phase: "focus", round: 1, elapsed: 0, startedAt: null, done: 0 };
const STATE_KEY = "etude:pomodoro";
const CONFIG_KEY = "etude:pomodoro:config";
const TICK_MS = 250;

/* ---------- Store ---------- */

interface Snapshot {
  state: PomodoroState;
  config: PomodoroConfig;
  now: number;
}

let snap: Snapshot | null = null;
const listeners = new Set<() => void>();
const SERVER: Snapshot = { state: IDLE, config: DEFAULT_CONFIG, now: 0 };

function readState(): PomodoroState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return IDLE;
    const s = JSON.parse(raw) as Partial<PomodoroState>;
    if (typeof s.elapsed !== "number" || typeof s.round !== "number") return IDLE;
    const phase: Phase = s.phase === "break" || s.phase === "long" ? s.phase : "focus";
    return { phase, round: s.round, elapsed: s.elapsed, startedAt: typeof s.startedAt === "number" ? s.startedAt : null, done: s.done ?? 0 };
  } catch {
    return IDLE;
  }
}

function readConfig(): PomodoroConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const c = raw ? (JSON.parse(raw) as Partial<PomodoroConfig>) : {};
    const out = { ...DEFAULT_CONFIG };
    for (const k of Object.keys(CONFIG_LIMITS) as (keyof PomodoroConfig)[]) {
      const v = c[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.min(CONFIG_LIMITS[k].max, Math.max(CONFIG_LIMITS[k].min, Math.round(v)));
    }
    return out;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function read(): Snapshot {
  if (snap) return snap;
  if (typeof window === "undefined") return SERVER;
  snap = { state: readState(), config: readConfig(), now: Date.now() };
  return snap;
}

function notify() {
  listeners.forEach((l) => l());
}

function commit(state: PomodoroState) {
  const cur = read();
  snap = { ...cur, state, now: Date.now() };
  try {
    if (state === IDLE) localStorage.removeItem(STATE_KEY);
    else localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* no storage available */
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const phaseMinutes = (phase: Phase, c: PomodoroConfig) => (phase === "focus" ? c.focus : phase === "break" ? c.short : c.long);

/** Whether a break follows this focus block (else the long one). */
const afterFocus = (s: PomodoroState, c: PomodoroConfig): PomodoroState => ({
  phase: s.round >= c.rounds ? "long" : "break",
  round: s.round,
  elapsed: 0,
  startedAt: Date.now(),
  done: s.done + 1,
});

/** The next study block, waiting to be started. */
const afterBreak = (s: PomodoroState): PomodoroState => ({
  phase: "focus",
  round: s.phase === "long" ? 1 : s.round + 1,
  elapsed: 0,
  startedAt: null,
  done: s.done,
});

function ring() {
  const settings = getSettings();
  if (settings.sound) {
    try {
      playChime(settings.volume * 0.8);
    } catch {
      /* no audio context yet */
    }
  }
  try {
    navigator.vibrate?.([180, 80, 180]);
  } catch {
    /* not supported */
  }
}

/** Advances the clock: refreshes `now` and closes the phase when its time is up. */
function tick() {
  const { state: s, config: c } = read();
  if (s.startedAt === null) return;
  const now = Date.now();
  const done = s.elapsed + Math.max(0, now - s.startedAt);
  if (done < phaseMinutes(s.phase, c) * 60_000) {
    snap = { ...read(), now };
    notify();
    return;
  }
  ring();
  commit(s.phase === "focus" ? afterFocus(s, c) : afterBreak(s));
}

export const pomodoro = {
  /** Current state and times, for code outside React (and tests). */
  state: () => read().state,
  config: () => read().config,
  /** Pauses the study session if one is running: only one clock counts at a time. */
  start() {
    const { state: s } = read();
    if (s.startedAt !== null) return;
    pauseSessionClock();
    commit({ ...s, startedAt: Date.now() });
  },
  pause() {
    const { state: s } = read();
    if (s.startedAt === null) return;
    commit({ ...s, elapsed: s.elapsed + (Date.now() - s.startedAt), startedAt: null });
  },
  /** Ends the current phase now; a skipped break leads straight into the next block, paused. */
  skip() {
    const { state: s, config: c } = read();
    commit(s.phase === "focus" ? { ...afterFocus(s, c), done: s.done } : afterBreak(s));
  },
  reset() {
    commit(IDLE);
  },
  setConfig(patch: Partial<PomodoroConfig>) {
    const cur = read();
    const config = { ...cur.config };
    for (const k of Object.keys(patch) as (keyof PomodoroConfig)[]) {
      const v = patch[k];
      if (typeof v === "number") config[k] = Math.min(CONFIG_LIMITS[k].max, Math.max(CONFIG_LIMITS[k].min, Math.round(v)));
    }
    snap = { ...cur, config, now: Date.now() };
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch {
      /* no storage available */
    }
    notify();
  },
};

/* ---------- Hook ---------- */

export interface Pomodoro {
  state: PomodoroState;
  config: PomodoroConfig;
  running: boolean;
  /** True once the clock has been touched: shown in the toolbar until reset. */
  active: boolean;
  /** Milliseconds left in the current phase. */
  remaining: number;
  /** 0-1 of the current phase. */
  fraction: number;
  start: () => void;
  pause: () => void;
  skip: () => void;
  reset: () => void;
  setConfig: (patch: Partial<PomodoroConfig>) => void;
}

export function usePomodoro(): Pomodoro {
  const { state, config, now } = useSyncExternalStore(subscribe, read, () => SERVER);
  const running = state.startedAt !== null;

  // every mounted hook ticks: `tick` only closes a phase once, so a second
  // clock costs nothing and the chime never doubles
  useEffect(() => {
    if (!running) return;
    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  const total = phaseMinutes(state.phase, config) * 60_000;
  const elapsed = Math.min(total, state.elapsed + (state.startedAt !== null ? Math.max(0, now - state.startedAt) : 0));
  return {
    state,
    config,
    running,
    active: running || state.elapsed > 0 || state.phase !== "focus" || state.round > 1 || state.done > 0,
    remaining: Math.max(0, total - elapsed),
    fraction: total ? elapsed / total : 0,
    start: pomodoro.start,
    pause: pomodoro.pause,
    skip: pomodoro.skip,
    reset: pomodoro.reset,
    setConfig: pomodoro.setConfig,
  };
}
