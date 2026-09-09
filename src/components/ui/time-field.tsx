"use client";

import { NumberField } from "./number-field";

type Props = {
  /** Hora local, «HH:MM». */
  value: string;
  onChange: (value: string) => void;
  /** Salto de los minutos con los botones y las flechas. */
  minuteStep?: number;
  className?: string;
  disabled?: boolean;
};

/**
 * Sustituto del `<input type="time">` nativo: dos campos (hora y minutos) con
 * botones − / + y flechas del teclado, con el aspecto del resto de campos.
 * Las horas y los minutos dan la vuelta al pasar del límite (23 → 00, 55 → 00).
 */
export function TimeField({ value, onChange, minuteStep = 5, className = "", disabled }: Props) {
  const [h, m] = parseTime(value);
  const emit = (hh: number, mm: number) => onChange(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);

  return (
    <div className={`flex items-center gap-2 ${className}`} role="group" aria-label="Hora de la sesión">
      <NumberField aria-label="Hora" min={0} max={23} pad={2} wrap value={h} onChange={(hh) => emit(hh, m)} disabled={disabled} className="flex-1" />
      <span className="text-ink-3 font-medium select-none" aria-hidden>
        :
      </span>
      <NumberField
        aria-label="Minutos"
        min={0}
        max={59}
        step={minuteStep}
        pad={2}
        wrap
        value={m}
        onChange={(mm) => emit(h, mm)}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
}

function parseTime(v: string): [number, number] {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(v);
  if (!match) return [18, 0];
  return [Math.min(23, Number(match[1])), Math.min(59, Number(match[2]))];
}
