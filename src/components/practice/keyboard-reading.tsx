"use client";

import { useCallback, useMemo, useState } from "react";
import { Score } from "@/components/notation/score";
import { MidiConnect } from "@/components/midi/midi-connect";
import { PianoKeyboard } from "@/components/notation/piano-keyboard";
import { useMidi, useMidiNotes } from "@/lib/midi";
import { ExerciseShell, SettingRow, Choice, useExerciseSession, type Feedback } from "./exercise-shell";
import { diatonicIndex, fromDiatonicIndex, toEasyScore, fullName, toMidi, fromMidi, type Pitch } from "@/lib/music/pitch";
import { nextItem, recordItem } from "@/lib/practice/item-stats";
import { useSettings } from "@/lib/settings";
import { playNote, unlockAudio } from "@/lib/audio/synth";

type ClefMode = "treble" | "bass" | "both";

const RANGE: Record<"treble" | "bass", [Pitch, Pitch]> = {
  treble: [{ letter: "C", accidental: 0, octave: 4 }, { letter: "G", accidental: 0, octave: 5 }],
  bass: [{ letter: "E", accidental: 0, octave: 2 }, { letter: "C", accidental: 0, octave: 4 }],
};

interface Question {
  clef: "treble" | "bass";
  pitch: Pitch;
}

/** La misma ficha que en «Leer notas»: la nota y en qué clave se lee. */
const itemKey = (q: Question) => `${q.clef}|${toEasyScore(q.pitch)}`;

function buildPool(mode: ClefMode, accidentals: boolean): Question[] {
  const clefs: ("treble" | "bass")[] = mode === "both" ? ["treble", "bass"] : [mode];
  const pool: Question[] = [];
  for (const clef of clefs) {
    const [lo, hi] = RANGE[clef];
    for (let i = diatonicIndex(lo); i <= diatonicIndex(hi); i++) {
      const pitch = fromDiatonicIndex(i);
      pool.push({ clef, pitch });
      if (accidentals) for (const accidental of [1, -1]) pool.push({ clef, pitch: { ...pitch, accidental } });
    }
  }
  return pool;
}

function makeQuestion(pool: Question[], prev?: Question): Question {
  return nextItem("teclado", pool, itemKey, prev);
}

export function KeyboardReading() {
  const { settings } = useSettings();
  const { stats, answer } = useExerciseSession("teclado");
  const midiInput = useMidi(true);
  const [mode, setMode] = useState<ClefMode>("treble");
  const [accidentals, setAccidentals] = useState(false);
  const [labels, setLabels] = useState<"c" | "all" | "none">("c");
  const pool = useMemo(() => buildPool(mode, accidentals), [mode, accidentals]);
  const [q, setQ] = useState<Question>(() => makeQuestion(buildPool("treble", false)));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [wrongs, setWrongs] = useState<number[]>([]);

  const target = toMidi(q.pitch);

  const next = useCallback(() => {
    setQ((prev) => makeQuestion(pool, prev));
    setFeedback(null);
    setWrongs([]);
  }, [pool]);

  const regenerate = (m: ClefMode, a: boolean) => {
    setMode(m);
    setAccidentals(a);
    setQ(makeQuestion(buildPool(m, a)));
    setFeedback(null);
    setWrongs([]);
  };

  const press = (midi: number) => {
    if (feedback) return;
    if (midi === target) {
      answer(wrongs.length === 0);
      recordItem("teclado", itemKey(q), wrongs.length === 0);
      setFeedback({
        correct: true,
        message: (
          <>
            {wrongs.length === 0 ? "A la primera. " : `Tras ${wrongs.length} intento${wrongs.length > 1 ? "s" : ""}. `}
            Es <strong>{fullName(q.pitch, settings.naming)}</strong>.
          </>
        ),
      });
    } else {
      setWrongs((w) => [...w, midi]);
      if (wrongs.length >= 2) {
        answer(false);
        recordItem("teclado", itemKey(q), false);
        setFeedback({
          correct: false,
          message: (
            <>
              La tecla correcta era <strong>{fullName(q.pitch, settings.naming)}</strong> (tocaste {fullName(fromMidi(midi), settings.naming)}).
            </>
          ),
        });
        if (settings.sound) void unlockAudio().then(() => playNote(target, { duration: 0.8, velocity: settings.volume }));
      }
    }
  };

  // Con un teclado MIDI conectado, tocar la tecla es responder: lo mismo que
  // pulsar en el de la pantalla, pero con los dedos donde de verdad importa.
  useMidiNotes((e) => {
    if (!e.on) return;
    if (settings.sound) void unlockAudio().then(() => playNote(e.midi, { duration: 0.9, velocity: settings.volume }));
    press(e.midi);
  }, midiInput.status === "on");

  const measures = useMemo(() => [`${toEasyScore(q.pitch)}/w`], [q]);
  const from = q.clef === "treble" ? 55 : 36;
  const to = q.clef === "treble" ? 84 : 65;
  const playing = midiInput.status === "on" && midiInput.devices.length > 0;

  return (
    <ExerciseShell
      title="Tocar en el teclado"
      stats={stats}
      feedback={feedback}
      onNext={next}
      color="bg-ash"
      settings={
        <>
          <SettingRow label="Clave">
            <Choice active={mode === "treble"} onClick={() => regenerate("treble", accidentals)}>Sol</Choice>
            <Choice active={mode === "bass"} onClick={() => regenerate("bass", accidentals)}>Fa</Choice>
            <Choice active={mode === "both"} onClick={() => regenerate("both", accidentals)}>Ambas</Choice>
          </SettingRow>
          <SettingRow label="Alteraciones">
            <Choice active={!accidentals} onClick={() => regenerate(mode, false)}>No</Choice>
            <Choice active={accidentals} onClick={() => regenerate(mode, true)}>Sí</Choice>
          </SettingRow>
          <SettingRow label="Nombres en las teclas">
            <Choice active={labels === "none"} onClick={() => setLabels("none")}>Ninguno</Choice>
            <Choice active={labels === "c"} onClick={() => setLabels("c")}>Solo do</Choice>
            <Choice active={labels === "all"} onClick={() => setLabels("all")}>Todos</Choice>
          </SettingRow>
        </>
      }
    >
      <p className="text-sm text-ink-2 text-center">
        {playing ? "Toca esta nota en tu teclado" : "Toca esta nota en el teclado"} (tienes 3 intentos)
      </p>
      <div className="flex justify-center">
        <Score clef={q.clef} measures={measures} width={260} height={150} highlight={feedback ? 0 : undefined} />
      </div>
      <PianoKeyboard
        from={from}
        to={to}
        labels={labels}
        onPress={press}
        highlight={feedback ? [target] : []}
        highlightAlt={[]}
        held={midiInput.active}
        sound={settings.sound}
      />
      <MidiConnect />
      {wrongs.length > 0 && !feedback && (
        <p className="text-xs text-center text-bad">
          {wrongs.length === 1 ? "No es esa. Prueba otra vez." : "Último intento. Pista: cuenta las posiciones desde el do central."}
        </p>
      )}
    </ExerciseShell>
  );
}
