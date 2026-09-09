"use client";

import { useEffect, useState } from "react";

type Props = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Salto de los botones y de las flechas del teclado. */
  step?: number;
  /** Texto a la derecha del número (p. ej. «min»). */
  suffix?: string;
  className?: string;
  /** Etiqueta accesible cuando no hay un `<label>` alrededor. */
  "aria-label"?: string;
  disabled?: boolean;
};

/**
 * Sustituto del `<input type="number">` nativo. Mientras se escribe el campo
 * es texto libre (se puede vaciar y volver a teclear sin que salte al mínimo);
 * el valor se valida y se ajusta al rango al salir del campo o pulsar Enter.
 * Los botones − / + y las flechas del teclado cambian el valor de `step` en
 * `step`; con Mayús, de diez en diez pasos.
 */
export function NumberField({ value, onChange, min, max, step = 1, suffix, className = "", disabled, ...rest }: Props) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  // Si el valor cambia desde fuera (p. ej. al cargar preferencias), refleja
  // el nuevo valor salvo que el usuario esté escribiendo.
  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));

  const commit = (raw: string) => {
    const n = Number(raw.trim());
    const next = raw.trim() === "" || !Number.isFinite(n) ? value : clamp(n);
    setText(String(next));
    if (next !== value) onChange(next);
  };

  const nudge = (dir: 1 | -1, big = false) => {
    if (disabled) return;
    const base = focused ? Number(text.trim()) : value;
    const from = Number.isFinite(base) && text.trim() !== "" ? base : value;
    const next = clamp(from + dir * step * (big ? 10 : 1));
    setText(String(next));
    if (next !== value) onChange(next);
  };

  const canDec = !disabled && value > min;
  const canInc = !disabled && value < max;

  return (
    <div
      className={`flex items-stretch rounded-2xl bg-surface-2 text-sm transition-shadow ${focused ? "ring-2 ring-accent" : ""} ${
        disabled ? "opacity-50" : ""
      } ${className}`}
    >
      <StepButton dir={-1} enabled={canDec} onStep={nudge} label="Menos" />
      <div className="flex-1 min-w-0 flex items-center justify-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          role="spinbutton"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label={rest["aria-label"]}
          value={text}
          disabled={disabled}
          onFocus={(e) => {
            setFocused(true);
            e.currentTarget.select();
          }}
          onBlur={() => {
            setFocused(false);
            commit(text);
          }}
          onChange={(e) => setText(e.target.value.replace(/[^\d]/g, "").slice(0, String(max).length))}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              nudge(e.key === "ArrowUp" ? 1 : -1, e.shiftKey);
            } else if (e.key === "Enter") {
              e.preventDefault();
              commit(text);
            } else if (e.key === "Escape") {
              setText(String(value));
            }
          }}
          className="w-full min-w-0 bg-transparent text-center tabular-nums py-2 focus:outline-none"
          style={{ maxWidth: `${String(max).length + 1.5}ch` }}
        />
        {suffix && <span className="text-ink-3 text-xs select-none">{suffix}</span>}
      </div>
      <StepButton dir={1} enabled={canInc} onStep={nudge} label="Más" />
    </div>
  );
}

function StepButton({ dir, enabled, onStep, label }: { dir: 1 | -1; enabled: boolean; onStep: (dir: 1 | -1, big: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      disabled={!enabled}
      // No robar el foco al campo de texto: así el ring se mantiene y el
      // valor tecleado se conserva como base del salto.
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => onStep(dir, e.shiftKey)}
      className="shrink-0 w-10 flex items-center justify-center text-ink-2 rounded-2xl transition-colors hover:bg-ink/5 active:bg-ink/10 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" aria-hidden="true">
        {dir === 1 ? <path d="M12 5v14M5 12h14" strokeLinecap="round" /> : <path d="M5 12h14" strokeLinecap="round" />}
      </svg>
    </button>
  );
}
