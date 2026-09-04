"use client";

import { useCallback, useMemo, useState } from "react";
import { Score } from "@/components/notation/score";
import { ExerciseShell, OptionButton, SettingRow, Choice, useExerciseSession, type Feedback } from "./exercise-shell";
import { LETTERS, LATIN_NAMES, diatonicIndex, fromDiatonicIndex, toEasyScore, fullName, noteName, toMidi, type Pitch, type Letter } from "@/lib/music/pitch";
import { pickDifferent } from "@/lib/random";
import { useSettings } from "@/lib/settings";
import { playNote, unlockAudio } from "@/lib/audio/synth";

type ClefMode = "treble" | "bass" | "both";
type Range = "staff" | "ledger";

const RANGES: Record<"treble" | "bass", Record<Range, [Pitch, Pitch]>> = {
  treble: {
    staff: [{ letter: "E", accidental: 0, octave: 4 }, { letter: "F", accidental: 0, octave: 5 }],
    ledger: [{ letter: "A", accidental: 0, octave: 3 }, { letter: "C", accidental: 0, octave: 6 }],
  },
  bass: {
    staff: [{ letter: "G", accidental: 0, octave: 2 }, { letter: "A", accidental: 0, octave: 3 }],
    ledger: [{ letter: "C", accidental: 0, octave: 2 }, { letter: "E", accidental: 0, octave: 4 }],
  },
};

interface Question {
  clef: "treble" | "bass";
  pitch: Pitch;
}

function makeQuestion(mode: ClefMode, range: Range, accidentals: boolean, prev?: Question): Question {
  const clef = mode === "both" ? (Math.random() < 0.5 ? "treble" : "bass") : mode;
  const [lo, hi] = RANGES[clef][range];
  const indices: number[] = [];
  for (let i = diatonicIndex(lo); i <= diatonicIndex(hi); i++) indices.push(i);
  const idx = pickDifferent(indices, prev && prev.clef === clef ? diatonicIndex(prev.pitch) : undefined);
  let pitch = fromDiatonicIndex(idx);
  if (accidentals && Math.random() < 0.5) {
    const acc = Math.random() < 0.5 ? 1 : -1;
    pitch = { ...pitch, accidental: acc };
  }
  return { clef, pitch };
}

export function NoteReading() {
  const { settings } = useSettings();
  const { stats, answer } = useExerciseSession("notas");
  const [mode, setMode] = useState<ClefMode>("treble");
  const [range, setRange] = useState<Range>("staff");
  const [accidentals, setAccidentals] = useState(false);
  const [q, setQ] = useState<Question>(() => makeQuestion("treble", "staff", false));
  const [chosenAcc, setChosenAcc] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [chosen, setChosen] = useState<Letter | null>(null);

  const next = useCallback(() => {
    setQ((prev) => makeQuestion(mode, range, accidentals, prev));
    setFeedback(null);
    setChosen(null);
    setChosenAcc(0);
  }, [mode, range, accidentals]);

  const regenerate = (m: ClefMode, r: Range, a: boolean) => {
    setMode(m);
    setRange(r);
    setAccidentals(a);
    setQ(makeQuestion(m, r, a));
    setFeedback(null);
    setChosen(null);
    setChosenAcc(0);
  };

  const choose = (letter: Letter) => {
    if (feedback) return;
    const acc = accidentals ? chosenAcc : 0;
    const correct = letter === q.pitch.letter && acc === q.pitch.accidental;
    setChosen(letter);
    answer(correct);
    if (settings.sound) void unlockAudio().then(() => playNote(toMidi(q.pitch), { duration: 0.8, velocity: settings.volume }));
    setFeedback({
      correct,
      message: correct ? (
        <>
          Es <strong>{fullName(q.pitch, settings.naming)}</strong> en clave de {q.clef === "treble" ? "sol" : "fa"}.
        </>
      ) : (
        <>
          La nota es <strong>{fullName(q.pitch, settings.naming)}</strong>, no {noteName({ letter, accidental: acc, octave: 4 }, settings.naming)}.
        </>
      ),
    });
  };

  const measures = useMemo(() => [`${toEasyScore(q.pitch)}/w`], [q]);

  return (
    <ExerciseShell
      title="Leer notas"
      stats={stats}
      feedback={feedback}
      onNext={next}
      settings={
        <>
          <SettingRow label="Clave">
            <Choice active={mode === "treble"} onClick={() => regenerate("treble", range, accidentals)}>Sol</Choice>
            <Choice active={mode === "bass"} onClick={() => regenerate("bass", range, accidentals)}>Fa</Choice>
            <Choice active={mode === "both"} onClick={() => regenerate("both", range, accidentals)}>Ambas</Choice>
          </SettingRow>
          <SettingRow label="Rango">
            <Choice active={range === "staff"} onClick={() => regenerate(mode, "staff", accidentals)}>Dentro del pentagrama</Choice>
            <Choice active={range === "ledger"} onClick={() => regenerate(mode, "ledger", accidentals)}>Con líneas adicionales</Choice>
          </SettingRow>
          <SettingRow label="Alteraciones">
            <Choice active={!accidentals} onClick={() => regenerate(mode, range, false)}>No</Choice>
            <Choice active={accidentals} onClick={() => regenerate(mode, range, true)}>Sí</Choice>
          </SettingRow>
        </>
      }
    >
      <p className="text-sm text-ink-2 text-center">¿Qué nota es?</p>
      <div className="flex justify-center">
        <Score clef={q.clef} measures={measures} width={260} height={150} highlight={feedback ? 0 : undefined} />
      </div>
      {accidentals && (
        <div className="flex justify-center gap-2">
          {[-1, 0, 1].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setChosenAcc(a)}
              disabled={!!feedback}
              className={`pill w-12 justify-center ${chosenAcc === a ? "pill-active" : ""}`}
              aria-label={a === -1 ? "bemol" : a === 1 ? "sostenido" : "natural"}
            >
              <span className="smufl-text text-lg">{a === -1 ? "" : a === 1 ? "" : ""}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {LETTERS.map((l) => {
          let state: "idle" | "correct" | "wrong" | "dim" = "idle";
          if (feedback) {
            if (l === q.pitch.letter) state = "correct";
            else if (l === chosen) state = "wrong";
            else state = "dim";
          }
          return (
            <OptionButton key={l} onClick={() => choose(l)} state={state} disabled={!!feedback}>
              {settings.naming === "latino" ? LATIN_NAMES[l] : l}
            </OptionButton>
          );
        })}
      </div>
    </ExerciseShell>
  );
}
