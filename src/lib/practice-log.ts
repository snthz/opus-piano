"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { practiceCounts, type PracticeLog } from "@/lib/agenda";
import { micSupported, startListening, type Listener } from "@/lib/audio/listen";
import { getScore, listScores, onScoresChange, recordPractice, type ScoreRecord } from "@/lib/scores-db";

/**
 * Proof that a study session happened, not just that it was ticked.
 *
 * While the session clock runs, the tracker counts the seconds it runs with
 * the app on screen; with the microphone on, it also counts the seconds the
 * piano is sounding. Nothing is recorded — the listener only notices note
 * attacks and forgets them. The day's totals go with the score's plan, so
 * they sync like the rest of it, and `practiceCounts` (in `agenda.ts`) says
 * whether they're enough for the day to join the streak.
 */

const TICK_MS = 1000;
/** A tick further apart than this means the device slept: that time didn't happen at the piano. */
const MAX_STEP = 2000;
/** An attack keeps "playing" on for this long: the notes of a phrase aren't back to back. */
const SOUND_HOLD = 4000;
/** How often a running session writes its totals to the plan (and so to the account). */
const SAVE_EVERY = 60_000;
const MIC_KEY = "etude:practice-mic";
const draftKey = (scoreId: string, day: string) => `etude:practice:${scoreId}:${day}`;

const ZERO: PracticeLog = { clock: 0, heard: 0, playing: 0, target: 0 };

function readDraft(scoreId: string, day: string): PracticeLog | null {
  try {
    const raw = localStorage.getItem(draftKey(scoreId, day));
    const d = raw ? (JSON.parse(raw) as Partial<PracticeLog>) : null;
    if (!d || typeof d.clock !== "number") return null;
    return { clock: d.clock, heard: d.heard ?? 0, playing: d.playing ?? 0, target: d.target ?? 0 };
  } catch {
    return null;
  }
}

function writeDraft(scoreId: string, day: string, log: PracticeLog) {
  try {
    localStorage.setItem(draftKey(scoreId, day), JSON.stringify(log));
  } catch {
    /* no storage available */
  }
}

/** Whole seconds, for the plan: the schema takes integers. */
const whole = (l: PracticeLog): PracticeLog => ({
  clock: Math.round(l.clock),
  heard: Math.round(l.heard),
  playing: Math.round(l.playing),
  target: Math.round(l.target),
});

/** The same day seen from two places (this device, the account): each keeps its furthest count. */
const furthest = (a: PracticeLog, b: PracticeLog): PracticeLog => ({
  clock: Math.max(a.clock, b.clock),
  heard: Math.max(a.heard, b.heard),
  playing: Math.max(a.playing, b.playing),
  target: Math.max(a.target, b.target),
});

/* The microphone preference: one for the app, read without a hydration mismatch. */
const micListeners = new Set<() => void>();
function readMicPref(): boolean {
  try {
    return localStorage.getItem(MIC_KEY) === "1" && micSupported();
  } catch {
    return false;
  }
}
function writeMicPref(on: boolean) {
  try {
    localStorage.setItem(MIC_KEY, on ? "1" : "0");
  } catch {
    /* no storage available */
  }
  micListeners.forEach((l) => l());
}
const subscribeMic = (l: () => void) => {
  micListeners.add(l);
  return () => {
    micListeners.delete(l);
  };
};

export interface PracticeTracker {
  /** The day's totals so far, in seconds. */
  log: PracticeLog;
  /** Enough for the streak. */
  counts: boolean;
  /** The student wants the microphone listening while the clock runs. */
  mic: boolean;
  setMic: (on: boolean) => void;
  /** It's actually listening right now. */
  listening: boolean;
  micError: string | null;
  micAvailable: boolean;
}

/**
 * Counts a session's real time while `running`. Lives beside the session
 * clock (`useSessionRun`) rather than in it: the clock says where the session
 * is, this says whether it happened.
 */
export function usePracticeTracker(scoreId: string, day: string, targetMinutes: number, running: boolean): PracticeTracker {
  const log = useRef<PracticeLog>(ZERO);
  const [shown, setShown] = useState<PracticeLog>(ZERO);
  const mic = useSyncExternalStore(subscribeMic, readMicPref, () => false);
  const micAvailable = useSyncExternalStore(subscribeMic, micSupported, () => false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const listener = useRef<Listener | null>(null);
  const lastSound = useRef(0);
  const dirty = useRef(false);

  // the day's totals so far: this device's draft, and what the account already has
  useEffect(() => {
    let cancelled = false;
    log.current = { ...(readDraft(scoreId, day) ?? ZERO), target: targetMinutes * 60 };
    setShown(log.current);
    void getScore(scoreId).then((rec) => {
      const saved = rec?.plan?.schedule?.practiced?.[day];
      if (cancelled || !saved) return;
      log.current = { ...furthest(log.current, saved), target: targetMinutes * 60 };
      setShown(log.current);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreId, day]);

  useEffect(() => {
    log.current = { ...log.current, target: targetMinutes * 60 };
  }, [targetMinutes]);

  // the clock: only while the session runs and the app is on screen
  useEffect(() => {
    if (!running) return;
    const save = () => {
      if (!dirty.current) return;
      dirty.current = false;
      void recordPractice(scoreId, day, whole(log.current));
    };
    let last = Date.now();
    let lastSave = last;
    const id = window.setInterval(() => {
      const now = Date.now();
      const dt = Math.min(MAX_STEP, now - last) / 1000;
      last = now;
      if (document.visibilityState !== "visible") return;
      const l = { ...log.current, clock: log.current.clock + dt };
      if (listener.current) {
        l.heard += dt;
        if (now - lastSound.current < SOUND_HOLD) l.playing += dt;
      }
      log.current = l;
      dirty.current = true;
      writeDraft(scoreId, day, l);
      setShown(l);
      if (now - lastSave >= SAVE_EVERY) {
        lastSave = now;
        save();
      }
    }, TICK_MS);
    return () => {
      window.clearInterval(id);
      // pausing, finishing or leaving: what was counted goes to the plan now
      save();
    };
  }, [running, scoreId, day]);

  // the microphone: only with the clock running, so a paused session isn't listened to
  useEffect(() => {
    if (!running || !mic) return;
    let cancelled = false;
    startListening({ onOnset: () => (lastSound.current = Date.now()) })
      .then((l) => {
        if (cancelled) return l.stop();
        listener.current = l;
        setListening(true);
        setMicError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setMicError(e instanceof Error ? e.message : "No se pudo usar el micrófono.");
        writeMicPref(false);
      });
    return () => {
      cancelled = true;
      listener.current?.stop();
      listener.current = null;
      setListening(false);
    };
  }, [running, mic]);

  const setMic = (on: boolean) => {
    setMicError(null);
    writeMicPref(on);
  };

  return {
    log: shown,
    counts: practiceCounts(whole(shown)),
    mic,
    setMic,
    listening,
    micError,
    micAvailable,
  };
}

/* ---------- Days of study, for the streak ---------- */

const DAYS_KEY = "etude:study-days";
const EMPTY = new Set<string>();

/** Per score, the days whose log counts. */
const byScore = new Map<string, string[]>();
let days: Set<string> | null = null;
let started = false;
const listeners = new Set<() => void>();

const countedDays = (rec: ScoreRecord | undefined) =>
  Object.entries(rec?.plan?.schedule?.practiced ?? {})
    .filter(([, l]) => practiceCounts(l))
    .map(([d]) => d);

function publish() {
  const next = new Set<string>();
  for (const list of byScore.values()) for (const d of list) next.add(d);
  days = next;
  try {
    localStorage.setItem(DAYS_KEY, JSON.stringify([...next]));
  } catch {
    /* no storage available */
  }
  listeners.forEach((l) => l());
}

/** Scores that changed, re-read a moment later: annotations save on every stroke. */
const stale = new Set<string>();
let staleTimer: number | null = null;
function refresh(id: string) {
  stale.add(id);
  if (staleTimer) window.clearTimeout(staleTimer);
  staleTimer = window.setTimeout(async () => {
    staleTimer = null;
    const ids = [...stale];
    stale.clear();
    for (const i of ids) {
      const list = countedDays(await getScore(i));
      if (list.length) byScore.set(i, list);
      else byScore.delete(i);
    }
    publish();
  }, 1500);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void listScores()
    .then((all) => {
      byScore.clear();
      for (const rec of all) {
        const list = countedDays(rec);
        if (list.length) byScore.set(rec.id, list);
      }
      publish();
    })
    .catch(() => {});
  onScoresChange((c) => {
    if (c.type === "clear") {
      byScore.clear();
      publish();
    } else if (c.type === "delete") {
      byScore.delete(c.id);
      publish();
    } else {
      refresh(c.id);
    }
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  start();
  return () => {
    listeners.delete(l);
  };
}

function snapshot(): Set<string> {
  if (days) return days;
  try {
    days = new Set(JSON.parse(localStorage.getItem(DAYS_KEY) ?? "[]") as string[]);
  } catch {
    days = new Set();
  }
  return days;
}

/** Days with a session that really happened (`practiceCounts`), across every score. */
export function useStudyDays(): Set<string> {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
