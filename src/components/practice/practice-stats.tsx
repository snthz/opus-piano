"use client";

import { useStudyDays } from "@/lib/practice-log";
import { useProgress, summarize, dayStreak } from "@/lib/progress";

export function PracticeStats() {
  const progress = useProgress();
  const s = summarize(progress);
  const streak = dayStreak(progress, useStudyDays());
  return (
    <div className="card p-4 grid grid-cols-4 text-center">
      <div>
        <p className="text-2xl font-bold tabular-nums">{s.attempts}</p>
        <p className="text-xs text-ink-3">respuestas</p>
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{s.accuracy}%</p>
        <p className="text-xs text-ink-3">precisión</p>
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{s.days}</p>
        <p className="text-xs text-ink-3">días</p>
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{streak}</p>
        <p className="text-xs text-ink-3">racha</p>
      </div>
    </div>
  );
}

export function ExerciseBadge({ id }: { id: string }) {
  const progress = useProgress();
  const p = progress[id];
  if (!p || !p.attempts) return <span className="text-xs text-ink-3">Sin empezar</span>;
  const acc = Math.round((p.correct / p.attempts) * 100);
  return (
    <span className="text-xs text-ink-2">
      {p.attempts} resp. · {acc}% · mejor racha {p.bestStreak}
    </span>
  );
}
