"use client";

import type { LevelRecord } from "@/lib/practice/level-progress";

/** Lo mínimo que el mapa necesita saber de un nivel; lo comparten lectura y primera vista. */
export interface MapLevel {
  id: string;
  n: number;
  group: string;
  name: string;
  hint: string;
  color: string;
}

export function Stars({ count, size = "sm" }: { count: number; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "w-7 h-7" : "w-3.5 h-3.5";
  return (
    <span className={`inline-flex ${size === "lg" ? "gap-1.5" : "gap-0.5"}`} aria-label={`${count} de 3 estrellas`}>
      {[1, 2, 3].map((i) => (
        <svg key={i} viewBox="0 0 24 24" className={box} aria-hidden="true">
          <path
            d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z"
            fill={i <= count ? "var(--accent)" : "none"}
            stroke={i <= count ? "var(--accent)" : "var(--ink-3)"}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="3" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 017 0v2.7" strokeLinecap="round" />
    </svg>
  );
}

/**
 * El mapa: los niveles por bloques, con sus estrellas. Solo se puede entrar en
 * los abiertos —el primero y uno más por cada aprobado— para que el orden del
 * mapa sea de verdad el orden en que se aprende.
 */
export function LevelMap({
  levels,
  records,
  unlocked,
  onPick,
}: {
  levels: MapLevel[];
  records: Record<string, LevelRecord>;
  /** Cuántos niveles están abiertos, contando desde el primero. */
  unlocked: number;
  onPick: (id: string) => void;
}) {
  const groups: { group: string; levels: MapLevel[] }[] = [];
  for (const l of levels) {
    const last = groups[groups.length - 1];
    if (last && last.group === l.group) last.levels.push(l);
    else groups.push({ group: l.group, levels: [l] });
  }

  return (
    <div className="space-y-5">
      {groups.map(({ group, levels: list }) => (
        <section key={group} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-3 px-1">{group}</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {list.map((l) => {
              const record = records[l.id];
              const open = l.n <= unlocked;
              const next = l.n === unlocked && !record;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    disabled={!open}
                    onClick={() => onPick(l.id)}
                    aria-label={`Nivel ${l.n}: ${l.name}${open ? "" : " (bloqueado)"}`}
                    className={`w-full text-left rounded-3xl p-3.5 flex items-center gap-3 transition-transform ${
                      open ? `card-pastel ${l.color} hover:-translate-y-0.5` : "bg-surface-2 text-ink-3"
                    } ${next ? "ring-2 ring-ink/60" : ""}`}
                  >
                    <span
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold tabular-nums shrink-0 ${
                        open ? "bg-surface/90 text-ink" : "bg-surface-3"
                      }`}
                    >
                      {open ? l.n : <LockIcon />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-tight truncate">{l.name}</span>
                      <span className={`block text-xs mt-0.5 ${open ? "text-ink-2" : "text-ink-3"}`}>
                        {open ? (record ? `Mejor: ${record.best}%` : next ? "Siguiente" : "Sin jugar") : "Aprueba el anterior"}
                      </span>
                    </span>
                    {open && <Stars count={record?.stars ?? 0} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
