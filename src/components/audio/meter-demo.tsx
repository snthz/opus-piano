"use client";

import { useEffect, useRef, useState } from "react";
import { Metronome, unlockAudio } from "@/lib/audio/synth";
import { useSettings } from "@/lib/settings";
import type { TimeSignature } from "@/lib/music/meter";

/**
 * Metrónomo visual: marca los pulsos de un compás con sus acentos
 * y, opcionalmente, la subdivisión (binaria o ternaria).
 */
export function MeterDemo({ ts, initialBpm = 90 }: { ts: TimeSignature; initialBpm?: number }) {
  const { settings } = useSettings();
  const [bpm, setBpm] = useState(initialBpm);
  const [subdivide, setSubdivide] = useState(false);
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState(-1);
  const [sub, setSub] = useState(0);
  const metro = useRef<Metronome | null>(null);

  const subdivision = ts.subdivision === "mixta" ? 1 : ts.subdivision;

  useEffect(() => {
    return () => metro.current?.stop();
  }, []);

  useEffect(() => {
    metro.current?.update({ bpm: bpm / (ts.beatValue === 0.5 ? 1 : 1), subdivision: subdivide ? subdivision : 1 });
  }, [bpm, subdivide, subdivision, ts.beatValue]);

  const toggle = async () => {
    if (running) {
      metro.current?.stop();
      setRunning(false);
      setBeat(-1);
      return;
    }
    await unlockAudio();
    metro.current = new Metronome({
      bpm,
      beatsPerBar: ts.beats,
      subdivision: subdivide ? subdivision : 1,
      onBeat: (b, s) => {
        setBeat(b);
        setSub(s);
      },
    });
    metro.current.start();
    setRunning(true);
  };

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold">
            {ts.numerator}/{ts.denominator} · {ts.beats} pulsos
          </p>
          <p className="text-xs text-ink-3">
            {ts.kind === "compuesto" ? "Cada pulso se divide en 3" : ts.kind === "simple" ? "Cada pulso se divide en 2" : "Agrupación mixta"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={!settings.sound}
          className={`pill ${running ? "pill-active" : ""} disabled:opacity-50`}
        >
          {running ? "■ Parar" : "▶ Marcar el compás"}
        </button>
      </div>

      <div className="flex items-end justify-center gap-3 py-2">
        {ts.accents.map((acc, i) => {
          const active = running && beat === i;
          const size = acc === 1 ? 44 : acc === 0.5 ? 36 : 28;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`rounded-full transition-all duration-75 ${
                  active ? "bg-ok scale-110" : acc === 1 ? "bg-ink" : acc === 0.5 ? "bg-ink-2" : "bg-surface-3"
                }`}
                style={{ width: size, height: size }}
              />
              <span className="text-xs text-ink-3 tabular-nums">{i + 1}</span>
              {subdivide && subdivision > 1 && (
                <div className="flex gap-0.5">
                  {Array.from({ length: subdivision }).map((_, s) => (
                    <span
                      key={s}
                      className={`w-1.5 h-1.5 rounded-full ${active && sub === s ? "bg-ok" : "bg-surface-3"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap text-sm">
        <label className="flex items-center gap-2 flex-1 min-w-48">
          <span className="text-ink-2 w-16">♩ = {bpm}</span>
          <input
            type="range"
            min={40}
            max={180}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="flex-1 accent-(--accent)"
            aria-label="Tempo"
          />
        </label>
        {subdivision > 1 && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={subdivide} onChange={(e) => setSubdivide(e.target.checked)} className="accent-(--accent)" />
            Subdivisión
          </label>
        )}
      </div>
    </div>
  );
}
