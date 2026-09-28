"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Score } from "@/components/notation/score";
import { ExerciseShell, SettingRow, Choice, useExerciseSession, type Feedback } from "./exercise-shell";
import { TempoControl } from "./tempo-control";
import { TIME_SIGNATURE_BY_ID, measureBeats } from "@/lib/music/meter";
import { generateRhythm, rhythmToEasyScore, type RhythmLevel, type RhythmNote } from "@/lib/music/rhythm";
import { getAudioContext, playClick, playNote, unlockAudio } from "@/lib/audio/synth";
import { audioLatency, eventAudioTime } from "@/lib/audio/timing";
import { startListening, useMicSupported, type Listener } from "@/lib/audio/listen";
import { useSettings } from "@/lib/settings";
import { UserError } from "@/lib/user-error";

type Phase = "idle" | "countin" | "playing" | "listening" | "done";
/** Con qué se marca el ritmo: el botón de la pantalla o dando palmas. */
type Input = "tap" | "mic";
/** Clavado, dentro de la ventana, o fallado (`null` = aún sin marcar). */
type Grade = "perfect" | "good" | null;

const TS_OPTIONS = ["4-4", "3-4", "2-4", "6-8"];
/** Ventana máxima y mínima para dar una nota por buena, en segundos. */
const MAX_TOLERANCE = 0.14;
const MIN_TOLERANCE = 0.05;
const PERFECT = 0.045;

interface Step {
  index: number;
  /** Negras desde el principio del ejercicio. */
  start: number;
  beats: number;
  rest: boolean;
}

interface Onset {
  /** Posición entre todas las figuras, para colorear la partitura. */
  index: number;
  start: number;
  /** Reloj del audio. */
  time: number;
  grade: Grade;
  /** Segundos; positivo = tarde. */
  error: number;
}

/**
 * Una pasada en marcha. Vive en una referencia, no en el estado: el bucle de
 * animación y los golpes la leen sesenta veces por segundo y no pueden esperar
 * a un render.
 */
interface Run {
  mode: "play" | "listen";
  input: Input;
  sound: boolean;
  /** Reloj del audio en el primer tiempo del ejercicio (tras la cuenta atrás). */
  start: number;
  end: number;
  /** Segundos por pulso de metrónomo. */
  pulse: number;
  /** Segundos por negra. */
  beatSec: number;
  countBeats: number;
  totalBeats: number;
  /** Lo que tarda el clic en llegar al oído, más el ajuste del alumno. */
  latency: number;
  tolerance: number;
  onsets: Onset[];
  extra: number;
  stops: (() => void)[];
}

export function RhythmTapping() {
  const { settings, update } = useSettings();
  const { stats, answer } = useExerciseSession("ritmo");
  const canClap = useMicSupported();
  const [tsId, setTsId] = useState("4-4");
  const [level, setLevel] = useState<RhythmLevel>(1);
  const [bpm, setBpm] = useState(80);
  const [bars, setBars] = useState(2);
  const [rhythm, setRhythm] = useState<RhythmNote[][]>(() => generateRhythm(TIME_SIGNATURE_BY_ID["4-4"], 1, 2));
  const [phase, setPhase] = useState<Phase>("idle");
  const [input, setInput] = useState<Input>("tap");
  const [micError, setMicError] = useState<string | null>(null);

  // Estado que se dibuja mientras suena. Todo lo que cambia una vez por pulso
  // o por golpe; lo que cambia por fotograma va por referencia al DOM.
  const [beat, setBeat] = useState(-1);
  const [pulseTick, setPulseTick] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [grades, setGrades] = useState<Record<number, Grade>>({});
  const [taps, setTaps] = useState<number[]>([]);
  const [lastTap, setLastTap] = useState<number | "stray" | null>(null);
  const [claps, setClaps] = useState(0);
  /** Media ventana de acierto, en negras, para dibujarla alrededor de cada nota. */
  const [windowBeats, setWindowBeats] = useState(0);

  // Resultado
  const [results, setResults] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [spread, setSpread] = useState<{ errors: number[]; tolerance: number } | null>(null);
  const [drift, setDrift] = useState<number | null>(null);

  const runRef = useRef<Run | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const frameRef = useRef(0);
  const backstopRef = useRef(0);
  const headRef = useRef<HTMLDivElement>(null);
  const listener = useRef<Listener | null>(null);

  const ts = TIME_SIGNATURE_BY_ID[tsId];
  const measures = useMemo(() => rhythm.map((m) => rhythmToEasyScore(m)), [rhythm]);
  const barBeats = measureBeats(ts);

  /** Las figuras estiradas en una línea, con su sitio en negras. */
  const timeline = useMemo(() => {
    const steps: Step[] = [];
    let at = 0;
    let index = 0;
    for (const m of rhythm) {
      for (const n of m) {
        steps.push({ index: index++, start: at, beats: n.beats, rest: n.rest });
        at += n.beats;
      }
    }
    return { steps, totalBeats: at || 1 };
  }, [rhythm]);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const teardown = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    if (backstopRef.current) window.clearTimeout(backstopRef.current);
    backstopRef.current = 0;
    listener.current?.stop();
    listener.current = null;
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  /** Lo que solo tiene sentido mientras suena. */
  const stopVisuals = useCallback(() => {
    setBeat(-1);
    setCountdown(0);
    setLastTap(null);
    if (headRef.current) {
      headRef.current.style.transform = "translateX(0%)";
      headRef.current.style.opacity = "0";
    }
  }, []);

  const resetVisuals = useCallback(() => {
    stopVisuals();
    setGrades({});
    setTaps([]);
    setClaps(0);
    setWindowBeats(0);
  }, [stopVisuals]);

  const cancel = useCallback(() => {
    const run = runRef.current;
    teardown();
    // Todo el ejercicio va programado de una vez en el reloj del audio: parar
    // significa callar también lo que todavía no ha sonado.
    run?.stops.forEach((s) => s());
    runRef.current = null;
    setPhaseBoth("idle");
    resetVisuals();
  }, [teardown, resetVisuals]);

  const regenerate = (id = tsId, lv = level, b = bars) => {
    cancel();
    setRhythm(generateRhythm(TIME_SIGNATURE_BY_ID[id], lv, b));
    setResults({});
    setFeedback(null);
    setSpread(null);
    setDrift(null);
  };

  const next = useCallback(() => regenerate(), [tsId, level, bars]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    const run = runRef.current;
    teardown();
    runRef.current = null;
    if (!run) return;
    if (run.mode === "listen") {
      resetVisuals();
      setPhaseBoth("idle");
      return;
    }
    // Los golpes y los aciertos se quedan en la línea de tiempo: puesta al
    // lado de la partitura, es lo que se tocó frente a lo que estaba escrito.
    stopVisuals();
    setPhaseBoth("done");

    const list = run.onsets;
    const styles: Record<number, string> = {};
    for (const o of list) styles[o.index] = o.grade ? "var(--ok)" : "var(--bad)";
    setResults(styles);

    const sharp = list.filter((o) => o.grade === "perfect").length;
    const close = list.filter((o) => o.grade === "good").length;
    const hits = sharp + close;
    const extra = run.extra;
    // Una nota clavada vale entera; una dentro de la ventana, casi. Cada golpe
    // de más resta medio acierto: marcar a discreción no puede salir a cuenta.
    const raw = sharp + close * 0.8 - Math.min(extra, list.length) * 0.5;
    const score = list.length ? Math.max(0, Math.round((raw / list.length) * 100)) : 0;
    const ok = score >= 80;
    answer(ok);

    const errors = list.filter((o) => o.grade).map((o) => o.error);
    setSpread({ errors, tolerance: run.tolerance });
    const sorted = [...errors].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    setDrift(sorted.length >= 3 ? median : null);

    setFeedback({
      correct: ok,
      message: (
        <>
          {hits} de {list.length} notas a tiempo{sharp > 0 ? ` (${sharp} clavada${sharp > 1 ? "s" : ""})` : ""}
          {extra > 0 ? `, ${extra} golpe${extra > 1 ? "s" : ""} de más` : ""}. Puntuación: {score}%.
          {!ok && " Prueba más despacio o con un nivel más fácil."}
        </>
      ),
    });
  }, [answer, teardown, resetVisuals, stopVisuals]);

  /** Un golpe, ya en el reloj del audio y sin descontar la latencia. */
  const register = useCallback((audioTime: number) => {
    const run = runRef.current;
    if (!run || run.mode !== "play") return;
    // El clic se programó antes de sonar: lo que el alumno ha oído es lo que
    // estaba en el reloj hace `latency`, y su golpe responde a eso.
    const at = audioTime - run.latency;
    if (at < run.start - run.pulse) return;

    // Con el micrófono abierto no se responde con un sonido: lo oiría y lo
    // contaría como otro golpe.
    if (run.input === "tap" && run.sound) playNote(76, { duration: 0.12, velocity: 0.35 });
    setClaps((n) => n + 1);
    setTaps((list) => [...list, (at - run.start) / run.beatSec]);

    let best: Onset | null = null;
    let bestDist = run.tolerance;
    for (const o of run.onsets) {
      if (o.grade) continue;
      const d = Math.abs(o.time - at);
      if (d <= bestDist) {
        best = o;
        bestDist = d;
      }
    }
    if (best) {
      best.error = at - best.time;
      best.grade = Math.abs(best.error) <= Math.min(PERFECT, run.tolerance * 0.5) ? "perfect" : "good";
      const { index, grade, error } = best;
      setGrades((g) => ({ ...g, [index]: grade }));
      setLastTap(error);
    } else {
      if (at >= run.start - 0.05) run.extra += 1;
      setLastTap("stray");
    }
  }, []);

  /**
   * El reloj del ejercicio: un solo bucle de animación que lee la hora del
   * audio. Antes cada destello y cada cabeza de lectura era un `setTimeout`, y
   * el hilo principal los servía cuando podía — el metrónomo iba clavado y lo
   * que se veía, no.
   */
  const startClock = useCallback(() => {
    const tick = () => {
      const run = runRef.current;
      if (!run) return;
      frameRef.current = requestAnimationFrame(tick);
      const heard = getAudioContext().currentTime - run.latency;

      if (heard >= run.end + run.tolerance + 0.08) {
        finish();
        return;
      }

      const beats = (heard - run.start) / run.beatSec;
      if (headRef.current) {
        const pos = Math.max(0, Math.min(1, beats / run.totalBeats));
        headRef.current.style.transform = `translateX(${pos * 100}%)`;
        headRef.current.style.opacity = beats >= 0 ? "1" : "0.3";
      }

      const countInStart = run.start - run.countBeats * run.pulse;
      const pulse = Math.floor((heard - countInStart) / run.pulse);
      if (pulse >= 0) {
        const inCountIn = pulse < run.countBeats;
        setCountdown(inCountIn ? run.countBeats - pulse : 0);
        setBeat(inCountIn ? pulse : (pulse - run.countBeats) % run.countBeats);
        setPulseTick(pulse);
      }
      if (beats >= 0 && phaseRef.current === "countin") {
        setPhaseBoth(run.mode === "listen" ? "listening" : "playing");
      }
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [finish]);

  const begin = async (mode: "play" | "listen") => {
    await unlockAudio();
    const ctx = getAudioContext();
    cancel();
    setResults({});
    setFeedback(null);
    setSpread(null);
    setDrift(null);
    setMicError(null);

    const latency = audioLatency(ctx) + settings.rhythmOffset / 1000;

    // Con palmas, el micrófono tiene que estar escuchando antes de la cuenta
    // atrás: el permiso lo pide aquí, dentro del clic que ha traído hasta aquí.
    if (mode === "play" && input === "mic") {
      try {
        listener.current = await startListening({ onOnset: (time) => register(time) });
      } catch (e) {
        setMicError(e instanceof UserError ? e.message : "No se pudo usar el micrófono.");
        setInput("tap");
        return;
      }
    }

    const beatSec = 60 / bpm;
    // En compases compuestos el pulso es negra con puntillo: clic cada 1,5 negras.
    const pulse = ts.beatValue * beatSec;
    const countBeats = ts.beats;
    const countInStart = ctx.currentTime + 0.3;
    const start = countInStart + countBeats * pulse;
    const { steps, totalBeats } = timeline;
    const end = start + totalBeats * beatSec;
    const stops: (() => void)[] = [];

    for (let i = 0; i < countBeats; i++) stops.push(playClick(countInStart + i * pulse, i === 0));
    const pulses = Math.round(totalBeats / ts.beatValue);
    for (let i = 0; i < pulses; i++) stops.push(playClick(start + i * pulse, i % countBeats === 0));

    const onsets: Onset[] = [];
    for (const s of steps) {
      if (s.rest) continue;
      const when = start + s.start * beatSec;
      onsets.push({ index: s.index, start: s.start, time: when, grade: null, error: 0 });
      if (mode === "listen") {
        stops.push(playNote(71, { when, duration: Math.min(s.beats * beatSec * 0.9, 0.7), velocity: 0.5 }));
      }
    }

    // La ventana se estrecha con el tempo: a ♩=140 las semicorcheas caen cada
    // 107 ms, y una ventana fija de 130 se solapa con la nota de al lado.
    let gap = Infinity;
    for (let i = 1; i < onsets.length; i++) gap = Math.min(gap, onsets[i].time - onsets[i - 1].time);
    const tolerance = Math.max(MIN_TOLERANCE, Math.min(MAX_TOLERANCE, (Number.isFinite(gap) ? gap : 1) * 0.45));

    runRef.current = {
      mode,
      input,
      sound: settings.sound,
      start,
      end,
      pulse,
      beatSec,
      countBeats,
      totalBeats,
      latency,
      tolerance,
      onsets,
      extra: 0,
      stops,
    };
    resetVisuals();
    setWindowBeats(mode === "play" ? tolerance / beatSec : 0);
    setPhaseBoth("countin");
    startClock();
    // El bucle de animación se para con la pestaña en segundo plano; sin esto,
    // volver a ella dejaría el ejercicio colgado para siempre.
    backstopRef.current = window.setTimeout(finish, (end + 0.5 - ctx.currentTime) * 1000 + 500);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.metaKey || e.ctrlKey) return;
      const p = phaseRef.current;
      if (p === "countin" || p === "playing") {
        e.preventDefault();
        register(eventAudioTime(getAudioContext(), e.timeStamp));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [register]);

  const running = phase === "countin" || phase === "playing" || phase === "listening";

  return (
    <ExerciseShell
      title="Ritmo"
      stats={stats}
      feedback={feedback}
      onNext={next}
      color="bg-blue"
      settings={
        <>
          <SettingRow label="Compás">
            {TS_OPTIONS.map((id) => (
              <Choice key={id} active={tsId === id} onClick={() => { setTsId(id); regenerate(id, level, bars); }}>
                {id.replace("-", "/")}
              </Choice>
            ))}
          </SettingRow>
          <SettingRow label="Nivel">
            {[1, 2, 3].map((l) => (
              <Choice key={l} active={level === l} onClick={() => { setLevel(l as RhythmLevel); regenerate(tsId, l as RhythmLevel, bars); }}>
                {l === 1 ? "Negras y blancas" : l === 2 ? "Con corcheas" : "Semicorcheas y puntillos"}
              </Choice>
            ))}
          </SettingRow>
          <SettingRow label="Compases">
            {[1, 2, 4].map((b) => (
              <Choice key={b} active={bars === b} onClick={() => { setBars(b); regenerate(tsId, level, b); }}>
                {b}
              </Choice>
            ))}
          </SettingRow>
          {canClap && (
            <SettingRow label="Cómo lo marcas">
              <Choice active={input === "tap"} onClick={() => { setInput("tap"); cancel(); }}>En la pantalla</Choice>
              <Choice active={input === "mic"} onClick={() => { setInput("mic"); cancel(); }}>Con palmas</Choice>
            </SettingRow>
          )}
          <SettingRow label={`Ajuste del clic ${settings.rhythmOffset > 0 ? "+" : ""}${settings.rhythmOffset} ms`}>
            <input
              type="range"
              min={-150}
              max={150}
              step={5}
              value={settings.rhythmOffset}
              onChange={(e) => update({ rhythmOffset: Number(e.target.value) })}
              className="accent-(--accent) w-40"
              aria-label="Ajuste del clic"
            />
          </SettingRow>
          <p className="text-xs text-ink-3">
            Si vas a tiempo pero el ejercicio te marca tarde, sube el ajuste. Por Bluetooth el sonido llega con retraso y hace falta
            bastante. Al terminar una pasada te lo calcula solo.
          </p>
        </>
      }
    >
      <p className="text-sm text-ink-2 text-center">
        {input === "mic"
          ? "Da una palmada (o golpea la mesa) en cada nota, siguiendo el metrónomo. Primero suena un compás de espera."
          : "Marca cada nota con el botón (o la barra espaciadora), siguiendo el metrónomo. Primero suena un compás de espera."}
      </p>
      {input === "mic" && (
        <p className="text-center text-xs text-ink-3">
          Mejor con auriculares: por el altavoz, el micrófono también oye el metrónomo y lo cuenta como palmas.
        </p>
      )}

      <div className="flex justify-center">
        <Score
          time={`${ts.numerator}/${ts.denominator}`}
          measures={measures}
          width={bars > 2 ? 720 : 520}
          noteStyles={results}
          endBar="end"
        />
      </div>

      <RhythmTrack
        steps={timeline.steps}
        total={timeline.totalBeats}
        barBeats={barBeats}
        pulseBeats={ts.beatValue}
        grades={grades}
        taps={taps}
        windowBeats={windowBeats}
        headRef={headRef}
      />

      <BeatDots accents={ts.accents} beat={beat} tick={pulseTick} active={running} />

      <TempoControl bpm={bpm} onChange={setBpm} disabled={running} />

      {running ? (
        <div className="space-y-3">
          {input === "mic" && phase !== "listening" ? (
            <div
              role="status"
              className={`mx-auto flex h-24 w-full max-w-xs flex-col items-center justify-center gap-1 rounded-3xl font-semibold transition-colors ${
                phase === "countin" ? "bg-surface-3 text-ink-2" : "bg-surface-2"
              }`}
            >
              <span className="text-lg">{phase === "countin" ? countdown || "Espera…" : "Da palmas"}</span>
              <TapHint last={lastTap} claps={claps} listening={phase === "countin"} />
            </div>
          ) : (
            <button
              type="button"
              disabled={phase === "listening"}
              onPointerDown={(e) => {
                e.preventDefault();
                register(eventAudioTime(getAudioContext(), e.nativeEvent.timeStamp));
              }}
              className={`mx-auto flex h-24 w-full max-w-xs select-none touch-none flex-col items-center justify-center gap-1 rounded-3xl text-lg font-semibold transition-transform active:scale-[0.98] disabled:active:scale-100 ${
                phase === "playing" ? "bg-ink text-bg" : "bg-surface-3 text-ink-2"
              }`}
            >
              <span className="text-2xl tabular-nums">
                {phase === "countin" ? countdown || "…" : phase === "listening" ? "Escucha" : "TAP"}
              </span>
              <TapHint last={lastTap} claps={claps} listening={phase !== "playing"} />
            </button>
          )}
          <div className="flex justify-center">
            <button type="button" onClick={cancel} className="pill py-1.5 px-4 text-xs">
              Detener
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={() => begin("play")} disabled={!settings.sound} className="pill pill-active disabled:opacity-50">
            {phase === "done" ? "Repetir" : "▶ Empezar"}
          </button>
          <button type="button" onClick={() => begin("listen")} disabled={!settings.sound} className="pill disabled:opacity-50">
            Escuchar el ritmo
          </button>
        </div>
      )}

      {spread && <TimingSpread errors={spread.errors} tolerance={spread.tolerance} />}
      {drift !== null && Math.abs(drift) >= 0.02 && (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-ink-2">
            Tus golpes caen {Math.abs(Math.round(drift * 1000))} ms {drift > 0 ? "por detrás" : "por delante"} del clic, casi siempre.
            {drift > 0 ? " Suele ser el retraso del altavoz, no tú." : ""}
          </p>
          <button
            type="button"
            onClick={() => {
              update({ rhythmOffset: Math.max(-200, Math.min(200, Math.round(settings.rhythmOffset + drift * 1000))) });
              setDrift(null);
            }}
            className="pill py-1.5 px-4 text-xs"
          >
            Corregir el desfase
          </button>
        </div>
      )}

      {micError && <p className="text-xs text-center text-bad">{micError}</p>}
      {!settings.sound && <p className="text-xs text-center text-bad">Activa el sonido en Ajustes para usar el metrónomo.</p>}
    </ExerciseShell>
  );
}

function TapHint({ last, claps, listening }: { last: number | "stray" | null; claps: number; listening: boolean }) {
  if (listening) {
    return <span className="text-xs font-medium opacity-60">{claps > 0 ? `${claps} golpes` : "prepárate"}</span>;
  }
  if (last === null) return <span className="text-xs font-medium opacity-60">o barra espaciadora</span>;
  if (last === "stray") return <span className="text-xs font-medium opacity-60">fuera de sitio</span>;
  const ms = Math.round(last * 1000);
  return (
    <span className="text-xs font-medium tabular-nums opacity-70">
      {Math.abs(ms) <= 25 ? "¡clavado!" : `${ms > 0 ? "+" : ""}${ms} ms · ${ms > 0 ? "tarde" : "pronto"}`}
    </span>
  );
}

/**
 * El ritmo estirado en una línea de tiempo, con la cabeza de lectura y los
 * golpes que se van dando. La partitura no vale para esto: repintarla en cada
 * nota es medio segundo de VexFlow en el mismo hilo que mide los golpes.
 */
function RhythmTrack({
  steps,
  total,
  barBeats,
  pulseBeats,
  grades,
  taps,
  windowBeats,
  headRef,
}: {
  steps: Step[];
  total: number;
  barBeats: number;
  pulseBeats: number;
  grades: Record<number, Grade>;
  taps: number[];
  windowBeats: number;
  headRef: React.RefObject<HTMLDivElement | null>;
}) {
  const pct = (beats: number) => `${(beats / total) * 100}%`;
  const barLines = Array.from({ length: Math.max(0, Math.round(total / barBeats) - 1) }, (_, i) => (i + 1) * barBeats);
  const pulses = Array.from({ length: Math.round(total / pulseBeats) }, (_, i) => i * pulseBeats);

  return (
    <div className="relative h-20 overflow-hidden rounded-2xl bg-surface-2">
      <div className="absolute inset-y-0 left-3 right-3">
        {pulses.map((b) => (
          <span key={`p${b}`} style={{ left: pct(b) }} className="absolute top-2 h-2 w-px -translate-x-1/2 bg-ink/20" />
        ))}
        {barLines.map((b) => (
          <span key={`b${b}`} style={{ left: pct(b) }} className="absolute inset-y-2 w-px -translate-x-1/2 bg-ink/15" />
        ))}
        {windowBeats > 0 &&
          steps
            .filter((s) => !s.rest)
            .map((s) => (
              <span
                key={`w${s.index}`}
                style={{ left: pct(s.start - windowBeats), width: pct(windowBeats * 2) }}
                className="absolute top-1/2 h-7 -translate-y-1/2 rounded-full bg-ink/5"
              />
            ))}
        {steps.map((s) =>
          s.rest ? (
            <span
              key={s.index}
              style={{ left: pct(s.start) }}
              className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/15"
            />
          ) : (
            <span
              key={s.index}
              style={{ left: pct(s.start) }}
              className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${
                grades[s.index] === "perfect"
                  ? "bg-ok ring-4 ring-ok/25"
                  : grades[s.index] === "good"
                    ? "bg-ok/60"
                    : "bg-ink/30"
              }`}
            />
          ),
        )}
        {taps.map((t, i) => (
          <span
            key={i}
            style={{ left: pct(Math.max(0, Math.min(total, t))) }}
            className="absolute bottom-1.5 h-4 w-0.5 -translate-x-1/2 rounded bg-ink/45"
          />
        ))}
      </div>
      <div ref={headRef} className="absolute inset-y-0 left-3 right-3 opacity-0 will-change-transform">
        <span className="absolute inset-y-1.5 -left-px w-0.5 rounded bg-ink" />
      </div>
    </div>
  );
}

/** Los pulsos del compás, con el acento marcado por tamaño. */
function BeatDots({ accents, beat, tick, active }: { accents: number[]; beat: number; tick: number; active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2.5" aria-hidden="true">
      {accents.map((a, i) => {
        const on = active && beat === i;
        const size = a === 1 ? "h-4 w-4" : a === 0.5 ? "h-3.5 w-3.5" : "h-3 w-3";
        return (
          <span
            key={on ? `${i}-${tick}` : i}
            className={`${size} rounded-full ${on ? "bg-ink scale-125" : "bg-surface-3"} transition-transform duration-100`}
          />
        );
      })}
    </div>
  );
}

/**
 * Dónde cayó cada golpe respecto al clic. Un número medio no dice si se va
 * siempre tarde o si simplemente baila; la nube, sí.
 */
function TimingSpread({ errors, tolerance }: { errors: number[]; tolerance: number }) {
  if (!errors.length) return null;
  const span = tolerance * 1.8;
  const half = (tolerance / span) * 50;
  return (
    <div className="space-y-1">
      <div className="relative h-11 overflow-hidden rounded-2xl bg-surface-2">
        <span
          style={{ left: `${50 - half}%`, width: `${half * 2}%` }}
          className="absolute top-1/2 h-7 -translate-y-1/2 rounded-full bg-ok/15"
        />
        <span className="absolute inset-y-2 left-1/2 w-px bg-ink/30" />
        {errors.map((e, i) => (
          <span
            key={i}
            style={{ left: `${50 + Math.max(-1, Math.min(1, e / span)) * 50}%` }}
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/70"
          />
        ))}
      </div>
      <div className="flex justify-between px-1 text-[11px] text-ink-3">
        <span>antes del clic</span>
        <span>a tiempo</span>
        <span>después</span>
      </div>
    </div>
  );
}
