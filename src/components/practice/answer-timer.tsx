"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cuenta atrás de una respuesta.
 *
 * El anillo se vacía con `requestAnimationFrame` en vez de con un intervalo de
 * un segundo: leer contra reloj es la mitad del ejercicio, y un número que
 * salta de 5 a 4 no dice lo que queda, solo asusta. Al pasar de `running` a
 * parado se queda donde estaba —es lo que quedaba al responder— y solo vuelve
 * al principio cuando cambia `resetKey`.
 */
export function TimerRing({
  seconds,
  running,
  resetKey,
  onTimeout,
  size = 54,
}: {
  seconds: number;
  running: boolean;
  /** Cambiarla reinicia el reloj (normalmente, el número de pregunta). */
  resetKey: unknown;
  onTimeout: () => void;
  size?: number;
}) {
  // El reloj se pone a cero al cambiar la pregunta, no en un efecto: así no
  // hay un fotograma con el anillo de la pregunta anterior.
  const [clock, setClock] = useState({ key: resetKey, seconds, left: seconds });
  if (clock.key !== resetKey || clock.seconds !== seconds) setClock({ key: resetKey, seconds, left: seconds });
  const left = clock.left;

  const fire = useRef(onTimeout);
  useEffect(() => {
    fire.current = onTimeout;
  });

  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const rest = seconds - (now - started) / 1000;
      setClock((c) => ({ ...c, left: Math.max(0, rest) }));
      if (rest <= 0) {
        fire.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, resetKey, seconds]);

  const ratio = seconds > 0 ? Math.max(0, Math.min(1, left / seconds)) : 0;
  const r = size / 2 - 4;
  const circumference = 2 * Math.PI * r;
  const urgent = ratio <= 0.25;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`Tiempo restante: ${Math.ceil(left)} segundos`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? "var(--bad)" : "var(--accent)"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums ${urgent ? "text-bad" : "text-ink"}`}
      >
        {Math.ceil(left)}
      </span>
    </div>
  );
}

/** Una tanda vista de un vistazo: un punto por pregunta, verde o rojo. */
export function RoundDots({ results, total }: { results: boolean[]; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5" aria-label={`Pregunta ${Math.min(results.length + 1, total)} de ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all ${
            i < results.length
              ? results[i]
                ? "w-5 bg-ok"
                : "w-5 bg-bad"
              : i === results.length
                ? "w-5 bg-ink"
                : "w-2 bg-surface-3"
          }`}
        />
      ))}
    </div>
  );
}
