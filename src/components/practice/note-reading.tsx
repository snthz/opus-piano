"use client";

import { useCallback, useMemo, useState } from "react";
import { Score } from "@/components/notation/score";
import { ExerciseShell, OptionButton, SettingRow, Choice, useExerciseSession, type Feedback } from "./exercise-shell";
import { LETTERS, LATIN_NAMES, diatonicIndex, fromDiatonicIndex, toEasyScore, fullName, noteName, toMidi, type Pitch, type Letter } from "@/lib/music/pitch";
import { nextItem, recordItem } from "@/lib/practice/item-stats";
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

/** Cada nota del ejercicio lleva su propia ficha: la de fa en clave de fa no es la de fa en clave de sol. */
const itemKey = (q: Question) => `${q.clef}|${toEasyScore(q.pitch)}`;

/** Todas las notas que el ejercicio puede preguntar con estos ajustes. */
function buildPool(mode: ClefMode, range: Range, accidentals: boolean): Question[] {
  const clefs: ("treble" | "bass")[] = mode === "both" ? ["treble", "bass"] : [mode];
  const pool: Question[] = [];
  for (const clef of clefs) {
    const [lo, hi] = RANGES[clef][range];
    for (let i = diatonicIndex(lo); i <= diatonicIndex(hi); i++) {
      const pitch = fromDiatonicIndex(i);
      pool.push({ clef, pitch });
      if (accidentals) for (const accidental of [1, -1]) pool.push({ clef, pitch: { ...pitch, accidental } });
    }
  }
  return pool;
}

/** La siguiente nota: la elige el repaso espaciado, no el azar (ver `scheduler.ts`). */
function makeQuestion(pool: Question[], prev?: Question): Question {
  return nextItem("notas", pool, itemKey, prev);
}

export function NoteReading() {
  const { settings } = useSettings();
  const { stats, answer } = useExerciseSession("notas");
  // La clave de partida es la de Ajustes; en cuanto se toca el control manda
  // lo elegido aquí.
  const [clef, setClef] = useState<ClefMode | null>(null);
  const mode = clef ?? settings.defaultClef;
  const [range, setRange] = useState<Range>("staff");
  const [accidentals, setAccidentals] = useState(false);
  const pool = useMemo(() => buildPool(mode, range, accidentals), [mode, range, accidentals]);
  const [chosenAcc, setChosenAcc] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [chosen, setChosen] = useState<Letter | null>(null);

  // La pregunta va con su repertorio: si cambian los ajustes del ejercicio
  // (o llegan los del usuario tras hidratar), se hace otra del nuevo.
  const [asked, setAsked] = useState<{ pool: Question[]; q: Question }>(() => ({ pool, q: makeQuestion(pool) }));
  if (asked.pool !== pool) {
    setAsked({ pool, q: makeQuestion(pool) });
    setFeedback(null);
    setChosen(null);
    setChosenAcc(0);
  }
  const q = asked.q;

  const next = useCallback(() => {
    setAsked((prev) => ({ pool, q: makeQuestion(pool, prev.q) }));
    setFeedback(null);
    setChosen(null);
    setChosenAcc(0);
  }, [pool]);

  const regenerate = (m: ClefMode, r: Range, a: boolean) => {
    setClef(m);
    setRange(r);
    setAccidentals(a);
  };

  const choose = (letter: Letter) => {
    if (feedback) return;
    const acc = accidentals ? chosenAcc : 0;
    const correct = letter === q.pitch.letter && acc === q.pitch.accidental;
    setChosen(letter);
    answer(correct);
    recordItem("notas", itemKey(q), correct);
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
