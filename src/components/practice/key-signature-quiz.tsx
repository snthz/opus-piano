"use client";

import { useCallback, useState } from "react";
import { Score } from "@/components/notation/score";
import { ExerciseShell, OptionButton, SettingRow, Choice, useExerciseSession, type Feedback } from "./exercise-shell";
import { MAJOR_KEYS, MINOR_KEYS, keyName, relativeKey, keyAccidentals, type KeyInfo } from "@/lib/music/keys";
import { LATIN_NAMES } from "@/lib/music/pitch";
import { nextItem, recordItem } from "@/lib/practice/item-stats";
import { sample, shuffle } from "@/lib/random";
import { useSettings } from "@/lib/settings";

type Mode = "mayor" | "menor" | "ambas";

interface Question {
  target: KeyInfo;
  options: KeyInfo[];
}

function makeQuestion(mode: Mode, maxAcc: number, prev?: Question): Question {
  const base = mode === "mayor" ? MAJOR_KEYS : mode === "menor" ? MINOR_KEYS : [...MAJOR_KEYS, ...MINOR_KEYS];
  const items = base.filter((k) => Math.abs(k.fifths) <= maxAcc);
  // Cada tonalidad lleva su ficha: la armadura que se te atraganta vuelve antes.
  const target = nextItem("armaduras", items, (k) => k.vex, prev?.target);
  const sameMode = items.filter((k) => k.mode === target.mode && k.vex !== target.vex);
  // Distractores cercanos: preferimos tonalidades con ±1 o ±2 alteraciones.
  const near = sameMode.filter((k) => Math.abs(k.fifths - target.fifths) <= 2);
  let distractors = sample(near, 3);
  if (distractors.length < 3) {
    distractors = [...distractors, ...sample(sameMode.filter((k) => !distractors.includes(k)), 3 - distractors.length)];
  }
  return { target, options: shuffle([target, ...distractors]) };
}

export function KeySignatureQuiz() {
  const { settings } = useSettings();
  const { stats, answer } = useExerciseSession("armaduras");
  const [mode, setMode] = useState<Mode>("mayor");
  const [maxAcc, setMaxAcc] = useState(4);
  const [q, setQ] = useState<Question>(() => makeQuestion("mayor", 4));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  const next = useCallback(() => {
    setQ((prev) => makeQuestion(mode, maxAcc, prev));
    setFeedback(null);
    setChosen(null);
  }, [mode, maxAcc]);

  const regenerate = (m: Mode, n: number) => {
    setMode(m);
    setMaxAcc(n);
    setQ(makeQuestion(m, n));
    setFeedback(null);
    setChosen(null);
  };

  const choose = (k: KeyInfo) => {
    if (feedback) return;
    const correct = k.vex === q.target.vex;
    setChosen(k.vex);
    answer(correct);
    recordItem("armaduras", q.target.vex, correct);
    const { letters, accidental } = keyAccidentals(q.target);
    const accText = letters.length
      ? letters.map((l) => `${LATIN_NAMES[l]}${accidental === 1 ? "♯" : "♭"}`).join(", ")
      : "sin alteraciones";
    setFeedback({
      correct,
      message: (
        <>
          <strong>{keyName(q.target, settings.naming)}</strong> ({accText}). Relativa: {keyName(relativeKey(q.target), settings.naming)}.
        </>
      ),
    });
  };

  return (
    <ExerciseShell
      title="Armaduras"
      stats={stats}
      feedback={feedback}
      onNext={next}
      color="bg-yellow"
      settings={
        <>
          <SettingRow label="Modo">
            <Choice active={mode === "mayor"} onClick={() => regenerate("mayor", maxAcc)}>Mayor</Choice>
            <Choice active={mode === "menor"} onClick={() => regenerate("menor", maxAcc)}>Menor</Choice>
            <Choice active={mode === "ambas"} onClick={() => regenerate("ambas", maxAcc)}>Ambas</Choice>
          </SettingRow>
          <SettingRow label="Hasta">
            {[2, 4, 7].map((n) => (
              <Choice key={n} active={maxAcc === n} onClick={() => regenerate(mode, n)}>
                {n} alteraciones
              </Choice>
            ))}
          </SettingRow>
        </>
      }
    >
      <p className="text-sm text-ink-2 text-center">
        ¿Qué tonalidad {mode === "ambas" ? "" : mode === "mayor" ? "mayor " : "menor "}tiene esta armadura?
      </p>
      <div className="flex justify-center">
        <Score keySignature={q.target.vex} measures={[""]} width={220} height={110} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {q.options.map((k) => {
          let state: "idle" | "correct" | "wrong" | "dim" = "idle";
          if (feedback) state = k.vex === q.target.vex ? "correct" : k.vex === chosen ? "wrong" : "dim";
          return (
            <OptionButton key={k.vex} onClick={() => choose(k)} state={state} disabled={!!feedback}>
              {keyName(k, settings.naming)}
            </OptionButton>
          );
        })}
      </div>
    </ExerciseShell>
  );
}
