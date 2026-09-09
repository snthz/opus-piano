"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { SessionCard } from "@/components/calendar/session-card";
import { agendaByDay, dayKey, nextSession, parseDay, type ScheduledScore } from "@/lib/agenda";
import { listScores, onScoresChange, toggleStudyDay } from "@/lib/scores-db";

/**
 * Today's session on the home page: the same card as the sessions page,
 * with "start" taking you there with the session already open.
 *
 * Same source as that page — the plans stored in IndexedDB — and it stores
 * nothing of its own beyond the "studied" tick. With no scheduled score it
 * renders nothing: the home page is no place to explain a feature that is not
 * in use yet, the sessions page already does that.
 */
export function TodayRoutine() {
  const [scores, setScores] = useState<ScheduledScore[] | null>(null);
  const today = useMemo(() => dayKey(new Date()), []);

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

  const byDay = useMemo(() => agendaByDay(scores ?? []), [scores]);
  if (scores === null || byDay.size === 0) return null;

  const entries = byDay.get(today) ?? [];
  const upcoming = entries.length === 0 ? nextSession(byDay, today) : null;
  const done = entries.filter((e) => e.session.done).length;

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-3 px-1">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">{entries.length > 1 ? "Tus sesiones de hoy" : "Tu sesión de hoy"}</h2>
          {entries.length > 0 && (
            <p className="text-sm text-ink-2">
              {done === entries.length
                ? "Hecha. Buen trabajo."
                : entries.length === 1
                  ? "Aún por hacer."
                  : `${done} de ${entries.length} hechas · ${entries.reduce((n, e) => n + e.session.minutes, 0)} min en total`}
            </p>
          )}
        </div>
        <Link href="/calendar" className="pill text-sm py-1.5 shrink-0">
          Sesiones
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
              <SessionCard
                entry={entry}
                startHref={`/calendar?session=${encodeURIComponent(entry.score.id)}`}
                onToggle={() => void toggleStudyDay(entry.score.id, entry.session.day)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const longDay = (key: string) => parseDay(key).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
