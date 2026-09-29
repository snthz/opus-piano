"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { Metronome, unlockAudio } from "@/lib/audio/synth";
import type { TimeSignature } from "@/lib/music/meter";
import { useSettings } from "@/lib/settings";

const MIN_BPM = 30;
const MAX_BPM = 200;

const clamp = (v: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v)));

/** El pulso del compás, dibujado con la fuente de música: corchea, negra, negra con puntillo o blanca. */
const PULSE_GLYPH: Record<number, { names: string[]; label: string }> = {
  0.5: { names: ["note8thUp"], label: "corchea" },
  1: { names: ["noteQuarterUp"], label: "negra" },
  1.5: { names: ["noteQuarterUp", "augmentationDot"], label: "negra con puntillo" },
  2: { names: ["noteHalfUp"], label: "blanca" },
};

/**
 * El metrónomo del cuaderno: lo único que la pantalla puede hacer por una
 * lectura que pasa en el piano. Clica el pulso del compás de la pieza y lo
 * enseña, con el tempo de la primera lectura puesto de antemano.
 *
 * `subdivision` no está a propósito: aquí no se afinan semicorcheas contra el
 * clic, se lee. Para eso está el metrónomo completo en /metronome.
 */
export function BookMetronome({
  ts,
  bpm,
  onBpm,
  target,
}: {
  ts: TimeSignature;
  bpm: number;
  onBpm: (v: number) => void;
  /** Tempo objetivo de la pieza, para volver a él de un toque. */
  target: number;
}) {
  const { settings } = useSettings();
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  // Cambia en cada pulso: reinicia la animación del punto (por el `key`).
  const [pulse, setPulse] = useState(0);
  const metro = useRef<Metronome | null>(null);
  const muted = !settings.sound;
  const glyph = PULSE_GLYPH[ts.beatValue] ?? PULSE_GLYPH[1];

  useEffect(() => () => metro.current?.stop(), []);

  // El motor sigue vivo entre cambios: el tempo nuevo entra en el pulso
  // siguiente, sin cortar el que está sonando.
  useEffect(() => {
    metro.current?.update({ bpm, beatsPerBar: ts.beats, muted });
  }, [bpm, ts.beats, muted]);

  const stop = useCallback(() => {
    metro.current?.stop();
    setRunning(false);
    setBeat(-1);
  }, []);

  // Parar al cambiar de pieza: el compás nuevo puede tener otro pulso.
  useEffect(() => stop, [stop, ts.id]);

  const start = useCallback(async () => {
    await unlockAudio();
    metro.current?.stop();
    metro.current = new Metronome({
      bpm,
      beatsPerBar: ts.beats,
      muted,
      onBeat: (b) => {
        setBeat(b);
        setPulse((p) => p + 1);
      },
    });
    metro.current.start();
    setRunning(true);
  }, [bpm, ts.beats, muted]);

  const step = (d: number) => onBpm(clamp(bpm + d));

  return (
    <div className="card-pastel bg-ash p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (running ? stop() : void start())}
          aria-pressed={running}
          aria-label={running ? "Parar el metrónomo" : "Poner en marcha el metrónomo"}
          className="btn-circle w-12 h-12 shrink-0 active:scale-95"
        >
          {running ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden>
              <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 translate-x-0.5" aria-hidden>
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          )}
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <GlyphIcon name={glyph.names} size={20} fit="em" className="text-ink-2 shrink-0" label={glyph.label} />
          <span className="text-lg text-ink-3 leading-none">=</span>
          <span className="text-3xl font-bold tabular-nums leading-none tracking-tight">{bpm}</span>
        </div>

        {/* El pulso en pantalla: un punto por tiempo del compás, el primero más grande. */}
        <div className="flex items-end gap-1.5 ml-auto" aria-hidden="true">
          {ts.accents.map((accent, i) => {
            const active = running && beat === i;
            const size = accent === 1 ? 16 : accent === 0.5 ? 13 : 11;
            return (
              <span
                // key con el número de pulso: reinicia el bote en cada clic,
                // también cuando el punto encendido es el mismo de antes.
                key={active ? pulse : `off-${i}`}
                style={{ width: size, height: size, animation: active ? "beat-pop 0.16s ease-out" : undefined }}
                className={`rounded-full transition-colors duration-75 ${
                  active ? "bg-ink" : accent === 1 ? "bg-surface-3" : "bg-surface-3/70"
                }`}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => step(-2)} aria-label="Bajar el tempo" className="pill h-8 w-8 p-0 justify-center leading-none text-base">
          −
        </button>
        <input
          type="range"
          min={MIN_BPM}
          max={MAX_BPM}
          value={bpm}
          onChange={(e) => onBpm(Number(e.target.value))}
          aria-label="Tempo del metrónomo"
          className="range flex-1"
        />
        <button type="button" onClick={() => step(2)} aria-label="Subir el tempo" className="pill h-8 w-8 p-0 justify-center leading-none text-base">
          +
        </button>
      </div>

      <p className="text-xs text-ink-3">
        Empieza al tempo que está puesto y sube solo cuando la leas sin tropiezos. Objetivo de la pieza:{" "}
        <button type="button" onClick={() => onBpm(target)} className="font-semibold text-ink hover:underline">
          {glyph.label} = {target}
        </button>
        .{muted && " El sonido está apagado en Ajustes: el pulso solo se ve."}
      </p>
    </div>
  );
}
