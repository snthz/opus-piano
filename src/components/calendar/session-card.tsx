"use client";

import Link from "next/link";
import { useState } from "react";
import { addMinutes, sessionSteps, STEP_LABELS, type AgendaEntry, type SessionStep, type StepKind } from "@/lib/agenda";
import { pastelOf } from "@/lib/pastel";
import { readRun, runInProgress } from "@/lib/session-run";
import { goalChips } from "@/lib/study-plan";

/**
 * One study session as a card: the piece, what's worked on, and the steps as
 * a bar you can read at a glance. Its action is "start": the session runs
 * step by step with a timer (see `session-runner.tsx`). The tick marks it
 * done by hand for whoever studied without the timer.
 */
export function SessionCard({
  entry,
  onToggle,
  onStart,
  startHref,
}: {
  entry: AgendaEntry;
  onToggle: () => void;
  /** Runs the session in place… */
  onStart?: () => void;
  /** …or on the sessions page (from the home page). */
  startHref?: string;
}) {
  const { score, plan, session } = entry;
  const steps = sessionSteps(plan, session);
  const chips = goalChips(session.goal);
  // read once on mount; the card is keyed by session and remounts when the runner closes, so it's fresh
  const [inProgress] = useState(() => typeof window !== "undefined" && runInProgress(readRun(score.id, session.day)));

  const label = session.done ? "Repetir la sesión" : inProgress ? "Continuar la sesión" : "Empezar la sesión";
  const startClass = `${session.done ? "btn-secondary" : "btn-primary"} text-sm flex-1 sm:flex-none`;

  return (
    <article className={`card-pastel ${pastelOf(score.id)} p-4 md:p-5 space-y-4 transition-opacity ${session.done ? "opacity-70" : ""}`}>
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-2 truncate">{score.name}</p>
          <h3 className={`text-lg font-bold leading-tight ${session.done ? "line-through" : ""}`}>{session.goal.title}</h3>
          <div className="flex flex-wrap gap-1.5">
            <Chip>
              <ClockIcon />
              {session.time ? `${session.time}–${addMinutes(session.time, session.minutes)}` : "Cuando quieras"}
              <span className="text-ink-2">· {session.minutes} min</span>
            </Chip>
            {chips.map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
            <Chip>
              Sesión {session.ofGoal.n} de {session.ofGoal.total}
            </Chip>
          </div>
        </div>
        <DoneButton done={session.done} onClick={onToggle} />
      </header>

      <StepStrip steps={steps} />

      <div className="flex flex-wrap items-center gap-2">
        {startHref ? (
          <Link href={startHref} className={startClass}>
            <PlayIcon />
            {label}
          </Link>
        ) : (
          <button type="button" onClick={onStart} className={startClass}>
            <PlayIcon />
            {label}
          </button>
        )}
        <Link href={`/scores?score=${encodeURIComponent(score.id)}`} className="pill text-xs py-1.5 bg-surface">
          Abrir la partitura
        </Link>
      </div>
    </article>
  );
}

/**
 * The session's steps as one bar, each segment as wide as its minutes, and
 * a legend under it. `current` lights the step in progress in the runner.
 */
export function StepStrip({ steps, current, onPick }: { steps: SessionStep[]; current?: number; onPick?: (i: number) => void }) {
  const total = steps.reduce((n, s) => n + s.minutes, 0) || 1;
  return (
    <div className="space-y-2">
      <div className="flex gap-1 h-2.5" role="list" aria-label="Pasos de la sesión">
        {steps.map((s, i) => {
          const state = current === undefined ? "plain" : i < current ? "done" : i === current ? "current" : "todo";
          return (
            <span
              key={i}
              role="listitem"
              aria-label={`${s.title}, ${s.minutes} minutos`}
              style={{ flexGrow: s.minutes / total, flexBasis: 0 }}
              className={`rounded-full min-w-2 transition-colors ${
                state === "current" ? "bg-ink" : state === "done" ? "bg-ok" : state === "todo" ? "bg-ink/15" : SEGMENT[s.kind]
              }`}
            />
          );
        })}
      </div>
      <ol className="flex flex-wrap gap-x-4 gap-y-1">
        {steps.map((s, i) => {
          const active = current === i;
          const inner = (
            <>
              <StepIcon kind={s.kind} className={`w-4 h-4 shrink-0 ${active ? "text-ink" : "text-ink-2"}`} />
              <span className={`tabular-nums ${active ? "font-semibold" : "text-ink-2"}`}>{s.minutes}′</span>
              <span className={active ? "font-semibold" : "text-ink-2"}>{STEP_LABELS[s.kind]}</span>
            </>
          );
          return (
            <li key={i} className="text-xs">
              {onPick ? (
                <button type="button" onClick={() => onPick(i)} aria-current={active ? "step" : undefined} className="inline-flex items-center gap-1.5 rounded-full py-0.5 hover:text-ink">
                  {inner}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5">{inner}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Ink at three strengths, not three colours: a pastel card already has its colour. */
const SEGMENT: Record<StepKind, string> = { calentamiento: "bg-ink/35", objetivo: "bg-ink", repaso: "bg-ink/55" };

export function StepIcon({ kind, className = "w-4 h-4" }: { kind: StepKind; className?: string }) {
  if (kind === "calentamiento") {
    // ascending dots on staff lines: a scale
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
        <path d="M3 8h18M3 12h18M3 16h18" strokeLinecap="round" opacity="0.45" />
        <circle cx="6.5" cy="16" r="1.9" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />
        <circle cx="17.5" cy="8" r="1.9" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === "objetivo") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-2.5 py-1 text-xs font-medium tabular-nums">{children}</span>;
}

/** Button, not a checkbox: it is the card's secondary action and it gets pressed with a thumb. */
export function DoneButton({ done, onClick }: { done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={done}
      aria-label={done ? "Marcar como no estudiada" : "Marcar la sesión como estudiada"}
      title={done ? "Estudiada" : "Marcar como estudiada"}
      className={`shrink-0 w-10 h-10 grid place-items-center rounded-full border transition-colors ${
        done ? "bg-ok text-bg border-transparent" : "bg-surface text-ink-3 border-line hover:text-ink"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4" aria-hidden>
        <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function PlayIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
