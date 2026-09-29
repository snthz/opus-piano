import { easyScorePiece } from "./easyscore";
import type { KeyInfo } from "./keys";
import { applyKey, easyScoreInKey } from "./keys";
import type { Pitch } from "./pitch";
import { LETTERS, diatonicIndex, toMidi } from "./pitch";
import type { TimeSignature } from "./meter";
import { fillBar, generateRhythm, type RhythmLevel, type RhythmNote } from "./rhythm";
import { pick } from "@/lib/random";

export interface MelodyNote extends RhythmNote {
  pitch: Pitch;
}

export interface Melody {
  measures: MelodyNote[][];
  /** Compases en EasyScore */
  easy: string[];
  events: { midis: number[]; beats: number }[];
}

const RANGES: Record<"treble" | "bass", [number, number]> = {
  // índices diatónicos: C4 = 4*7+0 = 28
  treble: [diatonicIndex({ letter: "C", accidental: 0, octave: 4 }), diatonicIndex({ letter: "A", accidental: 0, octave: 5 })],
  bass: [diatonicIndex({ letter: "E", accidental: 0, octave: 2 }), diatonicIndex({ letter: "C", accidental: 0, octave: 4 })],
};

function pitchAt(index: number, key: KeyInfo): Pitch {
  const octave = Math.floor(index / 7);
  const letter = LETTERS[((index % 7) + 7) % 7];
  return applyKey(key, letter, octave);
}

/**
 * Melodía diatónica: movimiento mayormente por grados conjuntos, algún salto,
 * empieza en la tónica (o 3.ª/5.ª) y termina en la tónica con valor largo.
 */
export function generateMelody(
  key: KeyInfo,
  clef: "treble" | "bass",
  ts: TimeSignature,
  measures: number,
  level: RhythmLevel,
  opts: {
    /** Acota el registro; por defecto, el habitual de la clave. */
    range?: [Pitch, Pitch];
    /** Fuerza la presencia o ausencia de silencios (por defecto, según el nivel). */
    noRests?: boolean;
  } = {},
): Melody {
  const [lo, hi] = opts.range ? [diatonicIndex(opts.range[0]), diatonicIndex(opts.range[1])] : RANGES[clef];
  const rhythm = generateRhythm(ts, level, measures, { noRests: opts.noRests ?? level < 3 });
  // Último compás: una nota larga en la tónica.
  const totalBeats = rhythm[0].reduce((s, n) => s + n.beats, 0);
  rhythm[rhythm.length - 1] = fillBar(totalBeats);

  // Tónicas dentro del rango.
  const tonicIdx = LETTERS.indexOf(key.tonic);
  const tonics: number[] = [];
  for (let i = lo; i <= hi; i++) if (((i % 7) + 7) % 7 === tonicIdx) tonics.push(i);
  const midTonic = tonics[Math.floor(tonics.length / 2)] ?? lo;
  let current = pick([midTonic, midTonic + 2, midTonic + 4].filter((i) => i >= lo && i <= hi));

  const out: MelodyNote[][] = rhythm.map((m, mi) =>
    m.map((n, ni) => {
      const isLast = mi === rhythm.length - 1 && ni === m.length - 1;
      if (isLast) {
        // Tónica más cercana a la nota actual (si el registro tiene alguna).
        if (tonics.length) {
          current = tonics.reduce((best, t) => (Math.abs(t - current) < Math.abs(best - current) ? t : best), tonics[0]);
        }
      } else if (!(mi === 0 && ni === 0)) {
        const r = Math.random();
        const size = r < 0.65 ? 1 : r < 0.9 ? 2 : 4;
        const dir = Math.random() < 0.5 ? 1 : -1;
        // El salto se da la vuelta si no cabe, y se encoge si tampoco cabe al
        // revés: en un registro de cinco notas no entra una sexta en ninguna
        // de las dos direcciones, y dar la vuelta sin más se salía por el otro
        // extremo.
        const tries = [size * dir, -size * dir, dir, -dir];
        current = tries.map((s) => current + s).find((i) => i >= lo && i <= hi) ?? current;
      }
      return { ...n, pitch: pitchAt(current, key) };
    }),
  );

  // Las alteraciones de la armadura no se repiten delante de cada nota: ya
  // están escritas al principio del pentagrama.
  const easy = out.map((m) => m.map((n) => easyScorePiece(easyScoreInKey(key, n.pitch), n.vex, n.rest)).join(", "));
  const events = out.flat().map((n) => ({ midis: n.rest ? [] : [toMidi(n.pitch)], beats: n.beats }));
  return { measures: out, easy, events };
}
