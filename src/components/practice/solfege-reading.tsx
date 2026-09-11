"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Score } from "@/components/notation/score";
import { PlayButton } from "@/components/audio/play-button";
import { ExerciseShell, OptionButton, SettingRow, Choice, useExerciseSession, type Feedback } from "./exercise-shell";
import { TIME_SIGNATURE_BY_ID } from "@/lib/music/meter";
import { generateMelody, type Melody } from "@/lib/music/melody";
import { keyByVex, keyName } from "@/lib/music/keys";
import { frequencyToMidi, fromMidi, noteName } from "@/lib/music/pitch";
import type { RhythmLevel } from "@/lib/music/rhythm";
import { getAudioContext, playClick, unlockAudio } from "@/lib/audio/synth";
import { micSupported, startListening, type Listener } from "@/lib/audio/listen";
import { expectedNotes, gradeSinging } from "@/lib/practice/singing";
import { useSettings } from "@/lib/settings";
import { UserError } from "@/lib/user-error";

const KEYS = ["C", "G", "F", "D", "Bb", "A", "Eb", "Am", "Em", "Dm"];

type Phase = "idle" | "countin" | "singing" | "done";

export function SolfegeReading() {
  const { settings } = useSettings();
  const { stats, answer } = useExerciseSession("solfeo");
  const [keyVex, setKeyVex] = useState("C");
  const [clef, setClef] = useState<"treble" | "bass">("treble");
  const [tsId, setTsId] = useState("4-4");
  const [level, setLevel] = useState<RhythmLevel>(1);
  const [bars, setBars] = useState(2);
  const [bpm, setBpm] = useState(80);
  const [showNames, setShowNames] = useState(false);
  const [current, setCurrent] = useState(-1);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [melody, setMelody] = useState<Melody>(() => generateMelody(keyByVex("C"), "treble", TIME_SIGNATURE_BY_ID["4-4"], 2, 1));
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<Record<number, string>>({});
  const [heard, setHeard] = useState<number | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const listener = useRef<Listener | null>(null);
  const samples = useRef<{ at: number; midi: number }[]>([]);
  const timeouts = useRef<number[]>([]);

  const ts = TIME_SIGNATURE_BY_ID[tsId];

  const stopSinging = () => {
    listener.current?.stop();
    listener.current = null;
    timeouts.current.forEach((t) => window.clearTimeout(t));
    timeouts.current = [];
  };
  useEffect(() => stopSinging, []);

  const regenerate = (k = keyVex, c = clef, t = tsId, l = level, b = bars) => {
    stopSinging();
    setMelody(generateMelody(keyByVex(k), c, TIME_SIGNATURE_BY_ID[t], b, l));
    setFeedback(null);
    setCurrent(-1);
    setShowNames(false);
    setPhase("idle");
    setResults({});
    setHeard(null);
  };
  const next = useCallback(() => regenerate(), [keyVex, clef, tsId, level, bars]); // eslint-disable-line react-hooks/exhaustive-deps

  const labels = useMemo(
    () => melody.measures.flat().map((n) => (n.rest ? "" : noteName(n.pitch, settings.naming))),
    [melody, settings.naming],
  );

  const grade = (ok: boolean) => {
    answer(ok);
    setFeedback({
      correct: ok,
      message: ok ? "¡Bien! Sigue con la siguiente melodía." : "Escúchala de nuevo, cántala con los nombres y vuelve a intentarlo.",
    });
  };

  /**
   * Cantar la melodía con el micrófono abierto: un compás de espera, el
   * metrónomo marcando, y al final se compara nota a nota lo cantado con lo
   * escrito. La octava no cuenta: una voz grave canta lo mismo más abajo.
   */
  const sing = async () => {
    await unlockAudio();
    const ctx = getAudioContext();
    stopSinging();
    setFeedback(null);
    setResults({});
    setMicError(null);
    samples.current = [];

    try {
      listener.current = await startListening({
        onPitch: (freq, _level, at) => {
          const midi = freq === null ? null : frequencyToMidi(freq);
          setHeard(midi);
          if (midi !== null) samples.current.push({ at, midi });
        },
      });
    } catch (e) {
      setMicError(e instanceof UserError ? e.message : "No se pudo usar el micrófono.");
      return;
    }

    const beatSec = 60 / bpm;
    const pulse = ts.beatValue * beatSec;
    const t0 = ctx.currentTime + 0.15;
    const startTime = t0 + ts.beats * pulse;
    setPhase("countin");

    for (let i = 0; i < ts.beats; i++) playClick(t0 + i * pulse, i === 0);

    const expected = expectedNotes(melody.events, startTime, beatSec);
    const totalBeats = melody.events.reduce((sum, e) => sum + e.beats, 0);
    const pulses = Math.round(totalBeats / ts.beatValue);
    for (let i = 0; i < pulses; i++) playClick(startTime + i * pulse, i % ts.beats === 0);

    const later = (when: number, fn: () => void) =>
      timeouts.current.push(window.setTimeout(fn, Math.max(0, (when - ctx.currentTime) * 1000)));

    later(startTime, () => setPhase("singing"));
    let at = startTime;
    melody.events.forEach((event, index) => {
      const when = at;
      later(when, () => setCurrent(index));
      at += event.beats * beatSec;
    });
    later(at + 0.2, () => finishSinging(expected));
  };

  const finishSinging = (expected: ReturnType<typeof expectedNotes>) => {
    stopSinging();
    setPhase("done");
    setCurrent(-1);
    setHeard(null);
    const result = gradeSinging(expected, samples.current);
    const styles: Record<number, string> = {};
    for (const note of result.notes) styles[note.index] = note.correct ? "var(--ok)" : "var(--bad)";
    setResults(styles);

    const ok = result.score >= 75;
    answer(ok);
    const silent = result.notes.filter((n) => n.heard === null).length;
    setFeedback({
      correct: ok,
      message: (
        <>
          {result.correct} de {result.total} notas afinadas ({result.score}%).
          {silent > 0 && ` ${silent} no se ${silent === 1 ? "oyó" : "oyeron"}.`}
          {!ok && !silent && " Escúchala otra vez y fíjate en los saltos."}
          {silent > 0 && silent === result.total && " Prueba a cantar más cerca del micrófono."}
        </>
      ),
    });
  };

  /** El nombre de lo que se está oyendo ahora, para saber que el micro va. */
  const heardName = heard === null ? null : noteName(fromMidi(Math.round(heard)), settings.naming);

  return (
    <ExerciseShell
      title="Solfeo"
      stats={stats}
      feedback={feedback}
      onNext={next}
      color="bg-peach"
      settings={
        <>
          <SettingRow label="Tonalidad">
            {KEYS.map((k) => (
              <Choice key={k} active={keyVex === k} onClick={() => { setKeyVex(k); regenerate(k, clef, tsId, level, bars); }}>
                {keyName(keyByVex(k), settings.naming)}
              </Choice>
            ))}
          </SettingRow>
          <SettingRow label="Clave">
            <Choice active={clef === "treble"} onClick={() => { setClef("treble"); regenerate(keyVex, "treble", tsId, level, bars); }}>Sol</Choice>
            <Choice active={clef === "bass"} onClick={() => { setClef("bass"); regenerate(keyVex, "bass", tsId, level, bars); }}>Fa</Choice>
          </SettingRow>
          <SettingRow label="Compás">
            {["4-4", "3-4", "2-4", "6-8"].map((id) => (
              <Choice key={id} active={tsId === id} onClick={() => { setTsId(id); regenerate(keyVex, clef, id, level, bars); }}>
                {id.replace("-", "/")}
              </Choice>
            ))}
          </SettingRow>
          <SettingRow label="Ritmo">
            {[1, 2, 3].map((l) => (
              <Choice key={l} active={level === l} onClick={() => { setLevel(l as RhythmLevel); regenerate(keyVex, clef, tsId, l as RhythmLevel, bars); }}>
                Nivel {l}
              </Choice>
            ))}
          </SettingRow>
          <SettingRow label="Compases">
            {[2, 4].map((b) => (
              <Choice key={b} active={bars === b} onClick={() => { setBars(b); regenerate(keyVex, clef, tsId, level, b); }}>
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
        {micSupported()
          ? "Lee la melodía con los nombres de las notas y cántala: la app escucha y te dice cuáles has afinado."
          : "Lee la melodía en voz alta con los nombres de las notas (y cántala si puedes). Luego escúchala y compara."}
      </p>
      <Score
        clef={clef}
        keySignature={keyVex}
        time={`${ts.numerator}/${ts.denominator}`}
        measures={melody.easy}
        labels={showNames ? labels : undefined}
        noteStyles={results}
        width={bars > 2 ? 760 : 560}
        scale={1.4}
        highlight={current >= 0 ? current : undefined}
        endBar="end"
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <PlayButton events={melody.events} bpm={bpm} beatsPerBar={ts.beats} metronome onEvent={setCurrent} label="Escuchar" size="sm" />
        <PlayButton
          events={[{ midis: [melody.events.find((e) => e.midis.length)?.midis[0] ?? 60], beats: 2 }]}
          bpm={bpm}
          label="Primera nota"
          size="sm"
        />
        <button type="button" onClick={() => setShowNames((v) => !v)} className={`pill py-1.5 text-xs ${showNames ? "pill-active" : ""}`}>
          {showNames ? "Ocultar nombres" : "Mostrar nombres"}
        </button>
        {micSupported() && (
          <button
            type="button"
            onClick={() => void sing()}
            disabled={!settings.sound || phase === "countin" || phase === "singing"}
            className="pill bg-accent py-1.5 text-xs text-bg disabled:opacity-50"
          >
            {phase === "countin" ? "Espera…" : phase === "singing" ? "Cantando…" : phase === "done" ? "Cantar otra vez" : "Cantar y comprobar"}
          </button>
        )}
      </div>

      {(phase === "countin" || phase === "singing") && (
        <p className="text-center text-sm" role="status">
          {phase === "countin" ? (
            <span className="text-ink-2">Un compás de espera…</span>
          ) : (
            <>
              <span className="text-ink-2">Te oigo: </span>
              <strong className="text-lg">{heardName ?? "…"}</strong>
            </>
          )}
        </p>
      )}
      {micError && <p className="text-center text-xs text-bad">{micError}</p>}

      {!feedback && phase !== "countin" && phase !== "singing" && (
        <div className="grid grid-cols-2 gap-2">
          <OptionButton onClick={() => grade(true)} state="idle">La leí bien</OptionButton>
          <OptionButton onClick={() => grade(false)} state="idle">Necesito repetir</OptionButton>
        </div>
      )}
    </ExerciseShell>
  );
}
