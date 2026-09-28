"use client";

/**
 * El tempo, fuera del panel de opciones: en los ejercicios que van con
 * metrónomo es el ajuste que más se toca, y esconderlo tras el botón de los
 * deslizadores obliga a abrir y cerrar entre intento e intento.
 *
 * Los botones son redondos y sin relleno, y `.pill` centra en vertical pero no
 * en horizontal: de ahí el `justify-center`. El `leading-none` es por el signo
 * menos, que con la altura de línea heredada se monta hacia arriba.
 */
export function TempoControl({
  bpm,
  onChange,
  disabled = false,
  min = 40,
  max = 160,
}: {
  bpm: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  const step = (d: number) => onChange(Math.max(min, Math.min(max, bpm + d)));
  const button = "pill h-8 w-8 p-0 justify-center leading-none text-base disabled:opacity-40";
  return (
    <div className="flex items-center justify-center gap-3">
      <button type="button" onClick={() => step(-4)} disabled={disabled} aria-label="Bajar el tempo" className={button}>
        −
      </button>
      <div className="flex items-center gap-2">
        <span className="w-24 text-center text-sm font-medium tabular-nums">♩ = {bpm}</span>
        <input
          type="range"
          min={min}
          max={max}
          value={bpm}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="accent-(--accent) w-32 disabled:opacity-40"
          aria-label="Tempo"
        />
      </div>
      <button type="button" onClick={() => step(4)} disabled={disabled} aria-label="Subir el tempo" className={button}>
        +
      </button>
    </div>
  );
}
