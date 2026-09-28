"use client";

import { useCallback, useMemo, useState } from "react";
import { Score } from "@/components/notation/score";
import { ExerciseShell, SettingRow, Choice, useExerciseSession, type Feedback } from "./exercise-shell";
import { AccidentalPicker, KeyboardHint, NoteOptions } from "./note-options";
import { TimerRing } from "./answer-timer";
import { NamingRow } from "./naming-row";
import { diatonicIndex, fromDiatonicIndex, toEasyScore, toMidi, type Pitch, type Letter } from "@/lib/music/pitch";
import { letterLabel, pitchText } from "@/lib/practice/naming";
import { useNoteKeyboard } from "@/lib/practice/note-keys";
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

/** Segundos por respuesta; 0 = sin reloj. El primero es el de partida. */
const CLOCKS = [10, 7, 5, 0];

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

/**
 * Repaso libre: la cola infinita de siempre, con los ajustes a mano. Es lo que
 * queda del ejercicio original, para quien ya pasó los niveles o quiere
 * insistir en una clave concreta sin volver a jugarlos.
 */
export function NoteReadingFree({ switcher }: { switcher: React.ReactNode }) {
  const { settings } = useSettings();
  const { stats, answer } = useExerciseSession("notas");
  // La clave de partida es la de Ajustes; en cuanto se toca el control manda
  // lo elegido aquí.
  const [clef, setClef] = useState<ClefMode | null>(null);
  const mode = clef ?? settings.defaultClef;
  const [range, setRange] = useState<Range>("staff");
  const [accidentals, setAccidentals] = useState(false);
  const [clock, setClock] = useState(CLOCKS[0]);
  const pool = useMemo(() => buildPool(mode, range, accidentals), [mode, range, accidentals]);
  const [chosenAcc, setChosenAcc] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [chosen, setChosen] = useState<Letter | null>(null);
  // Cuántas preguntas van: lo único que necesita el reloj para volver a empezar.
  const [asks, setAsks] = useState(0);

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
    setAsks((n) => n + 1);
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

  const grade = (correct: boolean, letter: Letter | null, acc: number) => {
    setChosen(letter);
    answer(correct);
    recordItem("notas", itemKey(q), correct);
    if (settings.sound) void unlockAudio().then(() => playNote(toMidi(q.pitch), { duration: 0.8, velocity: settings.volume }));
    const name = pitchText(q.pitch, settings);
    setFeedback({
      correct,
      message: correct ? (
        <>
          Es <strong>{name}</strong> en clave de {q.clef === "treble" ? "sol" : "fa"}.
        </>
      ) : letter ? (
        <>
          La nota es <strong>{name}</strong>, no {letterLabel(letter, acc, settings).main}.
        </>
      ) : (
        <>
          Se acabó el tiempo. Era <strong>{name}</strong>.
        </>
      ),
    });
  };

  const choose = (letter: Letter) => {
    if (feedback) return;
    const acc = accidentals ? chosenAcc : 0;
    grade(letter === q.pitch.letter && acc === q.pitch.accidental, letter, acc);
  };

  useNoteKeyboard({
    enabled: !feedback,
    onLetter: choose,
    onAccidental: accidentals ? setChosenAcc : undefined,
  });

  const measures = useMemo(() => [`${toEasyScore(q.pitch)}/w`], [q]);

  return (
    <ExerciseShell
      title="Leer notas"
      stats={stats}
      feedback={feedback}
      onNext={next}
      topbar={switcher}
      settings={
        <>
          <NamingRow />
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
          <SettingRow label="Reloj">
            {CLOCKS.map((s) => (
              <Choice key={s} active={clock === s} onClick={() => setClock(s)}>
                {s === 0 ? "Sin reloj" : `${s} s`}
              </Choice>
            ))}
          </SettingRow>
        </>
      }
    >
      <div className="flex items-center justify-center gap-4">
        <p className="text-sm text-ink-2">¿Qué nota es?</p>
        {clock > 0 && (
          <TimerRing
            seconds={clock}
            running={!feedback}
            resetKey={asks}
            onTimeout={() => grade(false, null, 0)}
            size={44}
          />
        )}
      </div>
      <div className="flex justify-center">
        <Score clef={q.clef} measures={measures} width={260} height={150} highlight={feedback ? 0 : undefined} />
      </div>
      {accidentals && <AccidentalPicker value={chosenAcc} onChange={setChosenAcc} disabled={!!feedback} />}
      <NoteOptions
        accidental={accidentals ? chosenAcc : 0}
        chosen={chosen}
        correct={q.pitch.letter}
        revealed={!!feedback}
        onChoose={choose}
      />
      <KeyboardHint accidentals={accidentals} />
    </ExerciseShell>
  );
}
