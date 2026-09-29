import type { Letter, Pitch } from "./pitch";
import { LATIN_NAMES, ACCIDENTAL_SYMBOL, ACCIDENTAL_VEX } from "./pitch";

/**
 * Armaduras y tonalidades.
 * `fifths` es la posición en el círculo de quintas: positivo = sostenidos, negativo = bemoles.
 */

export interface KeyInfo {
  /** Especificación para VexFlow: "G", "Bb", "Am", "F#m" */
  vex: string;
  tonic: Letter;
  tonicAccidental: number;
  mode: "mayor" | "menor";
  fifths: number;
}

/** Orden de los sostenidos: fa do sol re la mi si */
export const SHARP_ORDER: Letter[] = ["F", "C", "G", "D", "A", "E", "B"];
/** Orden de los bemoles: si mi la re sol do fa */
export const FLAT_ORDER: Letter[] = ["B", "E", "A", "D", "G", "C", "F"];

const MAJORS: [string, Letter, number, number][] = [
  ["C", "C", 0, 0],
  ["G", "G", 0, 1],
  ["D", "D", 0, 2],
  ["A", "A", 0, 3],
  ["E", "E", 0, 4],
  ["B", "B", 0, 5],
  ["F#", "F", 1, 6],
  ["C#", "C", 1, 7],
  ["F", "F", 0, -1],
  ["Bb", "B", -1, -2],
  ["Eb", "E", -1, -3],
  ["Ab", "A", -1, -4],
  ["Db", "D", -1, -5],
  ["Gb", "G", -1, -6],
  ["Cb", "C", -1, -7],
];

const MINORS: [string, Letter, number, number][] = [
  ["Am", "A", 0, 0],
  ["Em", "E", 0, 1],
  ["Bm", "B", 0, 2],
  ["F#m", "F", 1, 3],
  ["C#m", "C", 1, 4],
  ["G#m", "G", 1, 5],
  ["D#m", "D", 1, 6],
  ["A#m", "A", 1, 7],
  ["Dm", "D", 0, -1],
  ["Gm", "G", 0, -2],
  ["Cm", "C", 0, -3],
  ["Fm", "F", 0, -4],
  ["Bbm", "B", -1, -5],
  ["Ebm", "E", -1, -6],
  ["Abm", "A", -1, -7],
];

export const MAJOR_KEYS: KeyInfo[] = MAJORS.map(([vex, tonic, acc, fifths]) => ({
  vex,
  tonic,
  tonicAccidental: acc,
  mode: "mayor",
  fifths,
}));

export const MINOR_KEYS: KeyInfo[] = MINORS.map(([vex, tonic, acc, fifths]) => ({
  vex,
  tonic,
  tonicAccidental: acc,
  mode: "menor",
  fifths,
}));

export const ALL_KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];

export function keyByVex(vex: string): KeyInfo {
  const k = ALL_KEYS.find((x) => x.vex === vex);
  if (!k) throw new Error(`Tonalidad desconocida: ${vex}`);
  return k;
}

export function keysWithFifths(fifths: number): { major: KeyInfo; minor: KeyInfo } {
  return {
    major: MAJOR_KEYS.find((k) => k.fifths === fifths)!,
    minor: MINOR_KEYS.find((k) => k.fifths === fifths)!,
  };
}

/** "Sol mayor" / "mi menor" / "Si♭ mayor". */
export function keyName(k: KeyInfo, system: "latino" | "anglosajon" = "latino"): string {
  const base =
    system === "latino"
      ? LATIN_NAMES[k.tonic].charAt(0).toUpperCase() + LATIN_NAMES[k.tonic].slice(1)
      : k.tonic;
  return `${base}${ACCIDENTAL_SYMBOL[k.tonicAccidental]} ${k.mode}`;
}

/** Letras alteradas por la armadura y el tipo de alteración. */
export function keyAccidentals(k: KeyInfo): { letters: Letter[]; accidental: 1 | -1 | 0 } {
  if (k.fifths > 0) return { letters: SHARP_ORDER.slice(0, k.fifths), accidental: 1 };
  if (k.fifths < 0) return { letters: FLAT_ORDER.slice(0, -k.fifths), accidental: -1 };
  return { letters: [], accidental: 0 };
}

/** Aplica la armadura a una letra natural para obtener la nota diatónica. */
export function applyKey(k: KeyInfo, letter: Letter, octave: number): Pitch {
  const { letters, accidental } = keyAccidentals(k);
  return { letter, octave, accidental: letters.includes(letter) ? accidental : 0 };
}

/**
 * La nota en EasyScore, sin la alteración que ya lleva la armadura: en fa
 * mayor, el si bemol se escribe «B3», no «Bb3».
 *
 * VexFlow dibuja delante de la nota todas las alteraciones que le escribes, y
 * la armadura ya las ha puesto una vez al principio del pentagrama. Repetirlas
 * en cada nota es una partitura llena de bemoles de cortesía que ningún editor
 * pondría, y al que está aprendiendo a leer le enseña justo lo contrario de lo
 * que tiene que aprender: que la armadura vale para todo el compás.
 */
export function easyScoreInKey(k: KeyInfo, p: Pitch): string {
  const { letters, accidental } = keyAccidentals(k);
  const implied = letters.includes(p.letter) ? accidental : 0;
  return `${p.letter}${p.accidental === implied ? "" : ACCIDENTAL_VEX[p.accidental]}${p.octave}`;
}

/** Relativo: mayor ↔ menor con la misma armadura. */
export function relativeKey(k: KeyInfo): KeyInfo {
  const pair = keysWithFifths(k.fifths);
  return k.mode === "mayor" ? pair.minor : pair.major;
}
