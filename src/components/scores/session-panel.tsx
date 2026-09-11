"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SessionRunner } from "@/components/calendar/session-runner";
import { dayKey, parseDay, scoreSession } from "@/lib/agenda";
import { getScore, recordSessionReview, toggleStudyDay, type ScoreRecord } from "@/lib/scores-db";
import type { Outcome, PlanState } from "@/lib/study-plan";

const longDay = (key: string) => parseDay(key).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });

/**
 * The score's study session, beside the score (desktop) or in a sheet
 * (mobile): today's session with its timer, or the one still to do. Nothing
 * of its own is stored — it derives the session from the plan saved with the
 * score, like the sessions page — and the only write is the "studied" tick
 * when the timer runs out, which goes back to the reader through
 * `onPlanChange` so the plan on screen matches the one saved.
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
