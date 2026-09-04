"use client";

import { useCallback, useMemo, useState } from "react";
import { Score } from "@/components/notation/score";
import { PlayButton } from "@/components/audio/play-button";
import { ExerciseShell, OptionButton, SettingRow, Choice, useExerciseSession, type Feedback } from "./exercise-shell";
import { TIME_SIGNATURE_BY_ID } from "@/lib/music/meter";
import { generateMelody, type Melody } from "@/lib/music/melody";
import { keyByVex, keyName } from "@/lib/music/keys";
import { noteName } from "@/lib/music/pitch";
import type { RhythmLevel } from "@/lib/music/rhythm";
import { useSettings } from "@/lib/settings";

const KEYS = ["C", "G", "F", "D", "Bb", "A", "Eb", "Am", "Em", "Dm"];

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

  const ts = TIME_SIGNATURE_BY_ID[tsId];

  const regenerate = (k = keyVex, c = clef, t = tsId, l = level, b = bars) => {
    setMelody(generateMelody(keyByVex(k), c, TIME_SIGNATURE_BY_ID[t], b, l));
    setFeedback(null);
    setCurrent(-1);
    setShowNames(false);
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
        Lee la melodía en voz alta con los nombres de las notas (y cántala si puedes). Luego escúchala y compara.
      </p>
      <Score
        clef={clef}
        keySignature={keyVex}
        time={`${ts.numerator}/${ts.denominator}`}
        measures={melody.easy}
        labels={showNames ? labels : undefined}
        width={bars > 2 ? 760 : 560}
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
      </div>
      {!feedback && (
        <div className="grid grid-cols-2 gap-2">
          <OptionButton onClick={() => grade(true)} state="idle">La leí bien</OptionButton>
          <OptionButton onClick={() => grade(false)} state="idle">Necesito repetir</OptionButton>
        </div>
      )}
    </ExerciseShell>
  );
}
