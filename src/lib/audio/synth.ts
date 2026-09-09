/**
 * Web Audio engine: synthesized piano, metronome, and sequencer. No external
 * samples, so it works offline.
 */
import { midiToFrequency } from "@/lib/music/pitch";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.6;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Must be called from a user gesture (click/touch) to unlock audio on iOS. */
export async function unlockAudio(): Promise<void> {
  const c = getAudioContext();
  if (c.state !== "running") await c.resume();
}

export function setMasterVolume(v: number) {
  getAudioContext();
  master!.gain.value = Math.max(0, Math.min(1, v));
}

const HARMONICS: [number, number][] = [
  // [multiple of the fundamental, relative amplitude]
  [1, 1],
  [2, 0.5],
  [3, 0.25],
  [4, 0.12],
  [5, 0.06],
  [6, 0.03],
];

export interface NoteOptions {
  /** Duration in seconds. */
  duration?: number;
  /** 0-1. */
  velocity?: number;
  /** AudioContext absolute time it starts at. */
  when?: number;
}

/** Plays a MIDI note with a piano-like timbre. Returns a function to stop it early. */
export function playNote(midi: number, opts: NoteOptions = {}): () => void {
  const c = getAudioContext();
  const when = opts.when ?? c.currentTime;
  const duration = opts.duration ?? 1;
  const velocity = opts.velocity ?? 0.8;
  const freq = midiToFrequency(midi);

  const env = c.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(velocity, when + 0.005);
  // natural piano decay: fast at first, long afterward
  env.gain.exponentialRampToValueAtTime(velocity * 0.4, when + 0.25);
  env.gain.exponentialRampToValueAtTime(Math.max(velocity * 0.08, 0.0005), when + Math.max(duration, 0.3));
  env.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(duration, 0.3) + 0.25);

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  // high notes are brighter; low notes are darker
  filter.frequency.setValueAtTime(Math.min(freq * 8, 12000), when);
  filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 2, 400), when + 0.6);

  env.connect(filter).connect(master!);

  const oscs: OscillatorNode[] = [];
  const stopAt = when + Math.max(duration, 0.3) + 0.3;
  for (const [mult, amp] of HARMONICS) {
    const partial = freq * mult;
    if (partial > 18000) continue;
    const osc = c.createOscillator();
    osc.type = mult === 1 ? "triangle" : "sine";
    // slight inharmonicity, like real strings
    osc.frequency.value = partial * (1 + 0.0004 * mult * mult);
    const g = c.createGain();
    g.gain.value = amp / (1 + (midi - 60) / 40);
    osc.connect(g).connect(env);
    osc.start(when);
    osc.stop(stopAt);
    oscs.push(osc);
  }

  return () => {
    const now = c.currentTime;
    env.gain.cancelScheduledValues(now);
    env.gain.setValueAtTime(env.gain.value, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    for (const o of oscs) {
      try {
        o.stop(now + 0.15);
      } catch {
        /* already stopped */
      }
    }
  };
}

/** Two rising notes: the end of a study-session step. Softer than the click and clearly not the metronome. */
export function playChime(velocity = 0.5) {
  const c = getAudioContext();
  playNote(79, { when: c.currentTime, duration: 0.35, velocity });
  playNote(84, { when: c.currentTime + 0.18, duration: 0.7, velocity });
}

export function playChord(midis: number[], opts: NoteOptions = {}) {
  const stops = midis.map((m) => playNote(m, opts));
  return () => stops.forEach((s) => s());
}

/** Metronome click. `accent` = first beat of the bar. */
export function playClick(when: number, accent = false) {
  const c = getAudioContext();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "square";
  osc.frequency.value = accent ? 1600 : 1000;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  osc.connect(g).connect(master!);
  osc.start(when);
  osc.stop(when + 0.06);
}

export interface MetronomeOptions {
  bpm: number;
  /** Beats per bar (to accent the first one). 0 = no accent. */
  beatsPerBar: number;
  /** Subdivisions per beat marked with a softer click (1 = none). */
  subdivision?: number;
  /** Marks the beat silently; still fires `onBeat` for a visual pulse. */
  muted?: boolean;
  onBeat?: (beat: number, subdivision: number, time: number) => void;
}

/** Lookahead-scheduled metronome, stable even when the main thread is busy. */
export class Metronome {
  private timer: number | null = null;
  private nextTime = 0;
  private beat = 0;
  private sub = 0;
  private opts: MetronomeOptions;
  running = false;

  constructor(opts: MetronomeOptions) {
    this.opts = opts;
  }

  update(opts: Partial<MetronomeOptions>) {
    this.opts = { ...this.opts, ...opts };
  }

  start(startAt?: number) {
    const c = getAudioContext();
    this.stop();
    this.running = true;
    this.beat = 0;
    this.sub = 0;
    this.nextTime = startAt ?? c.currentTime + 0.05;
    this.schedule();
  }

  stop() {
    this.running = false;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule = () => {
    if (!this.running) return;
    const c = getAudioContext();
    const subdiv = this.opts.subdivision ?? 1;
    const interval = 60 / this.opts.bpm / subdiv;
    while (this.nextTime < c.currentTime + 0.12) {
      const isMainBeat = this.sub === 0;
      const accent = isMainBeat && this.opts.beatsPerBar > 0 && this.beat === 0;
      if (!this.opts.muted) {
        if (isMainBeat) playClick(this.nextTime, accent);
        else this.playSubClick(this.nextTime);
      }
      const t = this.nextTime;
      const b = this.beat;
      const s = this.sub;
      const delay = Math.max(0, (t - c.currentTime) * 1000);
      window.setTimeout(() => this.opts.onBeat?.(b, s, t), delay);
      this.sub = (this.sub + 1) % subdiv;
      if (this.sub === 0) {
        this.beat = this.opts.beatsPerBar > 0 ? (this.beat + 1) % this.opts.beatsPerBar : this.beat + 1;
      }
      this.nextTime += interval;
    }
    this.timer = window.setTimeout(this.schedule, 25);
  };

  private playSubClick(when: number) {
    const c = getAudioContext();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = 800;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.12, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
    osc.connect(g).connect(master!);
    osc.start(when);
    osc.stop(when + 0.04);
  }
}

export interface SequenceEvent {
  /** MIDI notes (empty = rest). */
  midis: number[];
  /** Duration in quarter notes. */
  beats: number;
}

export interface PlaybackHandle {
  stop: () => void;
  /** Resolves when playback finishes (or is stopped). */
  done: Promise<void>;
  /** AudioContext-clock instant the first note starts. */
  startTime: number;
}

/**
 * Plays a sequence of events at a given tempo. `onEvent(index)` fires when
 * each event starts, to highlight the note on screen.
 */
export function playSequence(
  events: SequenceEvent[],
  bpm: number,
  opts: { onEvent?: (index: number) => void; countIn?: number; beatsPerBar?: number; metronome?: boolean } = {},
): PlaybackHandle {
  const c = getAudioContext();
  const beatSec = 60 / bpm;
  const countIn = opts.countIn ?? 0;
  const start = c.currentTime + 0.1 + countIn * beatSec;
  const timeouts: number[] = [];
  const stops: (() => void)[] = [];
  let stopped = false;

  for (let i = 0; i < countIn; i++) {
    playClick(c.currentTime + 0.1 + i * beatSec, i === 0);
  }

  let t = start;
  let totalBeats = 0;
  for (const ev of events) totalBeats += ev.beats;
  if (opts.metronome && opts.beatsPerBar) {
    for (let b = 0; b < Math.ceil(totalBeats); b++) {
      playClick(start + b * beatSec, b % opts.beatsPerBar === 0);
    }
  }

  events.forEach((ev, index) => {
    const when = t;
    const dur = ev.beats * beatSec;
    for (const m of ev.midis) stops.push(playNote(m, { when, duration: dur * 0.95 }));
    const delay = Math.max(0, (when - c.currentTime) * 1000);
    timeouts.push(window.setTimeout(() => !stopped && opts.onEvent?.(index), delay));
    t += dur;
  });

  let resolveDone: () => void = () => {};
  const done = new Promise<void>((res) => (resolveDone = res));
  timeouts.push(
    window.setTimeout(
      () => {
        opts.onEvent?.(-1);
        resolveDone();
      },
      Math.max(0, (t - c.currentTime) * 1000) + 50,
    ),
  );

  return {
    done,
    startTime: start,
    stop: () => {
      stopped = true;
      timeouts.forEach((id) => window.clearTimeout(id));
      stops.forEach((s) => s());
      opts.onEvent?.(-1);
      resolveDone();
    },
  };
}

export interface TimelineNote {
  midis: number[];
  /** Start in quarter notes from the beginning. */
  start: number;
  /** Duration in quarter notes. */
  beats: number;
}

/**
 * Plays notes with independent start times (two hands, overlapping voices).
 * Unlike `playSequence`, each note carries its own start instant instead of
 * chaining off the previous one. `onNote(index)` fires on each note's start,
 * and -1 on finish or stop.
 */
export function playTimeline(
  notes: TimelineNote[],
  bpm: number,
  opts: { onNote?: (index: number) => void; countIn?: number } = {},
): PlaybackHandle {
  const c = getAudioContext();
  const beatSec = 60 / bpm;
  const countIn = opts.countIn ?? 0;
  const start = c.currentTime + 0.1 + countIn * beatSec;
  const timeouts: number[] = [];
  const stops: (() => void)[] = [];
  let stopped = false;

  for (let i = 0; i < countIn; i++) playClick(c.currentTime + 0.1 + i * beatSec, i === 0);

  let end = start;
  notes.forEach((n, index) => {
    const when = start + n.start * beatSec;
    const dur = n.beats * beatSec;
    end = Math.max(end, when + dur);
    for (const m of n.midis) stops.push(playNote(m, { when, duration: dur * 0.95 }));
    timeouts.push(window.setTimeout(() => !stopped && opts.onNote?.(index), Math.max(0, (when - c.currentTime) * 1000)));
  });

  let resolveDone: () => void = () => {};
  const done = new Promise<void>((res) => (resolveDone = res));
  timeouts.push(
    window.setTimeout(
      () => {
        opts.onNote?.(-1);
        resolveDone();
      },
      Math.max(0, (end - c.currentTime) * 1000) + 50,
    ),
  );

  return {
    done,
    startTime: start,
    stop: () => {
      stopped = true;
      timeouts.forEach((id) => window.clearTimeout(id));
      stops.forEach((s) => s());
      opts.onNote?.(-1);
      resolveDone();
    },
  };
}
