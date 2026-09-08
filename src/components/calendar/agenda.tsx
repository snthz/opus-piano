"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  agendaByDay,
  dayKey,
  nextSession,
  parseDay,
  sessionBlocks,
  startOfWeek,
  WEEKDAY_LETTERS,
  type AgendaEntry,
  type ScheduledScore,
} from "@/lib/agenda";
import { listScores, onScoresChange, toggleStudyDay } from "@/lib/scores-db";
import { pastelOf } from "@/lib/pastel";
import { goalRange } from "@/lib/study-plan";
import { ChevronIcon } from "@/components/ui/arrow-icon";

/**
 * La agenda de estudio: qué toca tocar cada día y a qué hora.
 *
 * No guarda nada propio. Lee la biblioteca de IndexedDB y deriva las sesiones
 * del plan de cada partitura y de su horario (`src/lib/agenda.ts`), así que
 * funciona sin conexión y se pone al día sola cuando cambia un plan o se marca
 * un objetivo. Lo único que escribe es el visto de «estudiado», que va dentro
 * del horario y viaja con el plan a la cuenta.
 */

const monthLabel = (d: Date) => d.toLocaleDateString("es", { month: "long", year: "numeric" });
const longDay = (key: string) => parseDay(key).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });

export function Agenda() {
  const [scores, setScores] = useState<ScheduledScore[] | null>(null);
  const today = useMemo(() => dayKey(new Date()), []);
  const [selected, setSelected] = useState(today);

  // La biblioteca es la fuente: al cambiar un plan (aquí o en el lector) la
  // agenda se rehace sola.
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
  const weekStart = useMemo(() => startOfWeek(parseDay(selected)), [selected]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => dayKey(addDays(weekStart, i))), [weekStart]);

  const dayEntries = byDay.get(selected) ?? [];
  const weekEntries = week.flatMap((d) => byDay.get(d) ?? []);
  const weekDone = weekEntries.filter((e) => e.session.done).length;
  const upcoming = nextSession(byDay, today);

  if (scores === null) return <p className="text-sm text-ink-3">Cargando tu agenda…</p>;
  if (byDay.size === 0) return <EmptyAgenda />;

  const monthFrom = monthLabel(weekStart);
  const monthTo = monthLabel(addDays(weekStart, 6));

  return (
    // En móvil, la semana encima del día. En escritorio, dos columnas: el
    // calendario se queda fijo a la izquierda mientras se leen las sesiones, que
    // ocupan el resto del ancho en vez de dejar media pantalla en blanco.
    <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[19rem_1fr] lg:gap-8 lg:items-start">
      {/* ---- Semana ---- */}
      <section className="space-y-3 lg:card lg:p-5 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
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
                  {/* Un punto si ese día toca estudiar: dice dónde mirar sin cargar la tira de números. */}
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      entries.length === 0 ? "bg-transparent" : isSelected ? "bg-bg/60" : allDone ? "bg-ok" : "bg-ink-3"
                    }`}
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2 px-1 lg:px-0">
          {weekEntries.length > 0 && (
            <p className="text-xs text-ink-2 flex-1">
              {weekDone} de {weekEntries.length} {weekEntries.length === 1 ? "sesión" : "sesiones"} esta semana
            </p>
          )}
          {selected !== today && (
            <button type="button" onClick={() => setSelected(today)} className="pill text-xs py-1 ml-auto shrink-0">
              Volver a hoy
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
          <div className="px-1 lg:px-0 space-y-2">
            <p className="text-sm text-ink-2">Este día no toca estudiar.</p>
            {upcoming && (
              <button type="button" onClick={() => setSelected(upcoming.session.day)} className="pill text-xs py-1">
                Siguiente sesión: {longDay(upcoming.session.day)}
              </button>
            )}
          </div>
        ) : (
          dayEntries.map((entry) => (
            <SessionCard
              key={`${entry.score.id}-${entry.session.index}`}
              entry={entry}
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
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="btn-circle shrink-0 w-9 h-9 hover:opacity-85 active:translate-y-px"
    >
      <ChevronIcon dir={dir} className="w-4 h-4" />
    </button>
  );
}

/**
 * Una sesión del día. Lo que se lee de pie delante del piano es corto —qué
 * pieza, a qué hora, qué objetivo y cómo repartir el rato—, así que la tarjeta
 * es plana: sin cajas dentro de cajas. Lo que se consulta de vez en cuando (cómo
 * trabajar el objetivo, cuándo se da por cumplido) se despliega aparte.
 */
function SessionCard({ entry, onToggle }: { entry: AgendaEntry; onToggle: () => void }) {
  const { score, plan, session } = entry;
  const [details, setDetails] = useState(false);
  const blocks = sessionBlocks(plan, session);
  const range = goalRange(session.goal);
  const hasDetails = !!session.goal.description || !!session.goal.targetTempo;

  return (
    <article className={`card-pastel ${pastelOf(score.id)} p-5 space-y-4 ${session.done ? "opacity-55" : ""}`}>
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs text-ink-2 truncate">
            <span className="tabular-nums">
              {session.time} · {session.minutes} min
            </span>{" "}
            · {score.name}
          </p>
          <h3 className={`font-bold leading-tight ${session.done ? "line-through" : ""}`}>{session.goal.title}</h3>
          <p className="text-xs text-ink-2">
            {range}
            {range ? " · " : ""}
            Sesión {session.ofGoal.n} de {session.ofGoal.total}
          </p>
        </div>
        {/* Botón y no casilla: es la acción de la tarjeta y se pulsa con el pulgar. */}
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={session.done}
          aria-label={session.done ? "Marcar como no estudiada" : "Marcar la sesión como estudiada"}
          title={session.done ? "Estudiada" : "Marcar como estudiada"}
          className={`shrink-0 w-9 h-9 grid place-items-center rounded-full border transition-colors ${
            session.done ? "bg-ok text-bg border-transparent" : "bg-surface text-ink-3 border-line hover:text-ink"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4" aria-hidden>
            <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </header>

      {blocks.length > 0 && (
        <ul className="space-y-2 text-sm">
          {blocks.map((b, i) => (
            <li key={i} className="flex gap-3">
              <span className="tabular-nums text-ink-2 w-11 shrink-0">{b.from}</span>
              <span className="flex-1">{b.activity}</span>
            </li>
          ))}
        </ul>
      )}

      {details && (
        <div className="space-y-2 text-sm border-t border-ink/10 pt-3">
          {session.goal.description && <p className="text-ink-2">{session.goal.description}</p>}
          {session.goal.targetTempo && (
            <p className="text-xs">
              <span className="font-medium">Se da por cumplido: </span>
              <span className="text-ink-2">{session.goal.targetTempo}</span>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/scores?score=${encodeURIComponent(score.id)}`} className="pill text-xs py-1 bg-surface">
          Abrir la partitura
        </Link>
        {hasDetails && (
          <button type="button" onClick={() => setDetails((v) => !v)} aria-expanded={details} className="pill text-xs py-1 bg-surface">
            {details ? "Ocultar" : "Cómo trabajarlo"}
            <ChevronIcon dir={details ? "up" : "down"} className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}

function EmptyAgenda() {
  return (
    <section className="card-pastel bg-mint p-6 space-y-3">
      <h2 className="font-bold">Todavía no hay nada en tu agenda</h2>
      <p className="text-sm text-ink-2">
        Se llena desde el plan de estudio de una partitura: abre la pieza, crea su plan y, en «Rutina de estudio», elige los días y la hora a la
        que quieres estudiar. Aquí verás cada día qué objetivo toca y cómo repartir la sesión.
      </p>
      <Link href="/scores" className="btn-primary text-sm">
        Ir a mis partituras
      </Link>
    </section>
  );
}
