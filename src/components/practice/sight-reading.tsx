"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Score } from "@/components/notation/score";
import { PianoKeyboard } from "@/components/notation/piano-keyboard";
import { MidiConnect } from "@/components/midi/midi-connect";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { ExerciseHeader, useExerciseSession } from "./exercise-shell";
import { LevelMap, Stars } from "./level-map";
import { SightReadingFree } from "./sight-reading-free";
import {
  SIGHT_LEVELS,
  SIGHT_LEVEL_BY_ID,
  generateSightPiece,
  gradeSight,
  noteTolerance,
  type SightLevel,
  type SightNote,
  type SightPiece,
} from "@/lib/music/sight-reading";
import { TIME_SIGNATURE_BY_ID } from "@/lib/music/meter";
import { keyName, keyByVex } from "@/lib/music/keys";
import { fromMidi, toEasyScore } from "@/lib/music/pitch";
import { recordLevel, starTotals, unlockedCount, useLevelProgress } from "@/lib/practice/level-progress";
import { computerKeyMap, keyHints, usePianoKeyboardKeys } from "@/lib/practice/note-keys";
import { recordItem } from "@/lib/practice/item-stats";
import { useMidi, useMidiNotes } from "@/lib/midi";
import { getAudioContext, playClick, playNote, unlockAudio } from "@/lib/audio/synth";
import { audioLatency, eventAudioTime } from "@/lib/audio/timing";
import { useSettings } from "@/lib/settings";

const EXERCISE = "primera-vista";
const LEVEL_IDS = SIGHT_LEVELS.map((l) => l.id);

type Mode = "levels" | "free";

/**
 * «Primera vista» tiene dos caras, como «Leer notas»: los niveles, que llevan
 * de la posición de do al sistema doble, y la lectura libre, con la mano, el
 * compás y el tempo a mano y melodía nueva sin parar. Lo primero es para
 * aprender; lo segundo, para calentar y para insistir en lo que se atraganta.
 */
export function SightReading() {
  const [mode, setMode] = useState<Mode>("levels");
  const records = useLevelProgress(EXERCISE);
  const unlocked = unlockedCount(LEVEL_IDS, records);
  const [levelId, setLevelId] = useState<string | null>(null);
  const level = levelId ? SIGHT_LEVEL_BY_ID[levelId] : null;
  const { earned, possible } = starTotals(LEVEL_IDS, records);

  const switcher = (
    <div className="flex justify-center gap-1.5">
      {(
        [
          ["levels", "Niveles"],
          ["free", "Lectura libre"],
        ] as [Mode, string][]
      ).map(([id, text]) => (
        <button
          key={id}
          type="button"
          onClick={() => setMode(id)}
          aria-pressed={mode === id}
          className={`pill py-1.5 px-4 text-xs ${mode === id ? "pill-active" : ""}`}
        >
          {text}
        </button>
      ))}
    </div>
  );

  if (mode === "free") return <SightReadingFree switcher={switcher} />;

  if (level) {
    return (
      <Run
        key={level.id}
        level={level}
        onExit={() => setLevelId(null)}
        onNextLevel={() => {
          const next = SIGHT_LEVELS[level.n];
          setLevelId(next ? next.id : null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ExerciseHeader title="Primera vista" />
      {switcher}
      <div className="card-pastel bg-peach px-5 py-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tabular-nums">
            {earned}
            <span className="text-ink-2 text-base font-medium">/{possible}</span>
          </p>
          <p className="text-xs text-ink-2">estrellas</p>
        </div>
        <p className="text-xs text-ink-2 text-right max-w-56">
          El pentagrama avanza con el metrónomo y hay que tocar cada nota cuando llega. Melodía nueva cada vez.
        </p>
      </div>
      <LevelMap levels={SIGHT_LEVELS} records={records} unlocked={unlocked} onPick={setLevelId} />
    </div>
  );
}

type Phase = "idle" | "countin" | "playing" | "done";

interface Expected extends SightNote {
  /** Instante en el reloj del audio. */
  at: number;
  hit: boolean;
}

interface Summary {
  stars: number;
  passed: boolean;
  score: number;
  hits: number;
  total: number;
  extra: number;
}

const OK = "var(--ok)";
const BAD = "var(--bad)";

function Run({ level, onExit, onNextLevel }: { level: SightLevel; onExit: () => void; onNextLevel: () => void }) {
  const { settings } = useSettings();
  const { answer } = useExerciseSession(EXERCISE);
  const midiInput = useMidi(true);
  const ts = TIME_SIGNATURE_BY_ID[level.tsId];

  const [piece, setPiece] = useState<SightPiece>(() => generateSightPiece(level));
  const [phase, setPhase] = useState<Phase>("idle");
  const [beat, setBeat] = useState(-1);
  const [playhead, setPlayhead] = useState<{ top: number; bottom: number }>({ top: -1, bottom: -1 });
  const [styles, setStyles] = useState<Record<number, string>>({});
  const [bassStyles, setBassStyles] = useState<Record<number, string>>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lastMiss, setLastMiss] = useState(0);

  const expected = useRef<Expected[]>([]);
  const extra = useRef(0);
  const timeouts = useRef<number[]>([]);
  const stops = useRef<(() => void)[]>([]);
  const phaseRef = useRef<Phase>("idle");

  const beatSec = 60 / level.bpm;

  const clear = useCallback(() => {
    timeouts.current.forEach((t) => window.clearTimeout(t));
    timeouts.current = [];
    stops.current.forEach((s) => s());
    stops.current = [];
  }, []);
  useEffect(() => clear, [clear]);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const reset = (next = piece) => {
    clear();
    setPiece(next);
    setPhaseBoth("idle");
    setPlayhead({ top: -1, bottom: -1 });
    setStyles({});
    setBassStyles({});
    setSummary(null);
    setBeat(-1);
    setLastMiss(0);
    expected.current = [];
    extra.current = 0;
  };

  const finish = useCallback(() => {
    setPhaseBoth("done");
    setPlayhead({ top: -1, bottom: -1 });
    setBeat(-1);
    clear();
    const list = expected.current;
    const hits = list.filter((e) => e.hit).length;
    const top: Record<number, string> = {};
    const bottom: Record<number, string> = {};
    for (const e of list) {
      (e.staff === "top" ? top : bottom)[e.index] = e.hit ? OK : BAD;
      // Cada nota alimenta la lista de puntos flojos, igual que en «Leer notas».
      const clef = e.staff === "bottom" || level.clef === "bass" ? "bass" : "treble";
      recordItem(EXERCISE, `${clef}|${toEasyScore(fromMidi(e.midi))}`, e.hit);
    }
    setStyles(top);
    setBassStyles(bottom);
    const grade = gradeSight(hits, list.length, extra.current);
    recordLevel(EXERCISE, level.id, grade.stars, grade.score);
    answer(grade.passed);
    setSummary({ ...grade, hits, total: list.length, extra: extra.current });
  }, [clear, level, answer]);

  const start = async () => {
    await unlockAudio();
    const ctx = getAudioContext();
    clear();
    setStyles({});
    setBassStyles({});
    setSummary(null);
    setLastMiss(0);
    extra.current = 0;

    const pulse = ts.beatValue * beatSec;
    const t0 = ctx.currentTime + 0.2;
    const startTime = t0 + ts.beats * pulse;

    setPhaseBoth("countin");
    for (let i = 0; i < ts.beats; i++) {
      stops.current.push(playClick(t0 + i * pulse, i === 0));
      timeouts.current.push(window.setTimeout(() => setBeat(i), Math.max(0, (t0 + i * pulse - ctx.currentTime) * 1000)));
    }

    expected.current = piece.notes.map((n) => ({ ...n, at: startTime + n.beat * beatSec, hit: false }));

    // El metrónomo sigue sonando durante la lectura: es el único hilo que
    // queda cuando la vista va por delante de las manos.
    const pulses = Math.round(piece.totalBeats / ts.beatValue);
    for (let i = 0; i < pulses; i++) {
      stops.current.push(playClick(startTime + i * pulse, i % ts.beats === 0));
      timeouts.current.push(
        window.setTimeout(() => setBeat(i % ts.beats), Math.max(0, (startTime + i * pulse - ctx.currentTime) * 1000)),
      );
    }

    const later = (when: number, fn: () => void) =>
      timeouts.current.push(window.setTimeout(fn, Math.max(0, (when - ctx.currentTime) * 1000)));

    later(startTime, () => setPhaseBoth("playing"));
    for (const n of expected.current) {
      later(startTime + n.beat * beatSec, () =>
        setPlayhead((p) => ({ ...p, [n.staff]: n.index })),
      );
    }
    const last = expected.current[expected.current.length - 1];
    const tail = last ? noteTolerance(last, beatSec) : 0.3;
    later(startTime + piece.totalBeats * beatSec + tail, finish);
  };

  /**
   * Una tecla tocada. `timeStamp` viene del evento del navegador; con él se
   * sabe cuándo se pulsó de verdad, no cuándo llegó el manejador. Se descuenta
   * además la latencia de salida: el metrónomo se oye un buffer más tarde que
   * el instante en que se programó, así que todo lo que responde a él llega
   * igual de tarde.
   */
  const press = (midi: number, timeStamp?: number) => {
    const p = phaseRef.current;
    if (p !== "playing" && p !== "countin") return;
    const ctx = getAudioContext();
    const raw = timeStamp === undefined ? ctx.currentTime : eventAudioTime(ctx, timeStamp);
    const now = raw - audioLatency(ctx) - settings.rhythmOffset / 1000;
    const candidate = expected.current
      .filter((e) => !e.hit && e.midi === midi && Math.abs(e.at - now) <= noteTolerance(e, beatSec))
      .sort((a, b) => Math.abs(a.at - now) - Math.abs(b.at - now))[0];
    if (candidate) {
      candidate.hit = true;
      const set = candidate.staff === "top" ? setStyles : setBassStyles;
      set((s) => ({ ...s, [candidate.index]: OK }));
    } else {
      extra.current += 1;
      setLastMiss((n) => n + 1);
    }
  };

  const range = useMemo(() => {
    const midis = piece.notes.map((n) => n.midi);
    const lo = Math.min(...midis, 60);
    const hi = Math.max(...midis, 60);
    return { from: Math.max(21, lo - 2), to: Math.min(108, hi + 2) };
  }, [piece]);

  // Dos filas del teclado del ordenador, una por mano: la de casa para lo que
  // está escrito arriba y la de abajo para el pentagrama de la izquierda.
  const keyMap = useMemo(() => {
    if (!piece.bottom) return computerKeyMap(range.from, range.to);
    const split = Math.min(...piece.notes.filter((n) => n.staff === "top").map((n) => n.midi));
    return { ...computerKeyMap(range.from, split - 1, "low"), ...computerKeyMap(split, range.to) };
  }, [piece, range]);
  const hints = useMemo(() => keyHints(keyMap), [keyMap]);

  usePianoKeyboardKeys({
    enabled: phase === "playing" || phase === "countin",
    map: keyMap,
    onPress: (midi, timeStamp) => {
      if (settings.sound) void unlockAudio().then(() => playNote(midi, { duration: 0.6, velocity: settings.volume }));
      press(midi, timeStamp);
    },
  });

  useMidiNotes((e) => {
    if (!e.on) return;
    if (settings.sound) void unlockAudio().then(() => playNote(e.midi, { duration: 0.9, velocity: settings.volume }));
    press(e.midi);
  }, midiInput.status === "on");

  const running = phase === "countin" || phase === "playing";
  const width = level.bars > 2 ? 760 : 560;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            clear();
            onExit();
          }}
          aria-label="Salir del nivel"
          className="card w-11 h-11 flex items-center justify-center hover:bg-surface-2 shrink-0"
        >
          <ChevronIcon dir="left" />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-xs text-ink-3">Nivel {level.n} · Primera vista</p>
          <h1 className="text-base font-semibold tracking-tight truncate">{level.name}</h1>
        </div>
        <span className="w-11 shrink-0" />
      </div>

      <div className="card p-4 md:p-6 space-y-4">
        <p className="text-sm text-ink-2 text-center">
          {phase === "idle"
            ? level.hint
            : phase === "countin"
              ? "Un compás de espera…"
              : phase === "playing"
                ? "Toca cada nota cuando el pentagrama llegue a ella."
                : "Verde, a tiempo; rojo, fuera de tiempo o sin tocar."}
        </p>

        <Score
          clef={level.clef}
          keySignature={level.keyVex}
          time={`${ts.numerator}/${ts.denominator}`}
          measures={piece.top}
          bassMeasures={piece.bottom ?? undefined}
          width={width}
          scale={1.4}
          noteStyles={styles}
          bassNoteStyles={bassStyles}
          highlight={phase === "playing" && playhead.top >= 0 ? playhead.top : undefined}
          bassHighlight={phase === "playing" && playhead.bottom >= 0 ? playhead.bottom : undefined}
          highlightBand
          endBar="end"
        />

        <div className="flex items-center justify-center gap-2" aria-hidden="true">
          {Array.from({ length: ts.beats }).map((_, i) => (
            <span
              key={i}
              className={`w-3 h-3 rounded-full transition-colors ${running && beat === i ? "bg-ok" : "bg-surface-3"}`}
            />
          ))}
        </div>

        <PianoKeyboard
          from={range.from}
          to={range.to}
          labels={settings.keyLabels ? "all" : "c"}
          hints={hints}
          onPress={(midi) => press(midi)}
          held={midiInput.active}
          sound={settings.sound}
        />

        <p className="hidden sm:block text-center text-[0.7rem] text-ink-3">
          Con el teclado del ordenador: <strong>A S D F G H J K L</strong> para la mano derecha
          {piece.bottom && (
            <>
              {" "}
              y <strong>Z X C V B N M</strong> para la izquierda
            </>
          )}
          . Las letras están escritas en cada tecla.
        </p>

        {phase === "playing" && lastMiss > 0 && (
          <p className="text-center text-xs text-bad" role="status">
            {lastMiss} nota{lastMiss > 1 ? "s" : ""} fuera de sitio. Sigue: el compás no espera.
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => void start()}
            disabled={running || !settings.sound}
            className="pill pill-active disabled:opacity-50"
          >
            {phase === "done" ? "Repetir esta" : running ? "En marcha…" : "▶ Empezar"}
          </button>
          <button type="button" onClick={() => reset(generateSightPiece(level))} disabled={running} className="pill disabled:opacity-50">
            Otra melodía
          </button>
        </div>

        {!settings.sound && <p className="text-xs text-center text-bad">Activa el sonido en Ajustes para oír el metrónomo.</p>}
        <MidiConnect />
        <p className="text-center text-[0.7rem] text-ink-3">
          {level.keyVex === "C" ? "Do mayor, sin alteraciones" : keyName(keyByVex(level.keyVex), settings.naming)} ·{" "}
          {ts.numerator}/{ts.denominator} · ♩ = {level.bpm}
        </p>
      </div>

      {summary && (
        <SightSummary
          level={level}
          summary={summary}
          onExit={onExit}
          onAnother={() => reset(generateSightPiece(level))}
          onNextLevel={onNextLevel}
          hasNext={level.n < SIGHT_LEVELS.length}
        />
      )}
    </div>
  );
}

function SightSummary({
  level,
  summary,
  onExit,
  onAnother,
  onNextLevel,
  hasNext,
}: {
  level: SightLevel;
  summary: Summary;
  onExit: () => void;
  onAnother: () => void;
  onNextLevel: () => void;
  hasNext: boolean;
}) {
  return (
    <div className={`card-pastel ${summary.passed ? level.color : "bg-ash"} p-6 space-y-3 text-center`}>
      <div className="flex justify-center">
        <Stars count={summary.stars} size="lg" />
      </div>
      <h2 className="text-xl font-semibold">
        {summary.stars === 3 ? "¡Leída entera!" : summary.passed ? "Nivel superado" : "Otra vez"}
      </h2>
      <p className="text-2xl font-bold tabular-nums">
        {summary.hits}
        <span className="text-ink-2 text-base font-medium">/{summary.total}</span>
        <span className="text-ink-2 text-base font-medium"> notas a tiempo</span>
      </p>
      <p className="text-sm text-ink-2 max-w-md mx-auto">
        {summary.extra > 0 && `${summary.extra} nota${summary.extra > 1 ? "s" : ""} de más. `}
        {summary.stars === 3
          ? "Ni una fuera de sitio. Sube de nivel."
          : summary.passed
            ? "Vuelve a leerla con otra melodía hasta que no se te escape ninguna."
            : "Fíjate en las rojas: normalmente no es el dedo, es que la nota se lee tarde. Mira siempre una nota por delante de la que tocas."}
      </p>
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <button type="button" onClick={onExit} className="pill">
          Ver niveles
        </button>
        <button type="button" onClick={onAnother} className="pill">
          Otra melodía
        </button>
        {summary.passed && hasNext && (
          <button type="button" onClick={onNextLevel} className="pill pill-active">
            Siguiente nivel
          </button>
        )}
      </div>
    </div>
  );
}
