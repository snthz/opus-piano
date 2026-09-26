"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScaleCard } from "@/components/notation/scale-card";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { ProgressRing } from "@/components/ui/progress-ring";
import { planKey, sessionSteps, STEP_LABELS, type AgendaEntry, type SessionStep } from "@/lib/agenda";
import { Metronome, playChime, unlockAudio } from "@/lib/audio/synth";
import { clockNeeded, type PracticeLog } from "@/lib/agenda";
import { parseBpm } from "@/lib/music/fingering";
import { usePracticeTracker, type PracticeTracker } from "@/lib/practice-log";
import { pomodoro } from "@/lib/pomodoro";
import { TIME_SIGNATURE_BY_ID } from "@/lib/music/meter";
import { clock, useSessionRun } from "@/lib/session-run";
import { useSettings } from "@/lib/settings";
import { goalChips, OUTCOMES, OUTCOME_LABELS, type Outcome } from "@/lib/study-plan";
import { Chip, PlayIcon, StepIcon, StepStrip } from "./session-card";

/**
 * A study session, step by step: the timer of the current step, what to do
 * in it, and the material — the scale with its fingering in the warm-up, the
 * goal's measures, fingerings, tips and a metronome in the goal steps. When
 * the last step's time runs out the session is marked as studied.
 *
 * The clock lives in `useSessionRun`, saved to localStorage, so leaving the
 * page for the score and coming back picks up where it was.
 *
 * `compact` is the version beside the score in the reader: one narrow column,
 * no back button (the panel has its own), and no link to the score.
 */
export function SessionRunner({
  entry,
  onExit,
  onDone,
  onReview,
  compact = false,
}: {
  entry: AgendaEntry;
  /** Back to the sessions list; without it, finishing offers a link to the sessions page. */
  onExit?: () => void;
  onDone: () => void;
  /** Cómo ha ido el objetivo; sin esto no se pregunta. */
  onReview?: (outcome: Outcome) => void;
  compact?: boolean;
}) {
  const { score, plan, session } = entry;
  const { settings } = useSettings();
  const steps = sessionSteps(plan, session);
  const key = planKey(plan);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  const sound = settings.sound;

  const run = useSessionRun(score.id, session.day, steps, {
    onStepEnd: () => {
      if (sound) playChime(settings.volume * 0.7);
    },
    onFinish: () => {
      if (!session.done) doneRef.current();
    },
  });
  const { step, running, state } = run;
  const total = steps.reduce((n, s) => n + s.minutes, 0);
  // what the clock really saw: this, not the tick, is what feeds the streak
  const practice = usePracticeTracker(score.id, session.day, total, running);

  useWakeLock(running);

  const toggle = useCallback(async () => {
    if (running) run.pause();
    else {
      // from a user gesture: iOS won't play the chime later otherwise
      await unlockAudio();
      // one clock at a time: the session takes over from a running pomodoro
      pomodoro.pause();
      run.start();
    }
  }, [running, run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("button, input, select, textarea, a, summary")) return;
      if (e.code === "Space") {
        e.preventDefault();
        void toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // La respuesta se guarda con la partitura; aquí solo hace falta para dejar
  // de preguntar y decir qué pasa con el plan.
  const [reviewed, setReviewed] = useState<Outcome | null>(null);
  const chips = goalChips(session.goal);
  // Beside the score (sheet or side panel) the blocks are flat, on the panel's
  // own surface: a card's shadow there only drew edges around each one.
  const box = (pad: string) => (compact ? "" : `card ${pad}`);

  return (
    <div className={compact ? "space-y-4" : "space-y-4 lg:grid lg:grid-cols-[22rem_1fr] lg:gap-6 lg:space-y-0 lg:items-start"}>
      {/* ---- Left (top on a phone): where we are and the clock ---- */}
      <div className={compact ? "space-y-4" : "space-y-4 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]"}>
        <header className="flex items-center gap-3">
          {onExit && (
            <button type="button" onClick={onExit} aria-label="Volver a las sesiones" className="btn-circle w-10 h-10 shrink-0 bg-surface text-ink border border-line">
              <ChevronIcon dir="left" className="w-4 h-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-2 truncate">
              {/* beside the score its name is already on screen */}
              {compact ? "" : `${score.name} · `}Sesión {session.ofGoal.n} de {session.ofGoal.total}
            </p>
            {/* in the narrow panel the title gets two lines rather than an ellipsis */}
            <h2 className={`font-bold leading-tight ${compact ? "line-clamp-2" : "truncate"}`}>{session.goal.title}</h2>
          </div>
        </header>

        <section className={compact ? "space-y-4" : "card p-5 space-y-5"}>
          <StepStrip steps={steps} current={state.finished ? steps.length : state.index} onPick={run.goTo} />

          {state.finished ? (
            <Finished
              minutes={total}
              practice={practice.log}
              counts={practice.counts}
              onRepeat={run.reset}
              onExit={onExit}
              onReview={onReview && ((outcome) => { setReviewed(outcome); onReview(outcome); })}
              reviewed={reviewed}
            />
          ) : (
            step && (
              <>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 inline-flex items-center gap-1.5">
                    <StepIcon kind={step.kind} className="w-4 h-4" />
                    {STEP_LABELS[step.kind]} · paso {state.index + 1} de {steps.length}
                  </p>
                  <div className={`relative grid place-items-center text-ink ${compact ? "w-36 h-36" : "w-44 h-44"}`}>
                    <ProgressRing progress={run.fraction} stroke={2.5} className={compact ? "w-36 h-36" : "w-44 h-44"} />
                    <div className="absolute text-center">
                      <p className={`font-bold tabular-nums tracking-tight leading-none ${compact ? "text-4xl" : "text-5xl"}`} aria-live="off">
                        {clock(run.remaining)}
                      </p>
                      <p className="mt-1.5 text-xs text-ink-2 tabular-nums">de {step.minutes} min</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-4">
                  <RoundButton label="Paso anterior" onClick={run.prev} disabled={state.index === 0} muted>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
                      <path d="M6 6h2v12H6zM18 6v12L9 12z" />
                    </svg>
                  </RoundButton>
                  <button
                    type="button"
                    onClick={() => void toggle()}
                    aria-pressed={running}
                    aria-label={running ? "Pausar el cronómetro" : "Poner en marcha el cronómetro"}
                    className="btn-circle w-20 h-20 shadow-lg active:scale-95"
                  >
                    {running ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7" aria-hidden>
                        <rect x="6" y="5.5" width="4" height="13" rx="1.2" />
                        <rect x="14" y="5.5" width="4" height="13" rx="1.2" />
                      </svg>
                    ) : (
                      <PlayIcon className="w-8 h-8 translate-x-0.5" />
                    )}
                  </button>
                  <RoundButton label={state.index === steps.length - 1 ? "Terminar la sesión" : "Siguiente paso"} onClick={run.next} muted>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
                      <path d="M16 6h2v12h-2zM6 6v12l9-6z" />
                    </svg>
                  </RoundButton>
                </div>

                <p className="text-center text-xs text-ink-3 tabular-nums">
                  {Math.floor(run.minutesDone)} de {total} min de sesión
                  {!running && state.index === 0 && run.elapsed === 0 ? " · pulsa ▶ para empezar" : running ? "" : " · en pausa"}
                </p>

                <PracticeBar practice={practice} />
              </>
            )
          )}
        </section>
      </div>

      {/* ---- Right: what to do in this step ---- */}
      {!state.finished && step && (
        <div className="space-y-4 min-w-0">
          <section className="card-pastel bg-yellow p-4 md:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-2 mb-1">Ahora</p>
            <p className="font-medium leading-snug">{step.activity}</p>
          </section>

          {step.kind === "calentamiento" && (
            <section className={`${box("p-4 md:p-5")} space-y-4`}>
              {key ? (
                <ScaleCard keyInfo={key} hands={session.goal.hands} />
              ) : (
                <p className="text-sm text-ink-2">{plan.analysis.scale || "Calienta con la escala y el arpegio de la tonalidad de la pieza."}</p>
              )}
              {plan.warmups.length > 0 && (
                <div className="border-t border-line pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">También</p>
                  <ul className="space-y-1 text-sm text-ink-2">
                    {plan.warmups.map((w, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-ink-3" aria-hidden>
                          –
                        </span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {step.kind === "objetivo" && <GoalPanel entry={entry} chips={chips} step={step} flat={compact} />}

          {step.kind === "repaso" && (
            <section className={`${box("p-4 md:p-5")} space-y-3`}>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <Chip key={c}>{c}</Chip>
                ))}
              </div>
              <p className="text-sm text-ink-2">{plan.routine.advice}</p>
              {session.goal.targetTempo && (
                <p className="text-sm">
                  <span className="font-medium">Se da por cumplido: </span>
                  <span className="text-ink-2">{session.goal.targetTempo}</span>
                </p>
              )}
              {!compact && (
                <Link href={`/scores?score=${encodeURIComponent(score.id)}`} className="pill text-xs py-1.5">
                  Abrir la partitura
                </Link>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/** The goal step: the measures and hands, the fingering, the tips, and a metronome set to the target tempo. */
function GoalPanel({ entry, chips, step, flat }: { entry: AgendaEntry; chips: string[]; step: SessionStep; flat?: boolean }) {
  const { score, plan, session } = entry;
  const goal = session.goal;
  const bpm = parseBpm(goal.targetTempo) ?? parseBpm(plan.analysis.tempo) ?? 60;
  const meter = TIME_SIGNATURE_BY_ID[plan.analysis.timeSignature.replace("/", "-")];
  const beats = meter?.beats ?? (Number(plan.analysis.timeSignature.split("/")[0]) || 4);

  return (
    <section className={flat ? "space-y-4" : "card p-4 md:p-5 space-y-4"}>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
        {goal.targetTempo && <Chip>{goal.targetTempo}</Chip>}
      </div>

      {goal.description && step.activity !== goal.description && <p className="text-sm text-ink-2">{goal.description}</p>}

      {goal.fingering && (
        <div className="rounded-2xl bg-surface-2 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1">Digitación</p>
          <p className="text-sm font-medium whitespace-pre-line tabular-nums leading-relaxed">{goal.fingering}</p>
        </div>
      )}

      {goal.tips.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {goal.tips.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 w-4 h-4 rounded-full bg-ink text-bg text-[10px] font-bold grid place-items-center shrink-0 tabular-nums" aria-hidden>
                {i + 1}
              </span>
              <span className="text-ink-2">{t}</span>
            </li>
          ))}
        </ul>
      )}

      <MiniMetronome initialBpm={bpm} beats={beats} />

      <Link href={`/scores?score=${encodeURIComponent(score.id)}`} className="pill text-xs py-1.5">
        Abrir la partitura
      </Link>
    </section>
  );
}

const MIN_BPM = 30;
const MAX_BPM = 240;

/** A metronome in one row: tempo, −/+ by five, and the beat as a dot. The full one is a link away. */
function MiniMetronome({ initialBpm, beats }: { initialBpm: number; beats: number }) {
  const { settings } = useSettings();
  const [bpm, setBpm] = useState(initialBpm);
  const [on, setOn] = useState(false);
  const [beat, setBeat] = useState(-1);
  const metro = useRef<Metronome | null>(null);
  const muted = !settings.sound;

  useEffect(() => () => metro.current?.stop(), []);
  useEffect(() => {
    metro.current?.update({ bpm, beatsPerBar: beats, muted });
  }, [bpm, beats, muted]);

  const toggle = async () => {
    if (on) {
      metro.current?.stop();
      setOn(false);
      setBeat(-1);
      return;
    }
    await unlockAudio();
    metro.current?.stop();
    metro.current = new Metronome({ bpm, beatsPerBar: beats, muted, onBeat: (b, s) => s === 0 && setBeat(b) });
    metro.current.start();
    setOn(true);
  };

  return (
    <div className="rounded-2xl bg-surface-2 px-3 py-2.5 flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-pressed={on}
        aria-label={on ? "Parar el metrónomo" : "Poner en marcha el metrónomo"}
        className={`btn-circle w-10 h-10 shrink-0 ${on ? "" : "bg-surface text-ink border border-line"}`}
      >
        {on ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden>
            <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
          </svg>
        ) : (
          <PlayIcon className="w-4 h-4 translate-x-px" />
        )}
      </button>
      <div className="flex items-center gap-1">
        <StepBpm label="Bajar el tempo" onClick={() => setBpm((b) => Math.max(MIN_BPM, b - 5))}>
          −
        </StepBpm>
        <span className="tabular-nums font-semibold w-20 text-center">♩ = {bpm}</span>
        <StepBpm label="Subir el tempo" onClick={() => setBpm((b) => Math.min(MAX_BPM, b + 5))}>
          +
        </StepBpm>
      </div>
      <span className="flex gap-1.5 items-center" aria-hidden>
        {Array.from({ length: beats }).map((_, i) => (
          <span key={i} className={`rounded-full transition-colors duration-75 ${i === 0 ? "w-3 h-3" : "w-2 h-2"} ${on && beat === i ? "bg-ink" : "bg-surface-3"}`} />
        ))}
      </span>
      <Link href="/metronome" className="ml-auto text-xs text-ink-2 hover:text-ink hover:underline">
        Metrónomo completo
      </Link>
    </div>
  );
}

function StepBpm({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="w-8 h-8 rounded-full bg-surface border border-line text-ink hover:bg-surface-3 font-semibold">
      {children}
    </button>
  );
}

function RoundButton({ label, onClick, disabled, muted, children }: { label: string; onClick: () => void; disabled?: boolean; muted?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`btn-circle w-12 h-12 active:scale-95 disabled:opacity-35 ${muted ? "bg-surface-2 text-ink border border-line hover:bg-surface-3" : ""}`}
    >
      {children}
    </button>
  );
}

/** Qué le pasa al plan con cada respuesta, dicho después de contestar. */
const REVIEW_EFFECT: Record<Outcome, string> = {
  conseguido: "Objetivo cumplido: las sesiones que le quedaban quedan libres.",
  casi: "Seguimos con el plan tal como está.",
  cuesta: "Le añadimos una sesión más; las siguientes se corren un día.",
};

const mins = (sec: number) => Math.floor(sec / 60);

/**
 * Under the clock: whether the piano is being listened to, and how much of
 * the session has really counted so far. The microphone is a choice — without
 * it the clock alone decides — so it's a switch here, off until asked for.
 */
function PracticeBar({ practice }: { practice: PracticeTracker }) {
  const { log, counts, mic, setMic, listening, micError, micAvailable } = practice;
  const heard = log.heard >= 60;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        {micAvailable && (
          <button
            type="button"
            onClick={() => setMic(!mic)}
            aria-pressed={mic}
            title={mic ? "Dejar de escuchar" : "Escuchar el piano mientras corre el reloj: nada se graba"}
            className={`pill py-1.5 inline-flex items-center gap-1.5 ${mic ? "pill-active" : ""}`}
          >
            <MicIcon className="w-3.5 h-3.5" />
            {mic ? (listening ? "Escuchando" : "Micrófono activado") : "Escuchar el piano"}
            {listening && <span className="w-1.5 h-1.5 rounded-full bg-bad animate-pulse" aria-hidden />}
          </button>
        )}
        <span className="text-ink-3 tabular-nums">
          {mins(log.clock)} min contados{heard && ` · ${mins(log.playing)} tocando`}
        </span>
        {counts && (
          <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft text-ok px-2 py-0.5 font-medium">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3" aria-hidden>
              <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Suma a la racha
          </span>
        )}
      </div>
      {micError && <p className="text-center text-xs text-bad">{micError}</p>}
    </div>
  );
}

const MicIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className={className} aria-hidden>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" strokeLinecap="round" />
  </svg>
);

/**
 * Said plainly, and without scolding: the day counts, or what it would have
 * taken. A day ticked here still counts for the plan either way.
 */
function streakNote(practice: PracticeLog, counts: boolean): string {
  if (counts) return "Suma a tu racha.";
  const need = Math.ceil(clockNeeded(practice) / 60);
  if (practice.clock < clockNeeded(practice)) {
    return `Para la racha hacen falta ${need} min con el reloj en marcha; llevas ${mins(practice.clock)}.`;
  }
  return "Para la racha, el micrófono tiene que oír el piano en al menos un tercio del tiempo.";
}

function Finished({
  minutes,
  practice,
  counts,
  onRepeat,
  onExit,
  onReview,
  reviewed,
}: {
  minutes: number;
  practice: PracticeLog;
  counts: boolean;
  onRepeat: () => void;
  onExit?: () => void;
  onReview?: (outcome: Outcome) => void;
  reviewed: Outcome | null;
}) {
  return (
    <div className="text-center space-y-4 py-2">
      <span className="mx-auto w-20 h-20 rounded-full bg-ok text-bg grid place-items-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-9 h-9" aria-hidden>
          <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div>
        <p className="text-xl font-bold">Sesión completada</p>
        <p className="text-sm text-ink-2">{minutes} minutos de estudio. Queda marcada como hecha.</p>
      </div>

      {/* Lo que el reloj vio de verdad: saltar pasos marca la sesión, pero no suma racha. */}
      <div className={`rounded-2xl px-4 py-3 text-sm ${counts ? "bg-ok-soft" : "bg-surface-2"}`}>
        <p className="font-medium tabular-nums">
          {mins(practice.clock)} min con el reloj en marcha
          {practice.heard >= 60 && ` · ${mins(practice.playing)} tocando`}
        </p>
        <p className={`mt-0.5 text-xs ${counts ? "text-ok" : "text-ink-2"}`}>{streakNote(practice, counts)}</p>
      </div>

      {/* El cronómetro dice cuánto has estado, no cómo ha ido. Eso solo lo
          sabes tú, y es lo que mueve el plan de aquí en adelante. */}
      {onReview && (
        <div className="rounded-2xl bg-surface-2 px-4 py-3 space-y-2">
          {reviewed ? (
            <p className="text-sm text-ink-2">
              <strong className="text-ink">{OUTCOME_LABELS[reviewed]}.</strong> {REVIEW_EFFECT[reviewed]}
            </p>
          ) : (
            <>
              <p className="text-sm font-medium">¿Cómo ha ido el objetivo?</p>
              <div className="flex flex-wrap justify-center gap-2">
                {OUTCOMES.map((outcome) => (
                  <button key={outcome} type="button" onClick={() => onReview(outcome)} className="pill text-xs py-1.5">
                    {OUTCOME_LABELS[outcome]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {onExit ? (
          <button type="button" onClick={onExit} className="btn-primary text-sm">
            Volver a mis sesiones
          </button>
        ) : (
          <Link href="/calendar" className="btn-primary text-sm">
            Ver mis sesiones
          </Link>
        )}
        <button type="button" onClick={onRepeat} className="pill text-xs py-1.5">
          Repetirla
        </button>
      </div>
    </div>
  );
}

/** Keeps the screen on while the clock runs; the piano is a metre away from the phone. Best effort: not every browser has it. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const acquire = () => {
      if (!alive || document.visibilityState !== "visible") return;
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (alive) lock = l;
          else void l.release();
        })
        .catch(() => {
          /* denied or unsupported: the clock still runs */
        });
    };
    acquire();
    // the lock is released when the tab is hidden; take it again when it comes back
    document.addEventListener("visibilitychange", acquire);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release();
    };
  }, [active]);
}
