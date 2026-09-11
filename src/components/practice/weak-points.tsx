"use client";

import Link from "next/link";
import { EXERCISES } from "@/data/exercises";
import { itemLabel } from "@/lib/practice/labels";
import { useWeakItems } from "@/lib/practice/item-stats";
import { exercisePath } from "@/lib/routes";
import { useSettings } from "@/lib/settings";

/**
 * Lo que más se resiste, por respuesta y no por ejercicio: la nota, la
 * armadura o el intervalo concretos que se fallan. No hay nada que pulsar —
 * los ejercicios ya preguntan esto más a menudo por su cuenta—, es para saber
 * qué está pasando.
 */
export function WeakPoints({ exerciseId, limit = 6 }: { exerciseId?: string; limit?: number }) {
  const { settings } = useSettings();
  const weak = useWeakItems(24).filter((w) => !exerciseId || w.exerciseId === exerciseId).slice(0, limit);
  if (!weak.length) return null;

  return (
    <section className="card mt-6 space-y-3 p-4">
      <div>
        <h2 className="font-semibold tracking-tight">Lo que más se te resiste</h2>
        <p className="mt-0.5 text-xs text-ink-2">
          Los ejercicios preguntan esto más a menudo, y lo van soltando conforme deja de fallar.
        </p>
      </div>
      <ul className="space-y-1.5">
        {weak.map((w) => {
          const exercise = EXERCISES.find((e) => e.id === w.exerciseId);
          const row = (
            <>
              <span className="truncate">{itemLabel(w.exerciseId, w.itemId, settings.naming)}</span>
              <span className="ml-auto shrink-0 text-xs tabular-nums text-ink-2">
                {Math.round(w.rate * 100)}% de {w.stat.attempts}
              </span>
            </>
          );
          return (
            <li key={`${w.exerciseId}:${w.itemId}`}>
              {exercise ? (
                <Link
                  href={exercisePath(exercise.id)}
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-surface-2"
                >
                  {!exerciseId && <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${exercise.color}`} aria-hidden="true" />}
                  {row}
                </Link>
              ) : (
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
