/**
 * Modelo de alturas. Usamos notación científica: do central = C4 = MIDI 60.
 * Los nombres se pueden mostrar en sistema latino (do, re, mi…) o anglosajón (C, D, E…).
 */

export type Letter = "C" | "D" | "E" | "F" | "G" | "A" | "B";
export const NAMING_SYSTEMS = ["latino", "anglosajon"] as const;
export type NamingSystem = (typeof NAMING_SYSTEMS)[number];

export interface Pitch {
  letter: Letter;
  /** -2 doble bemol, -1 bemol, 0 natural, 1 sostenido, 2 doble sostenido */
  accidental: number;
  /** Octava científica (C4 = do central) */
  octave: number;
}

export const LETTERS: Letter[] = ["C", "D", "E", "F", "G", "A", "B"];

export const LATIN_NAMES: Record<Letter, string> = {
  C: "do",
  D: "re",
  E: "mi",
  F: "fa",
  G: "sol",
  A: "la",
  B: "si",
};

/** Semitonos desde do para cada letra natural. */
export const LETTER_SEMITONES: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export const ACCIDENTAL_SYMBOL: Record<number, string> = {
  [-2]: "𝄫",
  [-1]: "♭",
  0: "",
  1: "♯",
  2: "𝄪",
};

/** Sufijo que usa VexFlow para las alteraciones. */
export const ACCIDENTAL_VEX: Record<number, string> = {
  [-2]: "bb",
  [-1]: "b",
  0: "",
  1: "#",
  2: "##",
};

export function pitch(letter: Letter, octave: number, accidental = 0): Pitch {
  return { letter, accidental, octave };
}

export function toMidi(p: Pitch): number {
  return (p.octave + 1) * 12 + LETTER_SEMITONES[p.letter] + p.accidental;
}

const SHARP_SPELLINGS: [Letter, number][] = [
  ["C", 0],
  ["C", 1],
  ["D", 0],
  ["D", 1],
  ["E", 0],
  ["F", 0],
  ["F", 1],
  ["G", 0],
  ["G", 1],
  ["A", 0],
  ["A", 1],
  ["B", 0],
];

const FLAT_SPELLINGS: [Letter, number][] = [
  ["C", 0],
  ["D", -1],
  ["D", 0],
  ["E", -1],
  ["E", 0],
  ["F", 0],
  ["G", -1],
  ["G", 0],
  ["A", -1],
  ["A", 0],
  ["B", -1],
  ["B", 0],
];

export function fromMidi(midi: number, prefer: "sharp" | "flat" = "sharp"): Pitch {
  const pc = ((midi % 12) + 12) % 12;
  const [letter, accidental] = (prefer === "sharp" ? SHARP_SPELLINGS : FLAT_SPELLINGS)[pc];
  const octave = Math.floor(midi / 12) - 1;
  return { letter, accidental, octave };
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
}

/** Nombre de la nota sin octava: "do♯" o "C#". */
export function noteName(p: Pitch, system: NamingSystem = "latino"): string {
  const base = system === "latino" ? LATIN_NAMES[p.letter] : p.letter;
  return base + ACCIDENTAL_SYMBOL[p.accidental];
}

/** Nombre con octava: "do♯4" o "C#4". */
export function fullName(p: Pitch, system: NamingSystem = "latino"): string {
  return `${noteName(p, system)}${p.octave}`;
}

/** Clave para VexFlow: "c#/4". */
export function toVexKey(p: Pitch): string {
  return `${p.letter.toLowerCase()}${ACCIDENTAL_VEX[p.accidental]}/${p.octave}`;
}

/** Nota en formato EasyScore: "C#4", "Bb3". */
export function toEasyScore(p: Pitch): string {
  return `${p.letter}${ACCIDENTAL_VEX[p.accidental]}${p.octave}`;
}

/** Interpreta "C#4", "Bb3", "F4". */
export function parsePitch(text: string): Pitch {
  const m = /^([A-Ga-g])(##|bb|#|b|x)?(-?\d)$/.exec(text.trim());
  if (!m) throw new Error(`Nota inválida: ${text}`);
  const letter = m[1].toUpperCase() as Letter;
  const accText = m[2] ?? "";
  const accidental =
    accText === "##" || accText === "x" ? 2 : accText === "#" ? 1 : accText === "bb" ? -2 : accText === "b" ? -1 : 0;
  return { letter, accidental, octave: Number(m[3]) };
}

/** Frecuencia en Hz (temperamento igual, la4 = 440 Hz). */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Índice diatónico absoluto (C0 = 0, D0 = 1 …). Útil para posiciones en el pentagrama. */
export function diatonicIndex(p: Pitch): number {
  return p.octave * 7 + LETTERS.indexOf(p.letter);
}

export function fromDiatonicIndex(index: number, accidental = 0): Pitch {
  const octave = Math.floor(index / 7);
  const letter = LETTERS[((index % 7) + 7) % 7];
  return { letter, accidental, octave };
}

export function transposeDiatonic(p: Pitch, steps: number): Pitch {
  return fromDiatonicIndex(diatonicIndex(p) + steps, 0);
}

export function samePitch(a: Pitch, b: Pitch): boolean {
  return a.letter === b.letter && a.accidental === b.accidental && a.octave === b.octave;
}

export const MIDDLE_C: Pitch = { letter: "C", accidental: 0, octave: 4 };

/** Rango típico del piano de 88 teclas: la0 (21) a do8 (108). */
export const PIANO_LOWEST_MIDI = 21;
export const PIANO_HIGHEST_MIDI = 108;
