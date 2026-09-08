"use client";

import { useMemo, useState } from "react";
import { fromMidi, isBlackKey, noteName, fullName } from "@/lib/music/pitch";
import { useSettings } from "@/lib/settings";
import { playNote, unlockAudio } from "@/lib/audio/synth";

export interface PianoKeyboardProps {
  /** Nota MIDI inicial (se ajusta a una tecla blanca) */
  from?: number;
  /** Nota MIDI final */
  to?: number;
  /** Teclas resaltadas (MIDI) */
  highlight?: number[];
  /** Segundo color de resaltado (p. ej. respuesta correcta) */
  highlightAlt?: number[];
  /** Etiquetas: todas, solo los do, o ninguna. Si se omite, usa el ajuste del usuario. */
  labels?: "all" | "c" | "none";
  /** Reproduce la nota al pulsar */
  sound?: boolean;
  onPress?: (midi: number) => void;
  /** Marca el do central */
  markMiddleC?: boolean;
  className?: string;
  /** Altura del SVG en unidades relativas al ancho de tecla (por defecto 4) */
  aspect?: number;
}

/* Las teclas llevan colores fijos (un piano es un piano en cualquier tema),
   así que el resaltado también: ámbar, legible sobre blanca y negra. */
const HIGHLIGHT = "#f0a92b";

const WHITE_W = 24;
const BLACK_W = 14;

export function PianoKeyboard({
  from = 48,
  to = 72,
  highlight = [],
  highlightAlt = [],
  labels,
  sound = true,
  onPress,
  markMiddleC = true,
  className = "",
  aspect = 4.2,
}: PianoKeyboardProps) {
  const { settings } = useSettings();
  const [pressed, setPressed] = useState<number | null>(null);
  const labelMode = labels ?? (settings.keyLabels ? "all" : "c");

  const { whites, blacks, width } = useMemo(() => {
    let start = from;
    while (isBlackKey(start)) start--;
    let end = to;
    while (isBlackKey(end)) end++;
    const whites: { midi: number; x: number }[] = [];
    const blacks: { midi: number; x: number }[] = [];
    let x = 0;
    for (let m = start; m <= end; m++) {
      if (isBlackKey(m)) {
        blacks.push({ midi: m, x: x - BLACK_W / 2 });
      } else {
        whites.push({ midi: m, x });
        x += WHITE_W;
      }
    }
    return { whites, blacks, width: x };
  }, [from, to]);

  const height = WHITE_W * aspect;
  const blackH = height * 0.62;

  const press = (midi: number) => {
    setPressed(midi);
    if (sound && settings.sound) {
      void unlockAudio().then(() => playNote(midi, { duration: 0.9, velocity: settings.volume }));
    }
    onPress?.(midi);
    window.setTimeout(() => setPressed((p) => (p === midi ? null : p)), 180);
  };

  const fillFor = (midi: number, black: boolean) => {
    if (highlight.includes(midi)) return HIGHLIGHT;
    if (highlightAlt.includes(midi)) return "var(--ok)";
    if (pressed === midi) return black ? "#4a4650" : "#e6e6ee";
    return black ? "#1c1917" : "#fbf7ef";
  };

  const labelFor = (midi: number) => {
    const p = fromMidi(midi);
    if (labelMode === "none") return null;
    if (labelMode === "c" && p.letter !== "C") return null;
    return p.letter === "C" ? fullName(p, settings.naming) : noteName(p, settings.naming);
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`w-full select-none touch-none ${className}`}
      style={{ maxHeight: 220 }}
      role="group"
      aria-label="Teclado de piano"
    >
      {whites.map((k) => (
        <g key={k.midi} onPointerDown={() => press(k.midi)} style={{ cursor: "pointer" }}>
          <rect
            x={k.x}
            y={0}
            width={WHITE_W}
            height={height}
            rx={2}
            fill={fillFor(k.midi, false)}
            stroke="#8a8278"
            strokeWidth={0.6}
          />
          {labelFor(k.midi) && (
            <text
              x={k.x + WHITE_W / 2}
              y={height - 6}
              textAnchor="middle"
              fontSize={k.midi === 60 && markMiddleC ? 6.5 : 5.5}
              fontWeight={k.midi === 60 && markMiddleC ? 700 : 500}
              fill={highlight.includes(k.midi) ? "#3b2a08" : "#57534e"}
              fontFamily="var(--font-sans)"
            >
              {labelFor(k.midi)}
            </text>
          )}
          {markMiddleC && k.midi === 60 && (
            <circle cx={k.x + WHITE_W / 2} cy={height - 16} r={2} fill="#57534e" />
          )}
        </g>
      ))}
      {blacks.map((k) => (
        <g key={k.midi} onPointerDown={() => press(k.midi)} style={{ cursor: "pointer" }}>
          <rect
            x={k.x}
            y={0}
            width={BLACK_W}
            height={blackH}
            rx={1.5}
            fill={fillFor(k.midi, true)}
            stroke="#0f0d0c"
            strokeWidth={0.6}
          />
          {labelMode === "all" && (
            <text
              x={k.x + BLACK_W / 2}
              y={blackH - 5}
              textAnchor="middle"
              fontSize={3.8}
              fill={highlight.includes(k.midi) ? "#ffffff" : "#d9d0bd"}
              fontFamily="var(--font-sans)"
            >
              {labelFor(k.midi)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
