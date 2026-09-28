"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Score } from "@/components/notation/score";
import { ExerciseHeader, useExerciseSession } from "./exercise-shell";
import { AccidentalPicker, KeyboardHint, NoteOptions } from "./note-options";
import { RoundDots, TimerRing } from "./answer-timer";
import { LevelMap, Stars } from "./level-map";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import {
  LEVEL_BY_ID,
  READING_LEVELS,
  ROUND_LENGTH,
  buildLevelPool,
  gradeRound,
  questionKey,
  type ReadingLevel,
  type ReadingQuestion,
} from "@/lib/practice/reading-levels";
import { recordLevel, starTotals, unlockedCount, useLevelProgress } from "@/lib/practice/level-progress";
import { pitchText } from "@/lib/practice/naming";
import { useNoteKeyboard } from "@/lib/practice/note-keys";
import { nextItem, recordItem } from "@/lib/practice/item-stats";
import { toEasyScore, toMidi, type Letter } from "@/lib/music/pitch";
import { useSettings } from "@/lib/settings";
import { playNote, unlockAudio } from "@/lib/audio/synth";

const LEVEL_IDS = READING_LEVELS.map((l) => l.id);
const EXERCISE = "notas";

export function NoteReadingLevels({ switcher }: { switcher: React.ReactNode }) {
  const records = useLevelProgress(EXERCISE);
  const unlocked = unlockedCount(LEVEL_IDS, records);
  const [levelId, setLevelId] = useState<string | null>(null);
  const level = levelId ? LEVEL_BY_ID[levelId] : null;
  const { earned, possible } = starTotals(LEVEL_IDS, records);

  if (level) {
    return (
      <Round
        key={level.id}
        level={level}
        onExit={() => setLevelId(null)}
        onNextLevel={() => {
          const next = READING_LEVELS[level.n];
          setLevelId(next ? next.id : null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ExerciseHeader title="Leer notas" />
      {switcher}
      <div className="card-pastel bg-mint px-5 py-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tabular-nums">
            {earned}
            <span className="text-ink-2 text-base font-medium">/{possible}</span>
          </p>
          <p className="text-xs text-ink-2">estrellas</p>
        </div>
        <p className="text-xs text-ink-2 text-right max-w-56">
          {unlocked < LEVEL_IDS.length
            ? `Nivel ${unlocked} de ${LEVEL_IDS.length}. Cada nivel son ${ROUND_LENGTH} notas contra reloj.`
            : "Todos los niveles abiertos. Ahora, a por las tres estrellas."}
        </p>
      </div>
      <LevelMap levels={READING_LEVELS} records={records} unlocked={unlocked} onPick={setLevelId} />
    </div>
  );
}

type RoundPhase = "intro" | "asking" | "revealed" | "done";

interface Picked {
  letter: Letter;
  accidental: number;
}

interface Summary {
  stars: number;
  passed: boolean;
  score: number;
  correct: number;
  avgMs: number;
}

function Round({ level, onExit, onNextLevel }: { level: ReadingLevel; onExit: () => void; onNextLevel: () => void }) {
  const { settings } = useSettings();
  const { answer } = useExerciseSession(EXERCISE);
  const pool = useMemo(() => buildLevelPool(level), [level]);

  const [phase, setPhase] = useState<RoundPhase>("intro");
  const [question, setQuestion] = useState<ReadingQuestion>(() => nextItem(EXERCISE, pool, questionKey));
  const [results, setResults] = useState<boolean[]>([]);
  const [times, setTimes] = useState<number[]>([]);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [accidental, setAccidental] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const askedAt = useRef(0);
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  const start = () => {
    askedAt.current = performance.now();
    setPhase("asking");
  };

  const finish = useCallback(
    (res: boolean[], ms: number[]) => {
      const correct = res.filter(Boolean).length;
      const avgMs = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0;
      const grade = gradeRound(correct, ROUND_LENGTH, avgMs, level.seconds * 1000);
      recordLevel(EXERCISE, level.id, grade.stars, grade.score);
      setSummary({ ...grade, correct, avgMs });
      setPhase("done");
    },
    [level],
  );

  /** Cierra la pregunta: la apunta, la enseña un momento y pasa a la siguiente. */
  const resolve = (correct: boolean, chosen: Picked | null) => {
    if (phase !== "asking") return;
    const ms = performance.now() - askedAt.current;
    const res = [...results, correct];
    const ts = [...times, ms];
    setPicked(chosen);
    setResults(res);
    setTimes(ts);
    setPhase("revealed");
    answer(correct);
    recordItem(EXERCISE, questionKey(question), correct);
    if (settings.sound) {
      void unlockAudio().then(() => playNote(toMidi(question.pitch), { duration: 0.8, velocity: settings.volume }));
    }
    // Acertar no necesita explicación; fallar sí, así que la nota correcta se
    // queda en pantalla el doble de tiempo.
    const pause = correct ? 750 : 1700;
    clearTimer();
    timer.current = window.setTimeout(() => {
      if (res.length >= ROUND_LENGTH) {
        finish(res, ts);
        return;
      }
      setQuestion((prev) => nextItem(EXERCISE, pool, questionKey, prev));
      setPicked(null);
      setAccidental(0);
      askedAt.current = performance.now();
      setPhase("asking");
    }, pause);
  };

  const choose = (letter: Letter) => {
    const acc = level.accidentals ? accidental : 0;
    resolve(letter === question.pitch.letter && acc === question.pitch.accidental, { letter, accidental: acc });
  };

  const timeout = () => resolve(false, null);

  useNoteKeyboard({
    enabled: phase === "asking",
    onLetter: choose,
    onAccidental: level.accidentals ? setAccidental : undefined,
  });

  const measures = useMemo(() => [`${toEasyScore(question.pitch)}/w`], [question]);
  const answered = results.length;

  if (phase === "intro" || phase === "done") {
    return (
      <div className="space-y-4">
        <ExerciseHeader title={`Nivel ${level.n} · ${level.name}`} />
        {phase === "intro" ? (
          <IntroCard level={level} onStart={start} onExit={onExit} />
        ) : (
          <SummaryCard
            level={level}
            summary={summary!}
            onExit={onExit}
            onRetry={() => {
              setResults([]);
              setTimes([]);
              setSummary(null);
              setPicked(null);
              setAccidental(0);
              setQuestion(nextItem(EXERCISE, pool, questionKey));
              start();
            }}
            onNextLevel={onNextLevel}
            hasNext={level.n < READING_LEVELS.length}
          />
        )}
      </div>
    );
  }

  const revealed = phase === "revealed";
  const correctNow = revealed && results[results.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            clearTimer();
            onExit();
          }}
          aria-label="Salir del nivel"
          className="card w-11 h-11 flex items-center justify-center hover:bg-surface-2 shrink-0"
        >
          <ChevronIcon dir="left" />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-xs text-ink-3">Nivel {level.n}</p>
          <h1 className="text-base font-semibold tracking-tight truncate">{level.name}</h1>
        </div>
        <TimerRing seconds={level.seconds} running={phase === "asking"} resetKey={answered} onTimeout={timeout} />
      </div>

      <RoundDots results={results} total={ROUND_LENGTH} />

      <div className="card p-4 md:p-6 space-y-5">
        <p className="text-sm text-ink-2 text-center">¿Qué nota es?</p>
        <div className="flex justify-center">
          <Score
            clef={question.clef}
            measures={measures}
            width={260}
            height={150}
            highlight={revealed ? 0 : undefined}
            highlightColor={correctNow ? "var(--ok)" : "var(--bad)"}
          />
        </div>

        {level.accidentals && <AccidentalPicker value={accidental} onChange={setAccidental} disabled={revealed} />}

        <NoteOptions
          accidental={level.accidentals ? accidental : 0}
          chosen={picked?.letter ?? null}
          correct={question.pitch.letter}
          revealed={revealed}
          onChoose={choose}
        />
        <KeyboardHint accidentals={level.accidentals} />

        <p className="text-sm text-center min-h-5" role="status">
          {revealed ? (
            correctNow ? (
              <span className="text-ok font-medium">¡Bien! {pitchText(question.pitch, settings)}</span>
            ) : picked ? (
              <span className="text-bad">
                Es <strong>{pitchText(question.pitch, settings)}</strong>, en clave de {question.clef === "treble" ? "sol" : "fa"}.
              </span>
            ) : (
              <span className="text-bad">
                Se acabó el tiempo: era <strong>{pitchText(question.pitch, settings)}</strong>.
              </span>
            )
          ) : (
            <span className="text-ink-3 text-xs">{level.hint}</span>
          )}
        </p>
      </div>
    </div>
  );
}

function IntroCard({ level, onStart, onExit }: { level: ReadingLevel; onStart: () => void; onExit: () => void }) {
  return (
    <div className={`card-pastel ${level.color} p-6 space-y-4 text-center`}>
      <p className="text-xs uppercase tracking-wide text-ink-2">{level.group}</p>
      <h2 className="text-xl font-semibold">{level.name}</h2>
      <p className="text-sm text-ink-2 max-w-md mx-auto">{level.hint}</p>
      <ul className="text-xs text-ink-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        <li>{ROUND_LENGTH} notas</li>
        <li>{level.seconds} s por nota</li>
        <li>{level.accidentals ? "con alteraciones" : "sin alteraciones"}</li>
      </ul>
      <div className="flex justify-center gap-2 pt-1">
        <button type="button" onClick={onExit} className="pill">
          Volver
        </button>
        <button type="button" onClick={onStart} className="pill pill-active">
          Empezar
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  level,
  summary,
  onExit,
  onRetry,
  onNextLevel,
  hasNext,
}: {
  level: ReadingLevel;
  summary: Summary;
  onExit: () => void;
  onRetry: () => void;
  onNextLevel: () => void;
  hasNext: boolean;
}) {
  const seconds = (summary.avgMs / 1000).toFixed(1);
  return (
    <div className={`card-pastel ${summary.passed ? level.color : "bg-ash"} p-6 space-y-4 text-center`}>
      <div className="flex justify-center">
        <Stars count={summary.stars} size="lg" />
      </div>
      <h2 className="text-xl font-semibold">
        {summary.stars === 3 ? "¡Perfecto y rápido!" : summary.passed ? "Nivel superado" : "Casi"}
      </h2>
      <div className="flex justify-center gap-6 text-center">
        <div>
          <p className="text-2xl font-bold tabular-nums">
            {summary.correct}
            <span className="text-ink-2 text-base font-medium">/{ROUND_LENGTH}</span>
          </p>
          <p className="text-xs text-ink-2">aciertos</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{seconds}s</p>
          <p className="text-xs text-ink-2">por nota</p>
        </div>
      </div>
      <p className="text-sm text-ink-2 max-w-md mx-auto">
        {summary.stars === 3
          ? "Tres estrellas. Este nivel ya lo lees, no lo cuentas."
          : summary.stars === 2
            ? `Te falta velocidad para la tercera estrella: hay que bajar de ${(level.seconds / 2).toFixed(1)} s por nota sin fallar ninguna.`
            : summary.passed
              ? "Aprobado. Repítelo hasta que las notas te salgan solas y sube la puntuación."
              : "Con tres fallos o menos se aprueba. Vuelve a intentarlo: las notas que fallas salen más a menudo."}
      </p>
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <button type="button" onClick={onExit} className="pill">
          Ver niveles
        </button>
        <button type="button" onClick={onRetry} className="pill">
          Repetir
        </button>
        {summary.passed && hasNext && (
          <button type="button" onClick={onNextLevel} className="pill pill-active">
            Siguiente nivel
          </button>
        )}
      </div>
    </div>
  );
}
