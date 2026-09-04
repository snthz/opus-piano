/**
 * Motor de audio con Web Audio API: piano sintetizado, metrónomo y secuenciador.
 * No usa muestras externas, así funciona sin conexión.
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

/** Debe llamarse desde un gesto del usuario (click/touch) para desbloquear el audio en iOS. */
export async function unlockAudio(): Promise<void> {
  const c = getAudioContext();
  if (c.state !== "running") await c.resume();
}

export function setMasterVolume(v: number) {
  getAudioContext();
  master!.gain.value = Math.max(0, Math.min(1, v));
}

const HARMONICS: [number, number][] = [
  // [múltiplo de la fundamental, amplitud relativa]
  [1, 1],
  [2, 0.5],
  [3, 0.25],
  [4, 0.12],
  [5, 0.06],
  [6, 0.03],
];

export interface NoteOptions {
  /** Duración en segundos */
  duration?: number;
  /** 0–1 */
  velocity?: number;
  /** Tiempo absoluto del AudioContext en el que empieza */
  when?: number;
}

/** Toca una nota MIDI con un timbre parecido a un piano. Devuelve una función para apagarla antes. */
export function playNote(midi: number, opts: NoteOptions = {}): () => void {
  const c = getAudioContext();
  const when = opts.when ?? c.currentTime;
  const duration = opts.duration ?? 1;
  const velocity = opts.velocity ?? 0.8;
  const freq = midiToFrequency(midi);

  const env = c.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(velocity, when + 0.005);
  // Decaimiento natural del piano: rápido al principio, largo después.
  env.gain.exponentialRampToValueAtTime(velocity * 0.4, when + 0.25);
  env.gain.exponentialRampToValueAtTime(Math.max(velocity * 0.08, 0.0005), when + Math.max(duration, 0.3));
  env.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(duration, 0.3) + 0.25);

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  // Las notas agudas son más brillantes; las graves, más opacas.
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
    // Pequeña inarmonicidad, como las cuerdas reales.
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
        /* ya detenido */
      }
    }
  };
}

export function playChord(midis: number[], opts: NoteOptions = {}) {
  const stops = midis.map((m) => playNote(m, opts));
  return () => stops.forEach((s) => s());
}

/** Clic de metrónomo. `accent` = primer tiempo del compás. */
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
  /** Pulsos por compás (para acentuar el primero). 0 = sin acento. */
  beatsPerBar: number;
  /** Subdivisiones por pulso que se marcan con un clic más suave (1 = ninguna). */
  subdivision?: number;
  onBeat?: (beat: number, subdivision: number, time: number) => void;
}

/**
 * Metrónomo con planificación anticipada (lookahead), estable aunque el hilo principal se ocupe.
 */
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
      if (isMainBeat) playClick(this.nextTime, accent);
      else this.playSubClick(this.nextTime);
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
  /** Notas MIDI (vacío = silencio) */
  midis: number[];
  /** Duración en negras */
  beats: number;
}

export interface PlaybackHandle {
  stop: () => void;
  /** Promesa que se resuelve al terminar (o al detener) */
  done: Promise<void>;
}

/**
 * Reproduce una secuencia de eventos a un tempo dado.
 * `onEvent(index)` se llama cuando empieza cada evento (para resaltar la nota en pantalla).
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
    stop: () => {
      stopped = true;
      timeouts.forEach((id) => window.clearTimeout(id));
      stops.forEach((s) => s());
      opts.onEvent?.(-1);
      resolveDone();
    },
  };
}
