"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLessonsRead } from "@/lib/lessons-read";
import { ownedPieces } from "@/lib/catalog-library";
import { resolvePath, type ResolvedStep } from "@/lib/path";
import { useProgress } from "@/lib/progress";
import { listScores, onScoresChange } from "@/lib/scores-db";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { GlyphIcon } from "@/components/notation/glyph-icon";

/**
 * La ruta, dibujada. Nada de esto se guarda: el estado sale del progreso de
 * los ejercicios, de las lecciones abiertas y de la biblioteca, así que
 * quien ya llevaba medio curso hecho entra por donde le toca.
 *
 * No se bloquea ningún paso. La ruta dice por dónde conviene ir, no manda:
 * un adulto que quiere ver hoy las armaduras las ve hoy.
 */

const KIND_GLYPH: Record<string, string> = {
  lesson: "gClef",
  exercise: "noteQuarterUp",
  piece: "fClef",
};

export function LearningPath() {
  const progress = useProgress();
  const lessonsRead = useLessonsRead();
  const [pieces, setPieces] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const reload = () => listScores().then((scores) => setPieces(ownedPieces(scores)));
    void reload();
    return onScoresChange(() => void reload());
  }, []);

  const path = resolvePath({ progress, lessonsRead, ownedPieces: pieces });
  const percent = path.total ? Math.round((path.done / path.total) * 100) : 0;

  return (
    <div className="space-y-8">
      <section className="card-pastel bg-yellow p-5">
        {path.next ? (
          <>
            <p className="text-xs text-ink-2">
              Paso {path.done + 1} de {path.total} · {percent}% del curso
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-tight tracking-tight">{path.next.title}</h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">{path.next.step.why}</p>
            <Link href={path.next.href} className="pill pill-active mt-4">
              Continuar
              <ArrowIcon className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <>
            <p className="text-xs text-ink-2">{path.total} de {path.total} · curso completo</p>
            <h2 className="mt-1 text-xl font-semibold leading-tight tracking-tight">Has terminado la ruta</h2>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">
              Lo que viene ahora es repertorio: sube una partitura tuya y pídele un análisis, o vuelve a los ejercicios
              que lleves flojos.
            </p>
            <Link href="/scores" className="pill pill-active mt-4">
              Ir a mis partituras
              <ArrowIcon className="h-4 w-4" />
            </Link>
          </>
        )}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface/70">
          <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${percent}%` }} />
        </div>
      </section>

      {path.stages.map((stage) => (
        <section key={stage.id}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{stage.title}</h2>
            <span className="shrink-0 text-xs text-ink-3">
              {stage.done}/{stage.total}
            </span>
          </div>
          <p className="mb-3 max-w-prose text-sm text-ink-2">{stage.goal}</p>
          <ol className="space-y-2">
            {stage.steps.map((step) => (
              <li key={`${step.step.kind}:${step.step.ref}`}>
                <StepRow step={step} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function StepRow({ step }: { step: ResolvedStep }) {
  const current = step.state === "current";
  const done = step.state === "done";
  return (
    <Link
      href={step.href}
      className={`card group flex items-start gap-3 p-4 transition-colors hover:bg-surface-2 ${current ? "ring-2 ring-ink" : ""}`}
    >
      <span
        aria-hidden
        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          done ? "bg-ink text-bg" : current ? "bg-ink text-bg" : "border border-line bg-surface-2 text-ink-3"
        }`}
      >
        {done ? <CheckIcon /> : <GlyphIcon name={KIND_GLYPH[step.step.kind] ?? "gClef"} size={18} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-medium leading-tight ${done ? "text-ink-2 line-through decoration-ink-3/50" : ""}`}>
          {step.title}
        </span>
        <span className="mt-0.5 block text-xs text-ink-3">{step.detail}</span>
        {!done && <span className="mt-1.5 block max-w-prose text-sm leading-relaxed text-ink-2">{step.step.why}</span>}
      </span>
      <ArrowIcon className="mt-1 h-5 w-5 shrink-0 text-ink-3 transition-colors group-hover:text-ink" />
    </Link>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
