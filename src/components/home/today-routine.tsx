"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import {
  addMinutes,
  agendaByDay,
  dayKey,
  nextSession,
  parseDay,
  sessionBlocks,
  type AgendaEntry,
  type ScheduledScore,
} from "@/lib/agenda";
import { pastelOf } from "@/lib/pastel";
import { listScores, onScoresChange, toggleStudyDay } from "@/lib/scores-db";
import { goalRange } from "@/lib/study-plan";

/**
 * Today's routine on the home page: what to play and how to spend the time.
 *
 * Same source as the agenda — the plans stored in IndexedDB — and it stores
 * nothing of its own beyond the "studied" tick. With no scheduled score it
 * renders nothing: the home page is no place to explain a feature that is not
 * in use yet, the agenda already does that.
 */
export function TodayRoutine() {
  const [scores, setScores] = useState<ScheduledScore[] | null>(null);
  const today = useMemo(() => dayKey(new Date()), []);
  // Clock ticking once a minute, to mark the block being played right now.
  const [now, setNow] = useState(clock);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const all = await listScores();
      if (alive) setScores(all.map((s) => ({ id: s.id, name: s.name, plan: s.plan })));
    };
    void load();
    const off = onScoresChange(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(clock()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const byDay = useMemo(() => agendaByDay(scores ?? []), [scores]);
  if (scores === null || byDay.size === 0) return null;

  const entries = byDay.get(today) ?? [];
  const upcoming = entries.length === 0 ? nextSession(byDay, today) : null;
  const done = entries.filter((e) => e.session.done).length;

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3 px-1">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">Tu rutina de hoy</h2>
          {entries.length > 0 && (
            <p className="text-sm text-ink-2">
              {done === entries.length
                ? "Sesión terminada. Buen trabajo."
                : `${done} de ${entries.length} ${entries.length === 1 ? "sesión hecha" : "sesiones hechas"}`}
            </p>
          )}
        </div>
        <Link href="/calendar" className="pill text-sm py-1.5 shrink-0">
          Agenda
          <ChevronIcon dir="right" className="w-3.5 h-3.5" />
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="card p-4 text-sm text-ink-2">
          Hoy no toca estudiar.{" "}
          {upcoming ? (
            <>
              La siguiente sesión es el{" "}
              <Link href="/calendar" className="font-medium text-ink hover:underline">
                {longDay(upcoming.session.day)}
              </Link>
              .
            </>
          ) : (
            "Has terminado todas las sesiones de tus planes."
          )}
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={`${entry.score.id}-${entry.session.index}`}>
              <SessionCard entry={entry} now={now} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * One session, in two halves: on the left what is being worked on, on the right
 * the clock. On a phone they stack; on a wide screen the timeline fills the
 * space that a single column would leave blank.
 */
function SessionCard({ entry, now }: { entry: AgendaEntry; now: string }) {
  const { score, plan, session } = entry;
  const blocks = sessionBlocks(plan, session);
  const range = goalRange(session.goal);
  const endsAt = addMinutes(session.time, session.minutes);

  return (
    <article
      className={`card-pastel ${pastelOf(score.id)} p-4 md:p-5 transition-opacity ${session.done ? "opacity-60" : ""}`}
    >
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_1.15fr] md:gap-6">
        <div className="min-w-0">
          <header className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-2.5 py-1 text-xs font-medium tabular-nums">
                <ClockIcon />
                {session.time}–{endsAt}
                <span className="text-ink-2">· {session.minutes} min</span>
              </p>
              <h3 className={`mt-2 text-lg font-bold leading-tight ${session.done ? "line-through" : ""}`}>
                {session.goal.title}
              </h3>
              <p className="mt-1 text-xs text-ink-2">
                {score.name}
                {range ? ` · ${range}` : ""} · Sesión {session.ofGoal.n} de {session.ofGoal.total}
              </p>
            </div>

            {/* Button, not a checkbox: it is the card's action and it gets
                pressed with a thumb. */}
            <button
              type="button"
              onClick={() => void toggleStudyDay(score.id, session.day)}
              aria-pressed={session.done}
              aria-label={session.done ? "Marcar como no estudiada" : "Marcar la sesión como estudiada"}
              title={session.done ? "Estudiada" : "Marcar como estudiada"}
              className={`shrink-0 w-10 h-10 grid place-items-center rounded-full border transition-colors ${
                session.done ? "bg-ok text-bg border-transparent" : "bg-surface text-ink-3 border-line hover:text-ink"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4" aria-hidden>
                <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </header>

          <div className="mt-3 hidden md:flex flex-wrap gap-2">
            <ScoreLink id={score.id} />
          </div>
        </div>

        {blocks.length > 0 && (
          // The timeline: a hairline joins the blocks so the session reads as
          // one stretch of time and not as four loose errands.
          <ol className="mt-4 md:mt-0 relative border-l border-ink/15 pl-4 space-y-3">
            {blocks.map((b, i) => {
              const current = !session.done && now >= b.from && now < b.to;
              return (
                <li key={i} className="relative">
                  {/* Opaque dot: a translucent one let the line show through
                      and read as a smudge. -22px = half the dot past the 1px
                      rule, so it sits centred on it. */}
                  <span
                    aria-hidden
                    className={`absolute -left-[22px] top-1 w-3 h-3 rounded-full border-2 ${
                      current ? "bg-ink border-ink" : "bg-surface border-ink/25"
                    }`}
                  />
                  <div className="flex items-baseline gap-3 text-sm">
                    <span className={`tabular-nums w-11 shrink-0 ${current ? "font-semibold" : "text-ink-2"}`}>
                      {b.from}
                    </span>
                    <span className={`flex-1 min-w-0 ${current ? "font-medium" : ""}`}>{b.activity}</span>
                    <span className="shrink-0 text-xs text-ink-2 tabular-nums">{b.minutes}′</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="mt-4 md:hidden">
        <ScoreLink id={score.id} />
      </div>
    </article>
  );
}

function ScoreLink({ id }: { id: string }) {
  return (
    <Link href={`/scores?score=${encodeURIComponent(id)}`} className="pill text-xs py-1 bg-surface">
      Abrir la partitura
    </Link>
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

/** Local wall clock as "HH:MM", comparable with the block times as plain strings. */
function clock(d = new Date()): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const longDay = (key: string) => parseDay(key).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
