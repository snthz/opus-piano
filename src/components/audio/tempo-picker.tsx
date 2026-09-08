"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { Sheet } from "@/components/ui/sheet";

export interface TempoMark {
  id: string;
  label: string;
  /** Extremos del aire, en pulsos por minuto. */
  min: number;
  max: number;
  /** Tempo al que se pone al elegirlo: el centro habitual del aire. */
  bpm: number;
  hint: string;
}

const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 48rem)").matches;

/**
 * Selector del aire (grave, andante, allegro…).
 *
 * En escritorio se despliega como una tarjeta ancha a dos columnas: los doce
 * aires caben de una vez, sin barra de desplazamiento y sin tapar el tempo.
 * En móvil sube una hoja desde abajo, que es donde llega el pulgar y donde cabe
 * la explicación de cada aire.
 */
export function TempoPicker({
  marks,
  value,
  onChange,
}: {
  marks: TempoMark[];
  value: string;
  onChange: (mark: TempoMark) => void;
}) {
  const [open, setOpen] = useState(false);
  // Se decide al abrir, como en el lector de partituras: sin estado que
  // sincronizar y sin riesgo de que el servidor pinte una cosa y el navegador otra.
  const [sheet, setSheet] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = marks.find((m) => m.id === value) ?? marks[0];

  useEffect(() => {
    if (!open || sheet) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, sheet]);

  const choose = (mark: TempoMark) => {
    onChange(mark);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative inline-block" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setSheet(!isDesktop());
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-2 h-11 pl-5 pr-4 rounded-full bg-surface-2 border border-line text-ink font-semibold hover:bg-surface-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {current.label}
        <ChevronIcon dir="down" className={`w-4 h-4 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && !sheet && (
        <div
          role="dialog"
          aria-label="Aire"
          // Centrado bajo la píldora y en dos columnas: cabe entero, así que se
          // ve de un vistazo dónde queda cada aire respecto a los demás.
          className="absolute z-30 left-1/2 -translate-x-1/2 top-full mt-2 w-[min(34rem,80vw)] card border border-line p-2 shadow-lg animate-[fade-in_0.15s_ease]"
        >
          {/* grid-flow-col: los aires van en orden de lento a rápido bajando por
              la primera columna y siguiendo por la segunda, como una escala. */}
          <ul className="grid grid-rows-6 grid-flow-col gap-1">
            {marks.map((m) => (
              <li key={m.id}>
                <MarkButton mark={m} selected={m.id === value} onClick={() => choose(m)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 68dvh: la hoja no sube hasta el borde de la pantalla —queda claro que
          está encima de la página, no que la ha sustituido— y la lista, que es
          larga, se desplaza dentro. */}
      <Sheet
        open={open && sheet}
        onClose={() => setOpen(false)}
        title="Aire"
        subtitle="La velocidad, con su nombre de siempre"
        maxHeight="68dvh"
      >
        <ul className="space-y-1 pb-1">
          {marks.map((m) => (
            <li key={m.id}>
              <MarkButton mark={m} selected={m.id === value} onClick={() => choose(m)} withHint />
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

function MarkButton({
  mark,
  selected,
  onClick,
  withHint = false,
}: {
  mark: TempoMark;
  selected: boolean;
  onClick: () => void;
  withHint?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={`w-full text-left px-4 py-2.5 rounded-2xl transition-colors ${
        selected ? "bg-ink text-bg" : "text-ink hover:bg-surface-2"
      }`}
    >
      <span className="flex items-baseline gap-3">
        <span className="font-semibold">{mark.label}</span>
        <span className={`ml-auto text-xs tabular-nums shrink-0 ${selected ? "text-bg/70" : "text-ink-3"}`}>
          {mark.min}–{mark.max}
        </span>
      </span>
      {withHint && <span className={`block text-xs mt-0.5 ${selected ? "text-bg/70" : "text-ink-2"}`}>{mark.hint}</span>}
    </button>
  );
}
