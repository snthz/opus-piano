"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Score } from "@/components/notation/score";
import { PianoKeyboard } from "@/components/notation/piano-keyboard";
import { MidiConnect } from "@/components/midi/midi-connect";
import { ExerciseShell, SettingRow, Choice, useExerciseSession, type Feedback } from "./exercise-shell";
import { TempoControl } from "./tempo-control";
import {
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
import { computerKeyMap, keyHints, usePianoKeyboardKeys } from "@/lib/practice/note-keys";
import { recordItem } from "@/lib/practice/item-stats";
import { useMidi, useMidiNotes } from "@/lib/midi";
import { getAudioContext, playClick, playNote, unlockAudio } from "@/lib/audio/synth";
import { audioLatency, eventAudioTime } from "@/lib/audio/timing";
import { useSettings } from "@/lib/settings";

const EXERCISE = "primera-vista";

/** Qué mano lee. «Las dos» es el sistema doble: melodía arriba, acompañamiento abajo. */
type Hands = "right" | "left" | "both";
/** El metrónomo durante la lectura, o solo para entrar. */
type Click = "always" | "countin";
type Reach = "corta" | "octava" | "ancha";

const TS_OPTIONS = ["4-4", "3-4", "2-4", "6-8"];
const KEY_OPTIONS = ["C", "G", "F", "D"];
const BAR_OPTIONS = [2, 4, 8];

/** Registro de la melodía por clave y amplitud, en notación científica. */
const RANGES: Record<"treble" | "bass", Record<Reach, [string, string]>> = {
  treble: { corta: ["C4", "G4"], octava: ["C4", "C5"], ancha: ["E4", "F5"] },
  bass: { corta: ["F3", "C4"], octava: ["C3", "C4"], ancha: ["G2", "A3"] },
};

const OK = "var(--ok)";
const BAD = "var(--bad)";

type Phase = "idle" | "countin" | "playing" | "done";

interface Expected extends SightNote {
  /** Instante en el reloj del audio. */
  at: number;
  /** Margen propio, en segundos: una redonda se pisa con calma, una corchea no. */
  tol: number;
  hit: boolean;
}

/**
 * Una lectura en marcha. En una referencia y no en el estado: el reloj la lee
 * en cada fotograma y cada tecla pulsada la consulta, y ninguno de los dos
 * puede esperar a un render.
 */
interface Run {
  start: number;
  end: number;
  pulse: number;
  beatSec: number;
  countBeats: number;
  totalBeats: number;
  latency: number;
  notes: Expected[];
  extra: number;
  stops: (() => void)[];
}

/**
 * Primera vista sin niveles: se elige la mano, el compás y el tempo, y sale
 * melodía nueva hasta que uno se cansa. Los niveles enseñan en un orden; esto
 * es para calentar y para el día que uno quiere leer justo lo que se le
 * atraganta.
 */
export function SightReadingFree({ switcher }: { switcher?: React.ReactNode }) {
  const { settings } = useSettings();
  const { stats, answer } = useExerciseSession(EXERCISE);
  const midiInput = useMidi(true);

  const [hands, setHands] = useState<Hands>("right");
  const [reach, setReach] = useState<Reach>("octava");
  const [keyVex, setKeyVex] = useState("C");
  const [tsId, setTsId] = useState("4-4");
  const [bars, setBars] = useState(2);
  const [rhythm, setRhythm] = useState<1 | 2 | 3>(1);
  const [bpm, setBpm] = useState(60);
  const [click, setClick] = useState<Click>("always");

  const ts = TIME_SIGNATURE_BY_ID[tsId];
  const clef: "treble" | "bass" = hands === "left" ? "bass" : "treble";
  const grand = hands === "both";

  const level = useMemo<SightLevel>(
    () => ({
      id: "pv-libre",
      n: 0,
      group: "Libre",
      name: "Lectura libre",
      hint: "",
      color: "bg-peach",
      clef,
      grand,
      keyVex,
      tsId,
      bars,
      bpm,
      rhythm,
      range: RANGES[clef][reach],
    }),
    [clef, grand, keyVex, tsId, bars, bpm, rhythm, reach],
  );

  const [piece, setPiece] = useState<SightPiece>(() => generateSightPiece(level));
  const [phase, setPhase] = useState<Phase>("idle");
  const [beat, setBeat] = useState(-1);
  const [playhead, setPlayhead] = useState({ top: -1, bottom: -1 });
  const [styles, setStyles] = useState<Record<number, string>>({});
  const [bassStyles, setBassStyles] = useState<Record<number, string>>({});
  const [hitBeats, setHitBeats] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [lastMiss, setLastMiss] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const runRef = useRef<Run | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const frameRef = useRef(0);
  const backstopRef = useRef(0);
  const headRef = useRef<HTMLDivElement>(null);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const teardown = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    if (backstopRef.current) window.clearTimeout(backstopRef.current);
    backstopRef.current = 0;
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const stopVisuals = useCallback(() => {
    setBeat(-1);
    setCountdown(0);
    setPlayhead({ top: -1, bottom: -1 });
    if (headRef.current) {
      headRef.current.style.transform = "translateX(0%)";
      headRef.current.style.opacity = "0";
    }
  }, []);

  const cancel = useCallback(() => {
    const run = runRef.current;
    teardown();
    // El metrónomo va programado de una vez: pararlo es callar lo que queda.
    run?.stops.forEach((s) => s());
    runRef.current = null;
    setPhaseBoth("idle");
    stopVisuals();
    setHitBeats([]);
    setLastMiss(0);
  }, [teardown, stopVisuals]);

  /** Melodía nueva con los ajustes de ahora. */
  const another = useCallback(() => {
    cancel();
    setPiece(generateSightPiece(level));
    setStyles({});
    setBassStyles({});
    setFeedback(null);
  }, [cancel, level]);

  // Cambiar un ajuste cambia la melodía: leer la misma con otro compás no es
  // lo que nadie espera al tocar un botón de «3/4».
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    another();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clef, grand, keyVex, tsId, bars, rhythm, reach]);

  const finish = useCallback(() => {
    const run = runRef.current;
    teardown();
    runRef.current = null;
    stopVisuals();
    if (!run) return;
    setPhaseBoth("done");

    const list = run.notes;
    const hits = list.filter((e) => e.hit).length;
    const top: Record<number, string> = {};
    const bottom: Record<number, string> = {};
    for (const e of list) {
      (e.staff === "top" ? top : bottom)[e.index] = e.hit ? OK : BAD;
      // Cada nota alimenta la lista de puntos flojos, igual que en los niveles.
      const c = e.staff === "bottom" || clef === "bass" ? "bass" : "treble";
      recordItem(EXERCISE, `${c}|${toEasyScore(fromMidi(e.midi))}`, e.hit);
    }
    setStyles(top);
    setBassStyles(bottom);

    const grade = gradeSight(hits, list.length, run.extra);
    answer(grade.passed);
    setFeedback({
      correct: grade.passed,
      message: (
        <>
          {hits} de {list.length} notas a tiempo
          {run.extra > 0 ? `, ${run.extra} de más` : ""}. Puntuación: {grade.score}%.
          {grade.stars === 3
            ? " Ni una fuera de sitio: sube el tempo."
            : grade.passed
              ? " Otra melodía con los mismos ajustes y a por ella."
              : " Baja el tempo: leer a tiempo se aprende despacio."}
        </>
      ),
    });
  }, [teardown, stopVisuals, answer, clef]);

  const startClock = useCallback(() => {
    const tick = () => {
      const run = runRef.current;
      if (!run) return;
      frameRef.current = requestAnimationFrame(tick);
      // Lo que se oye va un buffer por detrás de lo que se programó; el
      // pentagrama tiene que avanzar con el oído, no con el reloj.
      const heard = getAudioContext().currentTime - run.latency;
      if (heard >= run.end) {
        finish();
        return;
      }

      const beats = (heard - run.start) / run.beatSec;
      if (headRef.current) {
        const pos = Math.max(0, Math.min(1, beats / run.totalBeats));
        headRef.current.style.transform = `translateX(${pos * 100}%)`;
        headRef.current.style.opacity = beats >= 0 ? "1" : "0.3";
      }

      const pulse = Math.floor((heard - (run.start - run.countBeats * run.pulse)) / run.pulse);
      if (pulse >= 0) {
        const inCountIn = pulse < run.countBeats;
        setCountdown(inCountIn ? run.countBeats - pulse : 0);
        setBeat(inCountIn ? pulse : (pulse - run.countBeats) % run.countBeats);
      }
      if (beats >= 0 && phaseRef.current === "countin") setPhaseBoth("playing");

      if (beats >= 0) {
        let top = -1;
        let bottom = -1;
        for (const n of run.notes) {
          if (n.beat > beats + 1e-6) break;
          if (n.staff === "top") top = n.index;
          else bottom = n.index;
        }
        // Solo cuando cambia de nota: mover el resalte repinta la partitura
        // entera, y eso es VexFlow en el mismo hilo que cronometra las teclas.
        setPlayhead((p) => (p.top === top && p.bottom === bottom ? p : { top, bottom }));
      }
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [finish]);

  const start = async () => {
    await unlockAudio();
    const ctx = getAudioContext();
    cancel();
    setStyles({});
    setBassStyles({});
    setFeedback(null);

    const beatSec = 60 / bpm;
    const pulse = ts.beatValue * beatSec;
    const countInStart = ctx.currentTime + 0.3;
    const start = countInStart + ts.beats * pulse;
    const stops: (() => void)[] = [];

    for (let i = 0; i < ts.beats; i++) stops.push(playClick(countInStart + i * pulse, i === 0));
    // El metrónomo sigue sonando durante la lectura: es el único hilo que queda
    // cuando la vista va por delante de las manos. Quien ya no lo necesita, lo
    // apaga y lee con el pentagrama solo.
    if (click === "always") {
      const pulses = Math.round(piece.totalBeats / ts.beatValue);
      for (let i = 0; i < pulses; i++) stops.push(playClick(start + i * pulse, i % ts.beats === 0));
    }

    const notes: Expected[] = piece.notes.map((n) => ({
      ...n,
      at: start + n.beat * beatSec,
      tol: noteTolerance(n, beatSec),
      hit: false,
    }));
    const last = notes[notes.length - 1];

    runRef.current = {
      start,
      end: start + piece.totalBeats * beatSec + (last ? last.tol : 0.3),
      pulse,
      beatSec,
      countBeats: ts.beats,
      totalBeats: piece.totalBeats,
      latency: audioLatency(ctx) + settings.rhythmOffset / 1000,
      notes,
      extra: 0,
      stops,
    };
    setHitBeats([]);
    setLastMiss(0);
    setPhaseBoth("countin");
    startClock();
    // El bucle de animación se para en segundo plano; sin esto, volver a la
    // pestaña dejaría la lectura colgada.
    backstopRef.current = window.setTimeout(finish, (runRef.current.end + 0.5 - ctx.currentTime) * 1000 + 500);
  };

  /**
   * Una tecla tocada. Con el `timeStamp` del evento se sabe cuándo se pulsó de
   * verdad, no cuándo llegó el manejador, y se descuenta la latencia de salida:
   * el metrónomo se oye más tarde que el instante en que se programó, así que
   * todo lo que responde a él llega igual de tarde.
   */
  const press = useCallback((midi: number, timeStamp?: number) => {
    const run = runRef.current;
    if (!run) return;
    const ctx = getAudioContext();
    const raw = timeStamp === undefined ? ctx.currentTime : eventAudioTime(ctx, timeStamp);
    const now = raw - run.latency;

    let best: Expected | null = null;
    let bestDist = Infinity;
    for (const e of run.notes) {
      if (e.hit || e.midi !== midi) continue;
      const d = Math.abs(e.at - now);
      if (d <= e.tol && d < bestDist) {
        best = e;
        bestDist = d;
      }
    }
    if (best) {
      best.hit = true;
      setHitBeats((list) => [...list, best!.beat]);
    } else {
      run.extra += 1;
      setLastMiss((n) => n + 1);
    }
  }, []);

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

  const running = phase === "countin" || phase === "playing";

  usePianoKeyboardKeys({
    enabled: running,
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

  const topNotes = useMemo(() => piece.notes.filter((n) => n.staff === "top"), [piece]);

  return (
    <ExerciseShell
      title="Primera vista"
      stats={stats}
      feedback={feedback}
      onNext={another}
      color="bg-peach"
      topbar={switcher}
      settings={
        <>
          <SettingRow label="Manos">
            <Choice active={hands === "right"} onClick={() => setHands("right")}>Derecha</Choice>
            <Choice active={hands === "left"} onClick={() => setHands("left")}>Izquierda</Choice>
            <Choice active={hands === "both"} onClick={() => setHands("both")}>Las dos</Choice>
          </SettingRow>
          <SettingRow label="Registro">
            <Choice active={reach === "corta"} onClick={() => setReach("corta")}>Posición fija</Choice>
            <Choice active={reach === "octava"} onClick={() => setReach("octava")}>Una octava</Choice>
            <Choice active={reach === "ancha"} onClick={() => setReach("ancha")}>Todo el pentagrama</Choice>
          </SettingRow>
          <SettingRow label="Tonalidad">
            {KEY_OPTIONS.map((k) => (
              <Choice key={k} active={keyVex === k} onClick={() => setKeyVex(k)}>
                {keyName(keyByVex(k), settings.naming)}
              </Choice>
            ))}
          </SettingRow>
          <SettingRow label="Compás">
            {TS_OPTIONS.map((id) => (
              <Choice key={id} active={tsId === id} onClick={() => setTsId(id)}>
                {id.replace("-", "/")}
              </Choice>
            ))}
          </SettingRow>
          <SettingRow label="Compases">
            {BAR_OPTIONS.map((b) => (
              <Choice key={b} active={bars === b} onClick={() => setBars(b)}>
                {b}
              </Choice>
            ))}
          </SettingRow>
          <SettingRow label="Figuras">
            {([1, 2, 3] as const).map((r) => (
              <Choice key={r} active={rhythm === r} onClick={() => setRhythm(r)}>
                {r === 1 ? "Negras y blancas" : r === 2 ? "Con corcheas" : "Semicorcheas y puntillos"}
              </Choice>
            ))}
          </SettingRow>
          <SettingRow label="Metrónomo">
            <Choice active={click === "always"} onClick={() => setClick("always")}>Todo el rato</Choice>
            <Choice active={click === "countin"} onClick={() => setClick("countin")}>Solo la entrada</Choice>
          </SettingRow>
          {hands === "both" && (
            <p className="text-xs text-ink-3">
              En el sistema doble la mano izquierda lleva una sola nota larga por compás: la pisas al empezar el compás y la dejas.
            </p>
          )}
        </>
      }
    >
      <p className="text-sm text-ink-2 text-center">
        {phase === "idle"
          ? "Elige la mano y el tempo, y toca cada nota cuando el pentagrama llegue a ella."
          : phase === "countin"
            ? "Un compás de espera…"
            : phase === "playing"
              ? "Toca cada nota cuando el pentagrama llegue a ella."
              : "Verde, a tiempo; rojo, fuera de tiempo o sin tocar."}
      </p>

      <Score
        clef={clef}
        keySignature={keyVex}
        time={`${ts.numerator}/${ts.denominator}`}
        measures={piece.top}
        bassMeasures={piece.bottom ?? undefined}
        width={bars > 2 ? 760 : 560}
        scale={1.4}
        noteStyles={styles}
        bassNoteStyles={bassStyles}
        highlight={phase === "playing" && playhead.top >= 0 ? playhead.top : undefined}
        bassHighlight={phase === "playing" && playhead.bottom >= 0 ? playhead.bottom : undefined}
        highlightBand
        endBar="end"
      />

      <ReadingTrack
        notes={topNotes}
        total={piece.totalBeats}
        barBeats={piece.totalBeats / bars}
        hits={hitBeats}
        headRef={headRef}
      />

      <div className="flex items-center justify-center gap-2" aria-hidden="true">
        {ts.accents.map((a, i) => (
          <span
            key={i}
            className={`${a === 1 ? "h-4 w-4" : a === 0.5 ? "h-3.5 w-3.5" : "h-3 w-3"} rounded-full transition-transform duration-100 ${
              running && beat === i ? "bg-ink scale-125" : "bg-surface-3"
            }`}
          />
        ))}
      </div>

      {phase === "countin" && countdown > 0 && (
        <p className="text-center text-3xl font-semibold tabular-nums" role="status">
          {countdown}
        </p>
      )}

      <TempoControl bpm={bpm} onChange={setBpm} disabled={running} />

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
        {running ? (
          <button type="button" onClick={cancel} className="pill py-1.5 px-4 text-xs">
            Detener
          </button>
        ) : (
          <>
            <button type="button" onClick={() => void start()} disabled={!settings.sound} className="pill pill-active disabled:opacity-50">
              {phase === "done" ? "Repetir esta" : "▶ Empezar"}
            </button>
            <button type="button" onClick={another} className="pill">
              Otra melodía
            </button>
          </>
        )}
      </div>

      {!settings.sound && <p className="text-xs text-center text-bad">Activa el sonido en Ajustes para oír el metrónomo.</p>}
      <MidiConnect />
    </ExerciseShell>
  );
}

/**
 * La lectura estirada en una línea: dónde va el compás y qué notas han caído a
 * tiempo. La cabeza se mueve por fotograma sobre el DOM; moverla repintando la
 * partitura costaría más que lo que mide.
 */
function ReadingTrack({
  notes,
  total,
  barBeats,
  hits,
  headRef,
}: {
  notes: SightNote[];
  total: number;
  barBeats: number;
  hits: number[];
  headRef: React.RefObject<HTMLDivElement | null>;
}) {
  const pct = (beats: number) => `${(beats / (total || 1)) * 100}%`;
  const done = useMemo(() => new Set(hits), [hits]);
  const barLines = Array.from({ length: Math.max(0, Math.round(total / barBeats) - 1) }, (_, i) => (i + 1) * barBeats);

  return (
    <div className="relative h-10 overflow-hidden rounded-2xl bg-surface-2">
      <div className="absolute inset-y-0 left-3 right-3">
        {barLines.map((b) => (
          <span key={b} style={{ left: pct(b) }} className="absolute inset-y-2 w-px -translate-x-1/2 bg-ink/15" />
        ))}
        {notes.map((n) => (
          <span
            key={n.index}
            style={{ left: pct(n.beat) }}
            className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${
              done.has(n.beat) ? "bg-ok" : "bg-ink/25"
            }`}
          />
        ))}
      </div>
      <div ref={headRef} className="absolute inset-y-0 left-3 right-3 opacity-0 will-change-transform">
        <span className="absolute inset-y-1 -left-px w-0.5 rounded bg-ink" />
      </div>
    </div>
  );
}
