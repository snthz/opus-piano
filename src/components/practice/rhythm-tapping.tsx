"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Score } from "@/components/notation/score";
import { ExerciseShell, SettingRow, Choice, useExerciseSession, type Feedback } from "./exercise-shell";
import { TIME_SIGNATURE_BY_ID, measureBeats } from "@/lib/music/meter";
import { generateRhythm, rhythmToEasyScore, type RhythmLevel, type RhythmNote } from "@/lib/music/rhythm";
import { getAudioContext, playClick, playNote, unlockAudio } from "@/lib/audio/synth";
import { useSettings } from "@/lib/settings";

type Phase = "idle" | "countin" | "playing" | "done";

const TOLERANCE = 0.13; // segundos
const TS_OPTIONS = ["4-4", "3-4", "2-4", "6-8"];

interface Onset {
  index: number;
  time: number;
  hit: boolean;
  error?: number;
}

export function RhythmTapping() {
  const { settings } = useSettings();
  const { stats, answer } = useExerciseSession("ritmo");
  const [tsId, setTsId] = useState("4-4");
  const [level, setLevel] = useState<RhythmLevel>(1);
  const [bpm, setBpm] = useState(80);
  const [bars, setBars] = useState(2);
  const [rhythm, setRhythm] = useState<RhythmNote[][]>(() => generateRhythm(TIME_SIGNATURE_BY_ID["4-4"], 1, 2));
  const [phase, setPhase] = useState<Phase>("idle");
  const [beatFlash, setBeatFlash] = useState(-1);
  const [results, setResults] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [playhead, setPlayhead] = useState(-1);
  const onsets = useRef<Onset[]>([]);
  const extraTaps = useRef(0);
  const timeouts = useRef<number[]>([]);
  const phaseRef = useRef<Phase>("idle");

  const ts = TIME_SIGNATURE_BY_ID[tsId];
  const measures = useMemo(() => rhythm.map((m) => rhythmToEasyScore(m)), [rhythm]);

  const clear = () => {
    timeouts.current.forEach((t) => window.clearTimeout(t));
    timeouts.current = [];
  };
  useEffect(() => clear, []);

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const regenerate = (id = tsId, lv = level, b = bars) => {
    clear();
    setRhythm(generateRhythm(TIME_SIGNATURE_BY_ID[id], lv, b));
    setResults({});
    setFeedback(null);
    setPhaseBoth("idle");
    setPlayhead(-1);
  };

  const next = useCallback(() => regenerate(), [tsId, level, bars]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    await unlockAudio();
    const ctx = getAudioContext();
    clear();
    setResults({});
    setFeedback(null);
    extraTaps.current = 0;
    const beatSec = (60 / bpm) * (ts.kind === "compuesto" ? 1 : 1);
    // En compases compuestos el pulso es negra con puntillo: clic cada 1.5 negras.
    const pulse = ts.beatValue * (60 / bpm);
    const countBeats = ts.beats;
    const t0 = ctx.currentTime + 0.15;
    const startTime = t0 + countBeats * pulse;

    setPhaseBoth("countin");
    for (let i = 0; i < countBeats; i++) {
      playClick(t0 + i * pulse, i === 0);
      const delay = (t0 + i * pulse - ctx.currentTime) * 1000;
      timeouts.current.push(window.setTimeout(() => setBeatFlash(i), Math.max(0, delay)));
    }

    // Onsets esperados
    const list: Onset[] = [];
    let t = startTime;
    let idx = 0;
    const totalBeats = rhythm.length * measureBeats(ts);
    for (const m of rhythm) {
      for (const n of m) {
        if (!n.rest) list.push({ index: idx, time: t, hit: false });
        const at = t;
        const i = idx;
        timeouts.current.push(window.setTimeout(() => setPlayhead(i), Math.max(0, (at - ctx.currentTime) * 1000)));
        t += n.beats * beatSec;
        idx++;
      }
    }
    onsets.current = list;

    // Metrónomo durante el ejercicio
    const pulses = Math.round(totalBeats / ts.beatValue);
    for (let i = 0; i < pulses; i++) {
      playClick(startTime + i * pulse, i % ts.beats === 0);
      const delay = (startTime + i * pulse - ctx.currentTime) * 1000;
      timeouts.current.push(window.setTimeout(() => setBeatFlash(i % ts.beats), Math.max(0, delay)));
    }
    timeouts.current.push(window.setTimeout(() => setPhaseBoth("playing"), Math.max(0, (startTime - ctx.currentTime) * 1000)));
    timeouts.current.push(window.setTimeout(finish, Math.max(0, (t + TOLERANCE + 0.1 - ctx.currentTime) * 1000)));
  };

  const finish = () => {
    setPhaseBoth("done");
    setPlayhead(-1);
    const list = onsets.current;
    const hits = list.filter((o) => o.hit).length;
    const styles: Record<number, string> = {};
    for (const o of list) styles[o.index] = o.hit ? "var(--ok)" : "var(--bad)";
    setResults(styles);
    const extra = extraTaps.current;
    const score = list.length ? Math.round(((hits - Math.min(extra, hits) * 0.5) / list.length) * 100) : 0;
    const ok = score >= 80;
    answer(ok);
    setFeedback({
      correct: ok,
      message: (
        <>
          {hits} de {list.length} notas a tiempo{extra > 0 ? `, ${extra} golpe${extra > 1 ? "s" : ""} de más` : ""}. Puntuación: {Math.max(0, score)}%.
          {!ok && " Prueba más despacio o con un nivel más fácil."}
        </>
      ),
    });
  };

  const tap = () => {
    if (phaseRef.current !== "playing" && phaseRef.current !== "countin") return;
    const now = getAudioContext().currentTime;
    if (settings.sound) playNote(76, { duration: 0.15, velocity: 0.5 });
    const candidate = onsets.current
      .filter((o) => !o.hit && Math.abs(o.time - now) <= TOLERANCE)
      .sort((a, b) => Math.abs(a.time - now) - Math.abs(b.time - now))[0];
    if (candidate) {
      candidate.hit = true;
      candidate.error = now - candidate.time;
      setResults((r) => ({ ...r, [candidate.index]: "var(--ok)" }));
    } else if (phaseRef.current === "playing") {
      extraTaps.current += 1;
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <SettingRow label={`Tempo ♩ = ${bpm}`}>
            <input type="range" min={50} max={140} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="accent-(--accent) w-40" aria-label="Tempo" />
          </SettingRow>
        </>
      }
    >
      <p className="text-sm text-ink-2 text-center">
        Pulsa el botón (o la barra espaciadora) en cada nota, siguiendo el metrónomo. Primero suena un compás de espera.
      </p>
      <div className="flex justify-center">
        <Score
          time={`${ts.numerator}/${ts.denominator}`}
          measures={measures}
          width={bars > 2 ? 720 : 520}
          noteStyles={results}
          highlight={phase === "playing" ? playhead : undefined}
          endBar="end"
        />
      </div>
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: ts.beats }).map((_, i) => (
          <span
            key={i}
            className={`w-3 h-3 rounded-full transition-colors ${
              (phase === "countin" || phase === "playing") && beatFlash === i ? "bg-ok" : "bg-surface-3"
            }`}
          />
        ))}
      </div>
      {phase === "idle" || phase === "done" ? (
        <div className="flex justify-center">
          <button type="button" onClick={start} disabled={!settings.sound} className="pill pill-active disabled:opacity-50">
            {phase === "done" ? "Repetir" : "▶ Empezar"}
          </button>
        </div>
      ) : (
        <div className="flex justify-center">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              tap();
            }}
            className={`w-full max-w-xs h-24 rounded-3xl font-semibold text-lg select-none touch-none active:scale-[0.98] transition-transform flex flex-col items-center justify-center gap-1 ${
              phase === "countin" ? "bg-surface-3 text-ink-2" : "bg-ink text-bg"
            }`}
          >
            <span>{phase === "countin" ? "Espera…" : "TAP"}</span>
            <span className="text-xs font-medium opacity-60">o barra espaciadora</span>
          </button>
        </div>
      )}
      {!settings.sound && <p className="text-xs text-center text-bad">Activa el sonido en Ajustes para usar el metrónomo.</p>}
    </ExerciseShell>
  );
}
