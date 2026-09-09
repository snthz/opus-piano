"use client";

import { useState } from "react";

type Props = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Salto de los botones y de las flechas del teclado. */
  step?: number;
  /** Texto a la derecha del número (p. ej. «min»). */
  suffix?: string;
  /** Rellena con ceros a la izquierda hasta estas cifras (p. ej. `2` → «05»). */
  pad?: number;
  /** Sin botones − / +: solo el campo con las flechas del teclado. */
  bare?: boolean;
  /** Al pasar del máximo vuelve al mínimo y viceversa (horas, minutos). */
  wrap?: boolean;
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
export function NumberField({ value, onChange, min, max, step = 1, suffix, pad, bare, wrap, className = "", disabled, ...rest }: Props) {
  const fmt = (n: number) => (pad ? String(n).padStart(pad, "0") : String(n));
  // Texto libre solo mientras el campo tiene el foco; fuera de él se muestra
  // siempre el valor real, así un cambio desde fuera se refleja sin efectos.
  const [draft, setDraft] = useState<string | null>(null);
  const focused = draft !== null;
  const text = draft ?? fmt(value);
  // Fuera del foco no hay borrador: el texto sale del valor.
  const setText = (t: string) => setDraft((d) => (d === null ? null : t));

  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));

  const commit = (raw: string) => {
    const n = Number(raw.trim());
    const next = raw.trim() === "" || !Number.isFinite(n) ? value : clamp(n);
    setText(fmt(next));
    if (next !== value) onChange(next);
  };

  const nudge = (dir: 1 | -1, big = false) => {
    if (disabled) return;
    const base = focused ? Number(text.trim()) : value;
    const from = Number.isFinite(base) && text.trim() !== "" ? base : value;
    const raw = from + dir * step * (big ? 10 : 1);
    const span = max - min + 1;
    const next = wrap ? min + ((((raw - min) % span) + span) % span) : clamp(raw);
    setText(fmt(next));
    if (next !== value) onChange(next);
  };

  const canDec = !disabled && (wrap || value > min);
  const canInc = !disabled && (wrap || value < max);

  return (
    <div
      className={`flex items-stretch rounded-2xl bg-surface-2 text-sm transition-shadow ${focused ? "ring-2 ring-accent" : ""} ${
        disabled ? "opacity-50" : ""
      } ${className}`}
    >
      {!bare && <StepButton dir={-1} enabled={canDec} onStep={nudge} label="Menos" />}
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
            setDraft(fmt(value));
            e.currentTarget.select();
          }}
          onBlur={() => {
            commit(text);
            setDraft(null);
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
              setText(fmt(value));
            }
          }}
          className="w-full min-w-0 bg-transparent text-center tabular-nums py-2 focus:outline-none"
          style={{ maxWidth: `${Math.max(String(max).length, pad ?? 0) + 1.5}ch` }}
        />
        {suffix && <span className="text-ink-3 text-xs select-none">{suffix}</span>}
      </div>
      {!bare && <StepButton dir={1} enabled={canInc} onStep={nudge} label="Más" />}
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
