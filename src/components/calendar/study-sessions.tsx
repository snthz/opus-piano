"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDays, agendaByDay, dayKey, nextSession, parseDay, startOfWeek, WEEKDAY_LETTERS, weekSummary, type ScheduledScore } from "@/lib/agenda";
import { listScores, onScoresChange, toggleStudyDay } from "@/lib/scores-db";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SessionCard } from "./session-card";
import { SessionRunner } from "./session-runner";

/**
 * Las sesiones de estudio: qué toca tocar cada día, y la sesión en marcha
 * con su cronómetro.
 *
 * No guarda nada propio. Lee la biblioteca de IndexedDB y deriva las sesiones
 * del plan de cada partitura y de su horario (`src/lib/agenda.ts`), así que
 * funciona sin conexión y se pone al día sola cuando cambia un plan o se marca
 * un objetivo. Lo único que escribe es el visto de «estudiada», que va dentro
 * del horario y viaja con el plan a la cuenta.
 */

const monthLabel = (d: Date) => d.toLocaleDateString("es", { month: "long", year: "numeric" });
const longDay = (key: string) => parseDay(key).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });

export function StudySessions() {
  const [scores, setScores] = useState<ScheduledScore[] | null>(null);
  const today = useMemo(() => dayKey(new Date()), []);
  const [selected, setSelected] = useState(today);
  /**
   * The session running right now (score + day); null shows the calendar.
   * «/calendar?session=<id>» from the home page opens that score's session of today.
   */
  const [active, setActive] = useState<{ scoreId: string; day: string } | null>(() => {
    const id = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("session");
    return id ? { scoreId: id, day: today } : null;
  });

  // La biblioteca es la fuente: al cambiar un plan (aquí o en el lector) las
  // sesiones se rehacen solas.
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

  // once read, the parameter leaves the address bar so a reload doesn't reopen the session
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const byDay = useMemo(() => agendaByDay(scores ?? []), [scores]);
  const weekStart = useMemo(() => startOfWeek(parseDay(selected)), [selected]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => dayKey(addDays(weekStart, i))), [weekStart]);

  const dayEntries = byDay.get(selected) ?? [];
  const summary = weekSummary(byDay, weekStart);
  const upcoming = nextSession(byDay, today);

  if (scores === null) return <p className="text-sm text-ink-3">Cargando tus sesiones…</p>;
  if (byDay.size === 0) return <EmptyState />;

  // la sesión activa se busca en cada render: si el plan cambia por debajo, sigue siendo la misma sesión
  const activeEntry = active ? (byDay.get(active.day) ?? []).find((e) => e.score.id === active.scoreId) : undefined;
  if (active && activeEntry) {
    return (
      <SessionRunner
        entry={activeEntry}
        onExit={() => {
          setSelected(active.day);
          setActive(null);
        }}
        onDone={() => void toggleStudyDay(activeEntry.score.id, activeEntry.session.day)}
      />
    );
  }

  const monthFrom = monthLabel(weekStart);
  const monthTo = monthLabel(addDays(weekStart, 6));

  return (
    // En móvil, la semana encima del día. En escritorio, dos columnas: el
    // calendario se queda fijo a la izquierda mientras se leen las sesiones.
    <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[19rem_1fr] lg:gap-8 lg:items-start">
      {/* ---- Semana ---- */}
      <section className="space-y-4 lg:card lg:p-5 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
        <div className="flex items-center gap-2 px-1 lg:px-0">
          {/* `first-letter` y no `capitalize`: en castellano el mes va en minúscula, y `capitalize` pondría «Septiembre De 2026». */}
          <h2 className="flex-1 min-w-0 font-bold first-letter:uppercase truncate">{monthFrom === monthTo ? monthFrom : `${monthFrom} – ${monthTo}`}</h2>
          <WeekButton label="Semana anterior" onClick={() => setSelected(dayKey(addDays(parseDay(selected), -7)))} dir="left" />
          <WeekButton label="Semana siguiente" onClick={() => setSelected(dayKey(addDays(parseDay(selected), 7)))} dir="right" />
        </div>

        <ul className="grid grid-cols-7 gap-0.5">
          {week.map((day) => {
            const entries = byDay.get(day) ?? [];
            const allDone = entries.length > 0 && entries.every((e) => e.session.done);
            const isSelected = day === selected;
            const isToday = day === today;
            return (
              <li key={day} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setSelected(day)}
                  aria-current={isSelected ? "date" : undefined}
                  aria-label={`${longDay(day)}, ${entries.length === 0 ? "sin sesiones" : `${entries.length} ${entries.length === 1 ? "sesión" : "sesiones"}`}`}
                  className={`w-full max-w-12 py-2 rounded-2xl flex flex-col items-center gap-0.5 transition-colors ${
                    isSelected ? "bg-ink text-bg" : "text-ink hover:bg-surface-2"
                  }`}
                >
                  <span className={`text-[11px] font-semibold ${isSelected ? "text-bg/60" : "text-ink-3"}`}>
                    {WEEKDAY_LETTERS[parseDay(day).getDay()]}
                  </span>
                  <span className={`text-sm tabular-nums ${isToday ? "font-bold" : ""}`}>{parseDay(day).getDate()}</span>
                  {/* Un punto si ese día toca estudiar; verde cuando ya está hecho. */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      entries.length === 0 ? "bg-transparent" : allDone ? "bg-ok" : isSelected ? "bg-bg/60" : "bg-ink-3"
                    }`}
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>

        {/* El objetivo de la semana: hacer todas sus sesiones. */}
        <div className="flex items-center gap-3 px-1 lg:px-0">
          {summary.total > 0 ? (
            <>
              <span className="relative w-11 h-11 grid place-items-center text-ok shrink-0">
                <ProgressRing progress={summary.done / summary.total} status={summary.done === summary.total ? "done" : "running"} stroke={3.5} className="w-11 h-11" />
                {summary.done < summary.total && <span className="absolute text-xs font-bold tabular-nums text-ink">{summary.done}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {summary.done === summary.total ? "Semana completada" : `${summary.done} de ${summary.total} ${summary.total === 1 ? "sesión" : "sesiones"}`}
                </p>
                <p className="text-xs text-ink-2">{summary.done === summary.total ? "Todas las sesiones hechas." : "El objetivo de la semana."}</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-ink-2 flex-1">Esta semana no hay sesiones.</p>
          )}
          {selected !== today && (
            <button type="button" onClick={() => setSelected(today)} className="pill text-xs py-1 shrink-0">
              Hoy
            </button>
          )}
        </div>
      </section>

      {/* ---- El día ---- */}
      <section className="space-y-3 min-w-0">
        <h2 className="font-bold px-1 lg:px-0 lg:text-lg">
          {selected === today ? (
            <>
              Hoy <span className="font-normal text-ink-2">· {longDay(selected)}</span>
            </>
          ) : (
            <span className="first-letter:uppercase">{longDay(selected)}</span>
          )}
        </h2>

        {dayEntries.length === 0 ? (
          <div className="card p-5 space-y-3">
            <p className="text-sm text-ink-2">Este día no toca estudiar.</p>
            {upcoming && (
              <button type="button" onClick={() => setSelected(upcoming.session.day)} className="pill text-xs py-1.5">
                Siguiente sesión: {longDay(upcoming.session.day)}
                <ChevronIcon dir="right" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          dayEntries.map((entry) => (
            <SessionCard
              key={`${entry.score.id}-${entry.session.index}`}
              entry={entry}
              onStart={() => setActive({ scoreId: entry.score.id, day: entry.session.day })}
              onToggle={() => void toggleStudyDay(entry.score.id, entry.session.day)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function WeekButton({ label, onClick, dir }: { label: string; onClick: () => void; dir: "left" | "right" }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="btn-circle shrink-0 w-9 h-9 hover:opacity-85 active:translate-y-px">
      <ChevronIcon dir={dir} className="w-4 h-4" />
    </button>
  );
}

function EmptyState() {
  return (
    <section className="card-pastel bg-mint p-6 space-y-4">
      <div>
        <h2 className="font-bold text-lg">Todavía no tienes sesiones</h2>
        <p className="mt-1 text-sm text-ink-2">Salen del plan de estudio de una partitura. Tres pasos:</p>
      </div>
      <ol className="space-y-2 text-sm">
        {["Abre una partitura y crea su plan de estudio.", "En «Rutina de estudio», elige los días y, si quieres, la hora.", "Vuelve aquí: cada día tendrás una sesión con su cronómetro."].map((t, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="w-6 h-6 rounded-full bg-ink text-bg text-xs font-bold grid place-items-center shrink-0 tabular-nums">{i + 1}</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
      <Link href="/scores" className="btn-primary text-sm">
        Ir a mis partituras
      </Link>
    </section>
  );
}
