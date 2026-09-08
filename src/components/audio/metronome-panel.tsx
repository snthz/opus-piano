"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { Metronome, unlockAudio } from "@/lib/audio/synth";
import { TIME_SIGNATURE_BY_ID } from "@/lib/music/meter";
import { useSettings } from "@/lib/settings";
import { TempoPicker, type TempoMark } from "./tempo-picker";

const MIN_BPM = 30;
const MAX_BPM = 240;

const clampBpm = (v: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v)));

/**
 * Beat note value by its duration in quarter notes, as music-font glyphs:
 * eighth, quarter, or dotted quarter. Drawn with Bravura instead of the "♩"
 * character, which every typeface renders differently and looks washed out.
 */
const PULSE_GLYPH: Record<number, { names: string[]; label: string }> = {
  0.5: { names: ["note8thUp"], label: "corchea" },
  1: { names: ["noteQuarterUp"], label: "negra" },
  1.5: { names: ["noteQuarterUp", "augmentationDot"], label: "negra con puntillo" },
};

interface Meter {
  id: string;
  label: string;
  /** Beats per bar; 0 = no accent, every click sounds the same. */
  beats: number;
  /** Accent pattern, one per beat: 1 strong, 0.5 medium, 0 weak. */
  accents: number[];
  /** Beat note value, for the header's "quarter = 90". */
  pulse: { names: string[]; label: string };
  hint: string;
}

/** Time signatures for the picker. Beat/accent data comes from `meter.ts`. */
const METERS: Meter[] = [
  {
    id: "free",
    label: "Libre",
    beats: 0,
    accents: [0],
    pulse: PULSE_GLYPH[1],
    hint: "Un clic por pulso, sin acento de compás.",
  },
  ...["2-4", "3-4", "4-4", "5-4", "6-8", "7-8"].map((id) => {
    const ts = TIME_SIGNATURE_BY_ID[id];
    const pulse = PULSE_GLYPH[ts.beatValue] ?? PULSE_GLYPH[1];
    return {
      id,
      label: `${ts.numerator}/${ts.denominator}`,
      beats: ts.beats,
      accents: ts.accents,
      pulse,
      hint:
        ts.kind === "compuesto"
          ? `${ts.beats} pulsos de ${pulse.label}, de tres corcheas cada uno.`
          : ts.kind === "irregular"
            ? `${ts.beats} pulsos de ${pulse.label} con acentos desiguales.`
            : `${ts.beats} pulsos de ${pulse.label}: el primero, fuerte.`,
    };
  }),
];

const SUBDIVISIONS = [
  { value: 1, label: "Solo el pulso" },
  { value: 2, label: "×2" },
  { value: 3, label: "×3" },
  { value: 4, label: "×4" },
];

/**
 * Italian tempo marks, slowest to fastest. Treatises don't agree on exact
 * figures (an 18th-century allegro was slower than today's), so ranges are
 * contiguous and non-overlapping: any tempo falls in exactly one mark, and
 * the name follows the number as the slider moves.
 */
const TEMPO_MARKS: TempoMark[] = [
  { id: "grave", label: "Grave", min: MIN_BPM, max: 44, bpm: 40, hint: "Muy lento y solemne." },
  { id: "largo", label: "Largo", min: 45, max: 59, bpm: 52, hint: "Lento y amplio." },
  { id: "larghetto", label: "Larghetto", min: 60, max: 65, bpm: 63, hint: "Algo menos lento que el largo." },
  { id: "adagio", label: "Adagio", min: 66, max: 75, bpm: 70, hint: "Con calma, sin prisa." },
  { id: "andante", label: "Andante", min: 76, max: 95, bpm: 84, hint: "Al paso, como quien camina." },
  { id: "andantino", label: "Andantino", min: 96, max: 107, bpm: 100, hint: "Un poco más suelto que el andante." },
  { id: "moderato", label: "Moderato", min: 108, max: 119, bpm: 112, hint: "A media velocidad." },
  { id: "allegretto", label: "Allegretto", min: 120, max: 131, bpm: 126, hint: "Animado, pero menos que el allegro." },
  { id: "allegro", label: "Allegro", min: 132, max: 167, bpm: 144, hint: "Rápido y alegre." },
  { id: "vivace", label: "Vivace", min: 168, max: 175, bpm: 172, hint: "Vivo, con chispa." },
  { id: "presto", label: "Presto", min: 176, max: 199, bpm: 184, hint: "Muy rápido." },
  { id: "prestissimo", label: "Prestissimo", min: 200, max: MAX_BPM, bpm: 208, hint: "Lo más rápido posible." },
];

/** The tempo mark a bpm falls into. Ranges are contiguous, so there's always one. */
function tempoMark(bpm: number): TempoMark {
  return TEMPO_MARKS.find((m) => bpm <= m.max) ?? TEMPO_MARKS[TEMPO_MARKS.length - 1];
}

/**
 * Full metronome: tempo, time signature, and subdivision, with the beat on
 * screen. The `Metronome` engine schedules clicks ahead on the audio clock,
 * so tempo doesn't drift even if the tab is busy. Still works visually-only
 * with sound off in Settings.
 */
export function MetronomePanel() {
  const { settings } = useSettings();
  const [meterId, setMeterId] = useState("4-4");
  const [bpm, setBpm] = useState(90);
  const [subdivision, setSubdivision] = useState(1);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [sub, setSub] = useState(0);
  // changes on every beat: resets the dot's animation (via `key`), since in
  // free meter it's always the same dot and would otherwise stay lit
  const [pulse, setPulse] = useState(0);
  const [bars, setBars] = useState(0);
  const metro = useRef<Metronome | null>(null);
  const taps = useRef<number[]>([]);

  const meter = METERS.find((m) => m.id === meterId) ?? METERS[0];
  const mark = tempoMark(bpm);
  const muted = !settings.sound;

  useEffect(() => () => metro.current?.stop(), []);

  // the engine stays alive across changes: new settings apply on the next
  // beat without cutting off the one currently sounding
  useEffect(() => {
    metro.current?.update({ bpm, beatsPerBar: meter.beats, subdivision, muted });
  }, [bpm, meter.beats, subdivision, muted]);

  const stop = useCallback(() => {
    metro.current?.stop();
    setRunning(false);
    setBeat(-1);
    setSub(0);
  }, []);

  const start = useCallback(async () => {
    // from a user gesture: iOS won't play anything until unlocked
    await unlockAudio();
    metro.current?.stop();
    setBars(0);
    metro.current = new Metronome({
      bpm,
      beatsPerBar: meter.beats,
      subdivision,
      muted,
      onBeat: (b, s) => {
        setBeat(b);
        setSub(s);
        if (s !== 0) return;
        setPulse((p) => p + 1);
        if (b === 0) setBars((n) => n + 1);
      },
    });
    metro.current.start();
    setRunning(true);
  }, [bpm, meter.beats, subdivision, muted]);

  const toggle = useCallback(() => {
    if (running) stop();
    else void start();
  }, [running, start, stop]);

  /** Tap tempo: average of the last taps. A pause over 2.5s starts over. */
  const tapTempo = useCallback(() => {
    const now = performance.now();
    const last = taps.current.at(-1);
    if (last === undefined || now - last > 2500) taps.current = [];
    taps.current.push(now);
    if (taps.current.length > 5) taps.current.shift();
    if (taps.current.length < 2) return;
    const span = now - taps.current[0];
    setBpm(clampBpm(60000 / (span / (taps.current.length - 1))));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // with focus on a control, let the browser handle it; otherwise Space
      // would both click the button and trigger this shortcut
      if ((e.target as HTMLElement | null)?.closest("button, input, select, textarea, a")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.code === "ArrowUp" || e.code === "ArrowRight") {
        e.preventDefault();
        setBpm((b) => clampBpm(b + (e.code === "ArrowRight" ? 5 : 1)));
      } else if (e.code === "ArrowDown" || e.code === "ArrowLeft") {
        e.preventDefault();
        setBpm((b) => clampBpm(b - (e.code === "ArrowLeft" ? 5 : 1)));
      } else if (e.key.toLowerCase() === "t") {
        tapTempo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tapTempo, toggle]);

  return (
    <div className="space-y-3">
      <section className="card p-5 md:p-8">
        <div className="flex items-center justify-center gap-3">
          <GlyphIcon name={meter.pulse.names} size={26} fit="em" className="text-ink-2 shrink-0" label={meter.pulse.label} />
          <span className="text-2xl text-ink-3 leading-none">=</span>
          <span className="text-7xl md:text-8xl font-bold tabular-nums leading-none tracking-tight">{bpm}</span>
        </div>

        {/* the tempo mark is a picker: shows the current mark's name, or pick one to jump to its speed */}
        <div className="mt-5 flex flex-col items-center gap-2">
          <TempoPicker marks={TEMPO_MARKS} value={mark.id} onChange={(m) => setBpm(m.bpm)} />
          <p className="text-sm text-ink-2 text-center">{mark.hint}</p>
        </div>

        {/* beat on screen: one dot per bar beat, the strong one bigger */}
        <div className="mt-8 flex items-end justify-center gap-3 md:gap-4">
          {meter.accents.map((accent, i) => {
            const active = running && (meter.beats === 0 || beat === i);
            const size = accent === 1 ? 42 : accent === 0.5 ? 34 : 28;
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <span
                  // key={pulse}: restarts the bounce every beat, even when the
                  // active dot is always the same one (free meter)
                  key={active ? pulse : "off"}
                  style={{ width: size, height: size, animation: active ? "beat-pop 0.16s ease-out" : undefined }}
                  className={`rounded-full transition-colors duration-75 ${
                    active ? "bg-ink" : accent === 1 ? "bg-ash" : accent === 0.5 ? "bg-surface-3" : "bg-surface-3/70"
                  }`}
                />
                {subdivision > 1 && (
                  <span className="flex gap-1">
                    {Array.from({ length: subdivision }).map((_, s) => (
                      <span
                        key={s}
                        className={`w-1.5 h-1.5 rounded-full transition-colors duration-75 ${
                          active && sub === s ? "bg-ink" : "bg-surface-3"
                        }`}
                      />
                    ))}
                  </span>
                )}
                {meter.beats > 0 && (
                  <span className={`text-[11px] tabular-nums ${active ? "text-ink font-semibold" : "text-ink-3"}`}>{i + 1}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-center gap-6">
          <StepButton label="Bajar el tempo" onPress={() => setBpm((b) => clampBpm(b - 1))}>
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" className="w-5 h-5" aria-hidden>
              <path d="M6 12h12" strokeLinecap="round" />
            </svg>
          </StepButton>

          <button
            type="button"
            onClick={toggle}
            aria-pressed={running}
            aria-label={running ? "Parar el metrónomo" : "Poner en marcha el metrónomo"}
            className="btn-circle w-20 h-20 shadow-lg active:scale-95"
          >
            {running ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden>
                <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 translate-x-0.5" aria-hidden>
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            )}
          </button>

          <StepButton label="Subir el tempo" onPress={() => setBpm((b) => clampBpm(b + 1))}>
            <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.4" className="w-5 h-5" aria-hidden>
              <path d="M12 6v12M6 12h12" strokeLinecap="round" />
            </svg>
          </StepButton>
        </div>

        {/* max-w-md: en escritorio la tarjeta ocupa toda la página y, sin este
            límite, la barra pasaría de mil píxeles de largo para 210 valores. */}
        <div className="mt-7 flex items-center gap-3 max-w-md mx-auto">
          <span className="text-xs text-ink-3 tabular-nums w-7 text-right">{MIN_BPM}</span>
          <input
            type="range"
            min={MIN_BPM}
            max={MAX_BPM}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            aria-label="Tempo en pulsos por minuto"
            className="range flex-1"
          />
          <span className="text-xs text-ink-3 tabular-nums w-7">{MAX_BPM}</span>
        </div>

        {/* aria-live: quien no ve la pantalla recibe el compás en curso sin que
            se le lea cada punto que se enciende. */}
        <p aria-live="polite" className="mt-5 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface-2 border border-line px-3 py-1 text-xs text-ink-2 tabular-nums">
            <span className={`w-1.5 h-1.5 rounded-full ${running ? "bg-ok" : "bg-ink-3"}`} aria-hidden />
            {running ? (meter.beats === 0 ? `${bars} pulsos` : `Compás ${bars}`) : "Parado"}
          </span>
        </p>
      </section>

      <section className="card p-5 md:p-6 space-y-5">
        <Field label="Compás" hint={meter.hint}>
          {METERS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMeterId(m.id)}
              aria-pressed={m.id === meterId}
              className={`pill ${m.id === meterId ? "pill-active" : ""}`}
            >
              {m.label}
            </button>
          ))}
        </Field>

        <Field label="Subdivisión" hint="Clics suaves dentro de cada pulso, para afinar las notas rápidas.">
          {SUBDIVISIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSubdivision(s.value)}
              aria-pressed={s.value === subdivision}
              className={`pill ${s.value === subdivision ? "pill-active" : ""}`}
            >
              {s.label}
            </button>
          ))}
        </Field>

        <Field label="Tempo al toque" hint="Marca el pulso cuatro o cinco veces y el metrónomo copia la velocidad de tus golpes.">
          <button type="button" onClick={tapTempo} className="btn-secondary w-full sm:w-auto py-3 px-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-5 h-5" aria-hidden>
              <path d="M9 11V5.5a1.75 1.75 0 0 1 3.5 0V11" strokeLinecap="round" />
              <path
                d="M12.5 11V9.5a1.6 1.6 0 0 1 3.2 0V11m0-.5a1.6 1.6 0 0 1 3.2 0v4.2a5.3 5.3 0 0 1-5.3 5.3h-1.3a5 5 0 0 1-4.1-2.2l-2.5-3.7a1.6 1.6 0 0 1 2.4-2l1.9 1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Marcar el pulso
          </button>
        </Field>

        <p className="hidden md:block text-xs text-ink-3">
          Atajos: <Key>espacio</Key> pone en marcha y para, <Key>↑</Key> <Key>↓</Key> cambian el tempo de uno en uno,{" "}
          <Key>←</Key> <Key>→</Key> de cinco en cinco y <Key>T</Key> marca el pulso.
        </p>
      </section>

      {muted && (
        <p className="card p-4 text-sm text-ink-2">
          El sonido está apagado, así que el metrónomo solo marca el pulso en pantalla. Se enciende en{" "}
          <Link href="/settings" className="font-semibold text-ink hover:underline">
            Ajustes
          </Link>
          .
        </p>
      )}
    </div>
  );
}

/** Delay before the button starts repeating, and the repeat rate. */
const HOLD_DELAY = 420;
const HOLD_STEP = 90;

/** A −/+ button that can be held down: going from 90 to 144 one step at a time is 54 taps; holding it is one. */
function StepButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  const timers = useRef<{ delay?: number; tick?: number }>({});
  // the keyboard doesn't fire pointer events; without this flag, the `click`
  // that follows a tap would repeat the step once more
  const byPointer = useRef(false);

  const clear = () => {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.tick);
    timers.current = {};
  };
  useEffect(() => clear, []);

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        byPointer.current = true;
        onPress();
        timers.current.delay = window.setTimeout(() => {
          timers.current.tick = window.setInterval(onPress, HOLD_STEP);
        }, HOLD_DELAY);
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onClick={() => {
        if (!byPointer.current) onPress();
        byPointer.current = false;
      }}
      className="btn-circle w-12 h-12 bg-surface-2 text-ink border border-line hover:bg-surface-3 active:scale-95 select-none [touch-action:none]"
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
      <p className="mt-2 text-xs text-ink-3">{hint}</p>
    </div>
  );
}

const Key = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-ink-2">{children}</kbd>
);
