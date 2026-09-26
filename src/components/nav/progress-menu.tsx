"use client";

import Link from "next/link";
import { useState } from "react";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { ProgressRing } from "@/components/ui/progress-ring";
import { EXERCISES } from "@/data/exercises";
import { useStudyDays } from "@/lib/practice-log";
import { DAILY_GOAL, dayStreak, summarize, summarizeToday, useProgress } from "@/lib/progress";
import { exercisePath } from "@/lib/routes";
import { suggestExercises } from "@/lib/suggestions";
import { Chevron, tabClass } from "./nav-tab";

/**
 * Desplegable «Progreso» de la fila de navegación: la actividad de hoy, el
 * resumen global (respuestas, precisión, días, racha) y tres prácticas
 * sugeridas según lo que va flojo, lo que no se ha empezado o lo que lleva
 * días sin tocarse. Funciona sin cuenta porque el progreso vive en local.
 */
export function ProgressMenu() {
  const [open, setOpen] = useState(false);
  const progress = useProgress();
  const totals = summarize(progress);
  const streak = dayStreak(progress, useStudyDays());
  const { attempts: todayAttempts, accuracy: todayAccuracy } = summarizeToday(progress);
  const suggestions = suggestExercises(progress, EXERCISES);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${tabClass(false)} gap-2`}
      >
        <span className="relative w-5 h-5 grid place-items-center text-ink">
          <ProgressRing progress={Math.min(1, todayAttempts / DAILY_GOAL)} stroke={4} className="w-5 h-5" />
        </span>
        Progreso
        <Chevron open={open} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full pt-1 w-[360px]">
          <div className="card p-4 space-y-4 shadow-lg">
            <section className="flex items-center gap-3">
              <span className="relative w-12 h-12 grid place-items-center text-ink shrink-0">
                <ProgressRing progress={Math.min(1, todayAttempts / DAILY_GOAL)} stroke={3.5} className="w-12 h-12" />
                <span className="absolute text-xs font-bold tabular-nums">{todayAttempts}</span>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Hoy: {todayAttempts} de {DAILY_GOAL} respuestas
                </p>
                <p className="text-xs text-ink-2">
                  {todayAccuracy === null
                    ? "Aún no has practicado hoy."
                    : `${todayAccuracy}% de acierto · racha de ${streak} ${streak === 1 ? "día" : "días"}`}
                </p>
              </div>
            </section>

            <dl className="grid grid-cols-4 text-center rounded-xl bg-surface-2 py-2.5">
              <Stat value={totals.attempts} label="respuestas" />
              <Stat value={`${totals.accuracy}%`} label="precisión" />
              <Stat value={totals.days} label="días" />
              <Stat value={streak} label="racha" />
            </dl>

            <section>
              <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Prácticas sugeridas</h3>
              <ul className="mt-1.5 space-y-0.5">
                {suggestions.map((s) => (
                  <li key={s.exercise.id}>
                    <Link
                      href={exercisePath(s.exercise.id)}
                      role="menuitem"
                      className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-surface-2 transition-colors"
                    >
                      <span className={`w-8 h-8 grid place-items-center rounded-lg ${s.exercise.color} text-ink shrink-0`}>
                        <GlyphIcon name={s.exercise.glyph} size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{s.exercise.title}</span>
                        <span className={`block text-xs ${s.reason === "reforzar" ? "text-bad" : "text-ink-3"}`}>{s.label}</span>
                      </span>
                      <span aria-hidden className="text-ink-3">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <Link href="/practice" role="menuitem" className="block text-center text-sm font-medium text-ink-2 hover:text-ink">
              Ver todos los ejercicios →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <dd className="text-lg font-bold tabular-nums leading-tight">{value}</dd>
      <dt className="text-[11px] text-ink-3">{label}</dt>
    </div>
  );
}
