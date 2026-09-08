"use client";

import Link from "next/link";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { ProgressRing } from "@/components/ui/progress-ring";
import { EXERCISES } from "@/data/exercises";
import { DAILY_GOAL, dayStreak, summarize, summarizeToday, useProgress } from "@/lib/progress";
import { exercisePath } from "@/lib/routes";
import { suggestExercises } from "@/lib/suggestions";

export interface NextLesson {
  title: string;
  href: string;
  minutes: number;
}

/**
 * The home page summary: how the day is going and what comes next, in one card.
 * It is the only part of the page that changes with who is looking, so it is the
 * only part that runs on the client; the rest is served static.
 *
 * With no progress yet it shows the first lesson instead of a row of zeros,
 * which encourages nobody. With progress: the day's ring, the streak and the
 * practice that is due, picked from whatever is going worst.
 */
export function ProgressSummary({ nextLesson }: { nextLesson: NextLesson }) {
  const progress = useProgress();
  const today = summarizeToday(progress);
  const totals = summarize(progress);
  const streak = dayStreak(progress);
  const started = totals.attempts > 0;
  const suggestion = suggestExercises(progress, EXERCISES, 1)[0];

  const next = started &&
    suggestion && {
      href: exercisePath(suggestion.exercise.id),
      glyph: suggestion.exercise.glyph,
      color: suggestion.exercise.color,
      label: "Continúa por aquí",
      title: suggestion.exercise.title,
      note: suggestion.label,
    };

  return (
    <section className="card p-4 md:p-5">
      {started ? (
        <div className="flex items-center gap-4">
          <span className="relative w-16 h-16 grid place-items-center text-ink shrink-0">
            <ProgressRing progress={Math.min(1, today.attempts / DAILY_GOAL)} stroke={3.5} className="w-16 h-16" />
            <span className="absolute text-lg font-bold tabular-nums">{today.attempts}</span>
          </span>
          <div className="min-w-0">
            <p className="font-semibold">
              {today.attempts === 0
                ? "Hoy aún no has practicado"
                : `Hoy: ${today.attempts} de ${DAILY_GOAL} respuestas`}
            </p>
            <p className="text-sm text-ink-2">
              {streak > 0 && `Racha de ${streak} ${streak === 1 ? "día" : "días"} · `}
              {totals.accuracy}% de acierto
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <span className="w-16 h-16 rounded-full bg-blue grid place-items-center shrink-0">
            <GlyphIcon name="gClef" size={30} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">Empieza cuando quieras</p>
            <p className="text-sm text-ink-2">Diez minutos al día bastan para leer tus primeras notas.</p>
          </div>
        </div>
      )}

      <Link
        href={next ? next.href : nextLesson.href}
        className="mt-4 flex items-center gap-3 rounded-2xl bg-surface-2 p-3 group"
      >
        <span
          className={`w-11 h-11 rounded-full grid place-items-center shrink-0 ${next ? next.color : "bg-mint"}`}
        >
          <GlyphIcon name={next ? next.glyph : "staff5Lines"} size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            {next ? next.label : "Primera lección"}
          </span>
          <span className="block font-medium truncate">{next ? next.title : nextLesson.title}</span>
        </span>
        <span className="hidden sm:block text-xs text-ink-3 shrink-0">
          {next ? next.note : `${nextLesson.minutes} min`}
        </span>
        <span className="btn-circle w-10 h-10 shrink-0 group-hover:-translate-y-0.5">
          <ArrowIcon />
        </span>
      </Link>
    </section>
  );
}
