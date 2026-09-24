"use client";

import { SCORE_STATUSES, STATUS_HINTS, STATUS_LABELS, STATUS_PLURALS, type ScoreStatus } from "@/lib/score-status";

/** Ink at three strengths, plus green for what's finished: the status reads without a legend. */
const STATUS_DOT: Record<ScoreStatus, string> = { pending: "bg-ink-3", studying: "bg-ink", learned: "bg-ok" };

export function StatusDot({ status, className = "h-2 w-2" }: { status: ScoreStatus; className?: string }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-full ${STATUS_DOT[status]} ${className}`} />;
}

/** Dot and name, for the line under a cover. */
export function StatusLabel({ status }: { status: ScoreStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot status={status} />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** The three states as rows to pick from, inside a menu or a sheet. */
export function StatusOptions({ value, onChange }: { value: ScoreStatus; onChange: (s: ScoreStatus) => void }) {
  return (
    <div role="radiogroup" aria-label="Estado de la partitura" className="space-y-0.5">
      {SCORE_STATUSES.map((s) => {
        const active = s === value;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(s)}
            className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${active ? "bg-ink text-bg" : "hover:bg-surface-2"}`}
          >
            <StatusDot status={s} className={`mt-1.5 h-2 w-2 ${active ? "bg-bg" : ""}`} />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{STATUS_LABELS[s]}</span>
              <span className={`block text-[11px] leading-snug ${active ? "text-bg/70" : "text-ink-3"}`}>{STATUS_HINTS[s]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export type StatusFilter = ScoreStatus | "all";

/** Filter pills for the library: everything, then the three states with their counts. */
export function StatusPills({ value, counts, onChange }: { value: StatusFilter; counts: Record<ScoreStatus, number>; onChange: (f: StatusFilter) => void }) {
  const total = SCORE_STATUSES.reduce((n, s) => n + counts[s], 0);
  const options: { key: StatusFilter; label: string; n: number }[] = [
    { key: "all", label: "Todas", n: total },
    ...SCORE_STATUSES.map((s) => ({ key: s as StatusFilter, label: STATUS_PLURALS[s], n: counts[s] })),
  ];
  return (
    // Scrolls sideways on a phone instead of wrapping: four pills on two lines
    // pushed the covers below the fold.
    <div role="tablist" aria-label="Filtrar por estado" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={`pill shrink-0 py-1.5 text-xs ${value === o.key ? "pill-active" : ""}`}
        >
          {o.key !== "all" && <StatusDot status={o.key} className={`h-1.5 w-1.5 ${value === o.key ? "bg-bg" : ""}`} />}
          {o.label}
          <span className={`tabular-nums ${value === o.key ? "text-bg/70" : "text-ink-3"}`}>{o.n}</span>
        </button>
      ))}
    </div>
  );
}
