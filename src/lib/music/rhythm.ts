import { easyScorePiece } from "./easyscore";
import type { TimeSignature } from "./meter";
import { measureBeats } from "./meter";
import { pick } from "@/lib/random";

/** Una figura dentro de un patrón rítmico. `beats` en negras. */
export interface RhythmNote {
  beats: number;
  rest: boolean;
  /** Duración VexFlow/EasyScore: "q", "8", "q.", "16"… */
  vex: string;
}

export type RhythmLevel = 1 | 2 | 3;

/** Unidades (grupos de figuras) que ocupan un pulso o más, por nivel, para compases simples. */
const SIMPLE_UNITS: Record<RhythmLevel, RhythmNote[][]> = {
  1: [
    [{ beats: 1, rest: false, vex: "q" }],
    [{ beats: 1, rest: false, vex: "q" }],
    [{ beats: 1, rest: false, vex: "q" }],
    [{ beats: 2, rest: false, vex: "h" }],
    [{ beats: 1, rest: true, vex: "q" }],
  ],
  2: [
    [{ beats: 1, rest: false, vex: "q" }],
    [{ beats: 1, rest: false, vex: "q" }],
    [{ beats: 2, rest: false, vex: "h" }],
    [{ beats: 1, rest: true, vex: "q" }],
    [
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 0.5, rest: false, vex: "8" },
    ],
    [
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 0.5, rest: false, vex: "8" },
    ],
    [{ beats: 3, rest: false, vex: "h." }],
  ],
  3: [
    [{ beats: 1, rest: false, vex: "q" }],
    [{ beats: 2, rest: false, vex: "h" }],
    [{ beats: 1, rest: true, vex: "q" }],
    [
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 0.5, rest: false, vex: "8" },
    ],
    [
      { beats: 0.5, rest: true, vex: "8" },
      { beats: 0.5, rest: false, vex: "8" },
    ],
    [
      { beats: 0.25, rest: false, vex: "16" },
      { beats: 0.25, rest: false, vex: "16" },
      { beats: 0.25, rest: false, vex: "16" },
      { beats: 0.25, rest: false, vex: "16" },
    ],
    [
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 0.25, rest: false, vex: "16" },
      { beats: 0.25, rest: false, vex: "16" },
    ],
    [
      { beats: 1.5, rest: false, vex: "q." },
      { beats: 0.5, rest: false, vex: "8" },
    ],
  ],
};

/** Unidades de un pulso (negra con puntillo = 1.5 negras) para compases compuestos. */
const COMPOUND_UNITS: Record<RhythmLevel, RhythmNote[][]> = {
  1: [
    [{ beats: 1.5, rest: false, vex: "q." }],
    [
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 0.5, rest: false, vex: "8" },
    ],
    [
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 0.5, rest: false, vex: "8" },
    ],
  ],
  2: [
    [{ beats: 1.5, rest: false, vex: "q." }],
    [
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 0.5, rest: false, vex: "8" },
    ],
    [
      { beats: 1, rest: false, vex: "q" },
      { beats: 0.5, rest: false, vex: "8" },
    ],
    [
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 1, rest: false, vex: "q" },
    ],
    [{ beats: 1.5, rest: true, vex: "q." }],
  ],
  3: [
    [{ beats: 1.5, rest: false, vex: "q." }],
    [
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 0.5, rest: false, vex: "8" },
    ],
    [
      { beats: 1, rest: false, vex: "q" },
      { beats: 0.5, rest: false, vex: "8" },
    ],
    [
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 0.5, rest: true, vex: "8" },
      { beats: 0.5, rest: false, vex: "8" },
    ],
    [
      { beats: 0.5, rest: false, vex: "8" },
      { beats: 0.25, rest: false, vex: "16" },
      { beats: 0.25, rest: false, vex: "16" },
      { beats: 0.5, rest: false, vex: "8" },
    ],
  ],
};

/** Figuras con puntillo y sin él, de mayor a menor, para rellenar un compás entero. */
const DOTTED: [number, string][] = [
  [6, "w."],
  [3, "h."],
  [1.5, "q."],
  [0.75, "8."],
];
const PLAIN: [number, string][] = [
  [4, "w"],
  [2, "h"],
  [1, "q"],
  [0.5, "8"],
  [0.25, "16"],
];

/**
 * Una nota larga que ocupa `beats` negras, en las menos figuras posibles.
 *
 * Los compases compuestos miden en negras con puntillo: un 9/8 son 4,5 negras,
 * que no es ninguna figura, y un 12/8 son 6, que es una redonda con puntillo y
 * no una redonda. Escribirlo con figuras sin puntillo deja el compás corto o
 * parte el pulso por la mitad, así que cuando la duración es múltiplo de la
 * negra con puntillo se escribe con figuras con puntillo.
 */
export function fillBar(beats: number): RhythmNote[] {
  const pulses = beats / 1.5;
  const table = Math.abs(pulses - Math.round(pulses)) < 1e-6 ? DOTTED : PLAIN;
  const out: RhythmNote[] = [];
  let left = beats;
  for (const [value, vex] of [...table, ...PLAIN]) {
    while (left >= value - 1e-6) {
      out.push({ beats: value, rest: false, vex });
      left -= value;
    }
  }
  return out.length ? out : [{ beats, rest: false, vex: "q" }];
}

/** Genera un compás completo. */
export function generateMeasure(ts: TimeSignature, level: RhythmLevel, opts: { noRests?: boolean } = {}): RhythmNote[] {
  const total = measureBeats(ts);
  const units = (ts.kind === "compuesto" ? COMPOUND_UNITS : SIMPLE_UNITS)[level].filter(
    (u) => !opts.noRests || !u.some((n) => n.rest),
  );
  const out: RhythmNote[] = [];
  let remaining = total;
  let guard = 0;
  while (remaining > 1e-6 && guard++ < 100) {
    const candidates = units.filter((u) => u.reduce((s, n) => s + n.beats, 0) <= remaining + 1e-6);
    if (!candidates.length) break;
    const unit = pick(candidates);
    // Evita dos silencios seguidos.
    if (unit[0].rest && out.length && out[out.length - 1].rest) continue;
    for (const n of unit) out.push({ ...n });
    remaining -= unit.reduce((s, n) => s + n.beats, 0);
  }
  if (remaining > 1e-6) {
    out.push({ beats: remaining, rest: false, vex: remaining >= 2 ? "h" : remaining >= 1 ? "q" : "8" });
  }
  return out;
}

export function generateRhythm(ts: TimeSignature, level: RhythmLevel, measures: number, opts: { noRests?: boolean } = {}): RhythmNote[][] {
  return Array.from({ length: measures }, () => generateMeasure(ts, level, opts));
}

/** Compás en notación EasyScore con una sola altura (para lectura rítmica). */
export function rhythmToEasyScore(measure: RhythmNote[], pitch = "B4"): string {
  return measure.map((n) => easyScorePiece(pitch, n.vex, n.rest)).join(", ");
}

export function rhythmToEvents(measures: RhythmNote[][], midi = 71) {
  return measures.flat().map((n) => ({ midis: n.rest ? [] : [midi], beats: n.beats }));
}
