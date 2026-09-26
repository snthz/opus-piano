"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SessionRunner } from "@/components/calendar/session-runner";
import { StepIcon } from "@/components/calendar/session-card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { dayKey, parseDay, scoreSession, STEP_LABELS } from "@/lib/agenda";
import { usePomodoro } from "@/lib/pomodoro";
import { clock, useSessionClock } from "@/lib/session-run";
import { getScore, recordSessionReview, toggleStudyDay, type ScoreRecord } from "@/lib/scores-db";
import type { Outcome, PlanState } from "@/lib/study-plan";
import { PomodoroFloatingButton } from "./pomodoro-panel";

const longDay = (key: string) => parseDay(key).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });

/**
 * The score's study session, beside the score (desktop) or in a sheet
 * (mobile): today's session with its timer, or the one still to do. The
 * pomodoro is its own thing, next to this one, since it gets used with or
 * without a scheduled session. Nothing of its own is stored — it derives
 * the session from the plan saved with the score, like the sessions page —
 * and the only write is the "studied" tick when the timer runs out, which
 * goes back to the reader through `onPlanChange` so the plan on screen
 * matches the one saved.
 */
export function SessionPanel({
  record,
  onPlanChange,
  onOpenAnalysis,
}: {
  record: Pick<ScoreRecord, "id" | "name" | "plan">;
  onPlanChange: (plan: PlanState | undefined) => void;
  /** Switches to the analysis, where the piece gets analysed or scheduled. */
  onOpenAnalysis: () => void;
}) {
  return (
    <Session record={record} onPlanChange={onPlanChange} onOpenAnalysis={onOpenAnalysis} />
  );
}

function Session({
  record,
  onPlanChange,
  onOpenAnalysis,
}: {
  record: Pick<ScoreRecord, "id" | "name" | "plan">;
  onPlanChange: (plan: PlanState | undefined) => void;
  onOpenAnalysis: () => void;
}) {
  const today = useMemo(() => dayKey(new Date()), []);
  const current = useMemo(() => scoreSession(record, today), [record, today]);

  const markDone = async (day: string) => {
    await toggleStudyDay(record.id, day);
    // re-read rather than patching in memory: the schedule may have moved on underneath
    onPlanChange((await getScore(record.id))?.plan);
  };

  const review = async (day: string, goalId: string, outcome: Outcome) => {
    await recordSessionReview(record.id, day, { goalId, outcome, at: Date.now() });
    onPlanChange((await getScore(record.id))?.plan);
  };

  if (!record.plan) {
    return (
      <Empty title="Sin sesiones todavía" text="Analiza la partitura y dinos qué días estudias: cada día tendrás aquí su sesión con cronómetro.">
        <button type="button" onClick={onOpenAnalysis} className="btn-primary text-sm">
          Analizar la partitura
        </button>
      </Empty>
    );
  }

  if (!current) {
    return (
      <Empty title="Esta pieza no está en tus sesiones" text="Elige los días (y la hora, si quieres) desde el análisis y cada día tendrás su sesión aquí.">
        <button type="button" onClick={onOpenAnalysis} className="btn-primary text-sm">
          Añadir a mis sesiones
        </button>
      </Empty>
    );
  }

  if (current.kind === "done") {
    return (
      <Empty title="Todas las sesiones hechas" text="Has terminado el plan de esta pieza. Puedes repetir una sesión desde tus sesiones o analizarla de nuevo.">
        <Link href="/calendar" className="pill text-xs py-1.5">
          Ver mis sesiones
        </Link>
      </Empty>
    );
  }

  const { entry, when } = current;
  const day = entry.session.day;
  const label = when === "today" ? `Hoy · ${longDay(day)}` : when === "overdue" ? `Pendiente del ${longDay(day)}` : `Próxima · ${longDay(day)}`;

  return (
    <div className="space-y-3">
      <p className={`px-1 text-xs font-medium ${when === "overdue" ? "text-bad" : "text-ink-2"}`}>{label}</p>
      {/* keyed by day: a new session gets a fresh clock */}
      <SessionRunner
        key={`${record.id}-${day}`}
        entry={entry}
        compact
        onDone={() => void markDone(day)}
        onReview={(outcome) => void review(day, entry.session.goal.id, outcome)}
      />
    </div>
  );
}

function Empty({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="card-pastel bg-mint p-5 space-y-3">
      <div>
        <h3 className="font-bold">{title}</h3>
        <p className="mt-1 text-sm text-ink-2">{text}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * The clock floating over the score: the session's while it's under way, the
 * pomodoro's otherwise. Never both — they don't run at once (starting one
 * pauses the other), and two rings over the page would say the same thing
 * twice. With both paused, the session wins: it's the one tied to this piece.
 */
export function FloatingStudyClock({
  scoreId,
  onOpenSession,
  onOpenPomodoro,
}: {
  scoreId: string;
  onOpenSession: () => void;
  onOpenPomodoro: () => void;
}) {
  const shown = useSessionClock();
  const pomo = usePomodoro();
  const session = shown && shown.scoreId === scoreId && shown.active && shown.step ? shown : null;
  if (session && (session.running || !pomo.running)) {
    const { step } = session;
    return (
      <button
        type="button"
        onClick={onOpenSession}
        title={`Sesión · ${step ? STEP_LABELS[step.kind] : ""} · ${session.running ? "en marcha" : "en pausa"}`}
        aria-label={`Sesión de estudio: ${step ? STEP_LABELS[step.kind] : ""}, quedan ${clock(session.remaining)}`}
        className={`relative grid place-items-center w-14 h-14 rounded-full shadow-lg shrink-0 bg-blue text-ink transition-opacity ${
          !session.running ? "opacity-70" : ""
        }`}
      >
        <ProgressRing progress={session.fraction} stroke={2.5} className="absolute inset-0 w-14 h-14" />
        <span className="relative flex flex-col items-center gap-0.5">
          {step && <StepIcon kind={step.kind} className="w-3 h-3 text-ink-2" />}
          <span className="text-[13px] font-bold tabular-nums leading-none">{clock(session.remaining)}</span>
        </span>
      </button>
    );
  }
  return <PomodoroFloatingButton onOpen={onOpenPomodoro} />;
}
