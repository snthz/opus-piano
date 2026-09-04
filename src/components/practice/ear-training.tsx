"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExerciseShell, OptionButton, SettingRow, Choice, useExerciseSession, type Feedback } from "./exercise-shell";
import { INTERVALS, type IntervalInfo } from "@/lib/music/scales";
import { playSequence, unlockAudio, type PlaybackHandle } from "@/lib/audio/synth";
import { pickDifferent, randInt } from "@/lib/random";
import { useSettings } from "@/lib/settings";

type Motion = "asc" | "desc" | "harm";

const SETS: Record<string, number[]> = {
  basico: [2, 4, 5, 7, 12],
  medio: [1, 2, 3, 4, 5, 7, 9, 12],
  completo: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

interface Question {
  interval: IntervalInfo;
  root: number;
  motion: Motion;
}

function makeQuestion(set: string, motion: Motion | "mixto", prev?: Question): Question {
  const semis = SETS[set];
  const interval = pickDifferent(
    semis.map((s) => INTERVALS.find((i) => i.semitones === s)!),
    prev?.interval,
    (a, b) => a.semitones === b.semitones,
  );
  const m: Motion = motion === "mixto" ? (["asc", "desc", "harm"] as Motion[])[randInt(0, 2)] : motion;
  const root = randInt(55, 72);
  return { interval, root, motion: m };
}

export function EarTraining() {
  const { settings } = useSettings();
  const { stats, answer } = useExerciseSession("oido");
  const [set, setSet] = useState("basico");
  const [motion, setMotion] = useState<Motion | "mixto">("asc");
  const [q, setQ] = useState<Question>(() => makeQuestion("basico", "asc"));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [played, setPlayed] = useState(false);
  const handle = useRef<PlaybackHandle | null>(null);

  useEffect(() => () => handle.current?.stop(), []);

  const play = async (question = q) => {
    await unlockAudio();
    handle.current?.stop();
    const hi = question.root + question.interval.semitones;
    const events =
      question.motion === "harm"
        ? [{ midis: [question.root, hi], beats: 2 }]
        : question.motion === "asc"
          ? [{ midis: [question.root], beats: 1 }, { midis: [hi], beats: 1.5 }]
          : [{ midis: [hi], beats: 1 }, { midis: [question.root], beats: 1.5 }];
    handle.current = playSequence(events, 80);
    setPlayed(true);
  };

  const next = useCallback(() => {
    const nq = makeQuestion(set, motion, q);
    setQ(nq);
    setFeedback(null);
    setChosen(null);
    setPlayed(false);
    window.setTimeout(() => void play(nq), 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, motion, q]);

  const regenerate = (s: string, m: Motion | "mixto") => {
    setSet(s);
    setMotion(m);
    setQ(makeQuestion(s, m));
    setFeedback(null);
    setChosen(null);
    setPlayed(false);
  };

  const choose = (i: IntervalInfo) => {
    if (feedback) return;
    const correct = i.semitones === q.interval.semitones;
    setChosen(i.semitones);
    answer(correct);
    setFeedback({
      correct,
      message: (
        <>
          Era una <strong>{q.interval.name}</strong> ({q.interval.semitones} semitonos)
          {q.interval.reference ? `, como el inicio de «${q.interval.reference}»` : ""}.
        </>
      ),
    });
  };

  const options = SETS[set].map((s) => INTERVALS.find((i) => i.semitones === s)!);

  return (
    <ExerciseShell
      title="Oído: intervalos"
      stats={stats}
      feedback={feedback}
      onNext={next}
      color="bg-mint"
      settings={
        <>
          <SettingRow label="Intervalos">
            <Choice active={set === "basico"} onClick={() => regenerate("basico", motion)}>Básicos</Choice>
            <Choice active={set === "medio"} onClick={() => regenerate("medio", motion)}>Medios</Choice>
            <Choice active={set === "completo"} onClick={() => regenerate("completo", motion)}>Todos</Choice>
          </SettingRow>
          <SettingRow label="Movimiento">
            <Choice active={motion === "asc"} onClick={() => regenerate(set, "asc")}>Ascendente</Choice>
            <Choice active={motion === "desc"} onClick={() => regenerate(set, "desc")}>Descendente</Choice>
            <Choice active={motion === "harm"} onClick={() => regenerate(set, "harm")}>Simultáneo</Choice>
            <Choice active={motion === "mixto"} onClick={() => regenerate(set, "mixto")}>Mixto</Choice>
          </SettingRow>
        </>
      }
    >
      <p className="text-sm text-ink-2 text-center">Escucha las dos notas e identifica el intervalo.</p>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => play()}
          disabled={!settings.sound}
          className="btn-circle w-24 h-24 text-3xl disabled:opacity-50"
          aria-label="Escuchar el intervalo"
        >
          ▶
        </button>
      </div>
      <p className="text-xs text-center text-ink-3">{played ? "Puedes volver a escucharlo las veces que quieras." : "Pulsa para escuchar."}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {options.map((i) => {
          let state: "idle" | "correct" | "wrong" | "dim" = "idle";
          if (feedback) state = i.semitones === q.interval.semitones ? "correct" : i.semitones === chosen ? "wrong" : "dim";
          return (
            <OptionButton key={i.semitones} onClick={() => choose(i)} state={state} disabled={!!feedback || !played}>
              {i.name}
            </OptionButton>
          );
        })}
      </div>
    </ExerciseShell>
  );
}
