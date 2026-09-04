import type { Pitch, Letter } from "./pitch";
import { LETTERS, LETTER_SEMITONES, toMidi } from "./pitch";

/**
 * Intervalos, escalas y acordes básicos.
 */

export interface IntervalInfo {
  /** Semitonos */
  semitones: number;
  /** Grados diatónicos (0 = unísono, 1 = segunda …) */
  steps: number;
  name: string;
  short: string;
  /** Canción de referencia (ascendente) para reconocerlo de oído */
  reference?: string;
}

export const INTERVALS: IntervalInfo[] = [
  { semitones: 0, steps: 0, name: "Unísono", short: "1J" },
  { semitones: 1, steps: 1, name: "Segunda menor", short: "2m", reference: "Tiburón (Jaws)" },
  { semitones: 2, steps: 1, name: "Segunda mayor", short: "2M", reference: "Cumpleaños feliz" },
  { semitones: 3, steps: 2, name: "Tercera menor", short: "3m", reference: "Greensleeves" },
  { semitones: 4, steps: 2, name: "Tercera mayor", short: "3M", reference: "Oh, When the Saints" },
  { semitones: 5, steps: 3, name: "Cuarta justa", short: "4J", reference: "Marcha nupcial" },
  { semitones: 6, steps: 3, name: "Cuarta aumentada / tritono", short: "4A", reference: "Los Simpson" },
  { semitones: 7, steps: 4, name: "Quinta justa", short: "5J", reference: "Estrellita / Star Wars" },
  { semitones: 8, steps: 5, name: "Sexta menor", short: "6m", reference: "Love Story" },
  { semitones: 9, steps: 5, name: "Sexta mayor", short: "6M", reference: "My Bonnie" },
  { semitones: 10, steps: 6, name: "Séptima menor", short: "7m", reference: "Somewhere (West Side Story)" },
  { semitones: 11, steps: 6, name: "Séptima mayor", short: "7M", reference: "Take On Me" },
  { semitones: 12, steps: 7, name: "Octava justa", short: "8J", reference: "Somewhere Over the Rainbow" },
];

export function intervalBySemitones(semitones: number): IntervalInfo | undefined {
  return INTERVALS.find((i) => i.semitones === semitones);
}

export interface ScaleType {
  id: string;
  name: string;
  /** Intervalos en semitonos desde la tónica, sin repetir la octava */
  steps: number[];
  /** Fórmula en tonos (T) y semitonos (S) */
  formula: string;
  description: string;
}

export const SCALES: ScaleType[] = [
  {
    id: "mayor",
    name: "Escala mayor",
    steps: [0, 2, 4, 5, 7, 9, 11],
    formula: "T T S T T T S",
    description:
      "La escala más usada en la música occidental. Suena luminosa y estable. Los semitonos están entre los grados 3-4 y 7-8.",
  },
  {
    id: "menor-natural",
    name: "Escala menor natural",
    steps: [0, 2, 3, 5, 7, 8, 10],
    formula: "T S T T S T T",
    description:
      "Las mismas notas que la escala mayor relativa, empezando en el sexto grado. Suena más oscura o melancólica.",
  },
  {
    id: "menor-armonica",
    name: "Escala menor armónica",
    steps: [0, 2, 3, 5, 7, 8, 11],
    formula: "T S T T S T½ S",
    description:
      "Menor natural con el séptimo grado elevado. Crea una sensible que atrae hacia la tónica. Tiene un salto de tono y medio característico.",
  },
  {
    id: "menor-melodica",
    name: "Escala menor melódica",
    steps: [0, 2, 3, 5, 7, 9, 11],
    formula: "T S T T T T S",
    description:
      "Menor con el sexto y el séptimo grados elevados al subir (en la práctica clásica, al bajar se usa la menor natural).",
  },
  {
    id: "pentatonica-mayor",
    name: "Pentatónica mayor",
    steps: [0, 2, 4, 7, 9],
    formula: "T T T½ T T½",
    description: "Cinco notas de la escala mayor sin el 4.º ni el 7.º grado. Muy usada en el folclore y la improvisación.",
  },
  {
    id: "pentatonica-menor",
    name: "Pentatónica menor",
    steps: [0, 3, 5, 7, 10],
    formula: "T½ T T T½ T",
    description: "Cinco notas de la escala menor. Base del blues y del rock.",
  },
  {
    id: "cromatica",
    name: "Escala cromática",
    steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    formula: "S S S S S S S S S S S S",
    description: "Los doce semitonos. En el piano son todas las teclas, blancas y negras, en orden.",
  },
];

/** Construye la escala en una tónica dada. Las escalas diatónicas usan una letra por grado. */
export function buildScale(scale: ScaleType, tonic: Pitch): Pitch[] {
  const tonicMidi = toMidi(tonic);
  const diatonic = scale.steps.length === 7;
  if (!diatonic) {
    // Deletreo simple por sostenidos/bemoles según la tónica.
    return scale.steps.map((s) => {
      const midi = tonicMidi + s;
      const pc = ((midi % 12) + 12) % 12;
      const octave = Math.floor(midi / 12) - 1;
      const natural = (Object.keys(LETTER_SEMITONES) as Letter[]).find((l) => LETTER_SEMITONES[l] === pc);
      if (natural) return { letter: natural, accidental: 0, octave };
      const preferFlat = tonic.accidental < 0 || ["F"].includes(tonic.letter);
      if (preferFlat) {
        const upper = (Object.keys(LETTER_SEMITONES) as Letter[]).find(
          (l) => LETTER_SEMITONES[l] === (pc + 1) % 12,
        )!;
        return { letter: upper, accidental: -1, octave };
      }
      const lower = (Object.keys(LETTER_SEMITONES) as Letter[]).find(
        (l) => LETTER_SEMITONES[l] === (pc + 11) % 12,
      )!;
      return { letter: lower, accidental: 1, octave };
    });
  }
  const startIndex = LETTERS.indexOf(tonic.letter);
  return scale.steps.map((semi, degree) => {
    const letter = LETTERS[(startIndex + degree) % 7];
    const octave = tonic.octave + Math.floor((startIndex + degree) / 7);
    const naturalMidi = (octave + 1) * 12 + LETTER_SEMITONES[letter];
    const accidental = tonicMidi + semi - naturalMidi;
    return { letter, accidental, octave };
  });
}

export interface ChordType {
  id: string;
  name: string;
  /** Semitonos desde la fundamental */
  intervals: number[];
  suffix: string;
  description: string;
}

export const CHORDS: ChordType[] = [
  { id: "mayor", name: "Tríada mayor", intervals: [0, 4, 7], suffix: "", description: "Tercera mayor + tercera menor. Sonido alegre y estable." },
  { id: "menor", name: "Tríada menor", intervals: [0, 3, 7], suffix: "m", description: "Tercera menor + tercera mayor. Sonido melancólico." },
  { id: "disminuido", name: "Tríada disminuida", intervals: [0, 3, 6], suffix: "°", description: "Dos terceras menores. Tenso, inestable." },
  { id: "aumentado", name: "Tríada aumentada", intervals: [0, 4, 8], suffix: "+", description: "Dos terceras mayores. Suspendido, misterioso." },
  { id: "septima-dominante", name: "Séptima de dominante", intervals: [0, 4, 7, 10], suffix: "7", description: "Tríada mayor + séptima menor. Pide resolver a la tónica." },
  { id: "septima-mayor", name: "Séptima mayor", intervals: [0, 4, 7, 11], suffix: "maj7", description: "Tríada mayor + séptima mayor. Suave, jazzístico." },
  { id: "septima-menor", name: "Séptima menor", intervals: [0, 3, 7, 10], suffix: "m7", description: "Tríada menor + séptima menor." },
];

/** Grados de la escala con su nombre funcional. */
export const DEGREE_NAMES = ["Tónica", "Supertónica", "Mediante", "Subdominante", "Dominante", "Submediante", "Sensible"];
export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
