/**
 * Compases (indicaciones de compás / cifras de compás).
 */

export type MeterKind = "simple" | "compuesto" | "irregular";

export interface TimeSignature {
  id: string;
  numerator: number;
  denominator: number;
  kind: MeterKind;
  /** Número de pulsos (tiempos) por compás */
  beats: number;
  /** Duración de cada pulso en negras */
  beatValue: number;
  /** Subdivisión de cada pulso: 2 (binaria) o 3 (ternaria) */
  subdivision: 2 | 3 | "mixta";
  /** Nombre coloquial en español */
  name: string;
  description: string;
  /** Patrón de acentos: 1 = fuerte, 0.5 = semifuerte, 0 = débil (uno por pulso) */
  accents: number[];
  /** Ejemplos musicales conocidos */
  examples: string[];
}

export const TIME_SIGNATURES: TimeSignature[] = [
  {
    id: "2-4",
    numerator: 2,
    denominator: 4,
    kind: "simple",
    beats: 2,
    beatValue: 1,
    subdivision: 2,
    name: "Compás de dos por cuatro (binario simple)",
    description:
      "Dos pulsos de negra por compás. El primero es fuerte y el segundo débil. Es el compás típico de marchas, polcas y muchas canciones infantiles.",
    accents: [1, 0],
    examples: ["Marchas militares", "Polca", "«Cielito lindo» (algunas versiones)"],
  },
  {
    id: "3-4",
    numerator: 3,
    denominator: 4,
    kind: "simple",
    beats: 3,
    beatValue: 1,
    subdivision: 2,
    name: "Compás de tres por cuatro (ternario simple)",
    description:
      "Tres pulsos de negra por compás: fuerte, débil, débil. Es el compás del vals, el minueto y muchas baladas.",
    accents: [1, 0, 0],
    examples: ["Vals", "Minueto", "«Cumpleaños feliz»"],
  },
  {
    id: "4-4",
    numerator: 4,
    denominator: 4,
    kind: "simple",
    beats: 4,
    beatValue: 1,
    subdivision: 2,
    name: "Compás de cuatro por cuatro (cuaternario simple)",
    description:
      "Cuatro pulsos de negra: fuerte, débil, semifuerte, débil. Es el compás más común de la música popular. También se escribe con una C (compasillo).",
    accents: [1, 0, 0.5, 0],
    examples: ["La mayoría del pop y rock", "«Para Elisa» (compás de 3/8, ¡compáralo!)"],
  },
  {
    id: "2-2",
    numerator: 2,
    denominator: 2,
    kind: "simple",
    beats: 2,
    beatValue: 2,
    subdivision: 2,
    name: "Compás de dos por dos (alla breve o compasillo cortado)",
    description:
      "Dos pulsos de blanca por compás. Contiene las mismas notas que un 4/4 pero se siente «a dos», más ligero. Se escribe también con una C atravesada por una línea.",
    accents: [1, 0],
    examples: ["Marchas rápidas", "Ragtime", "Música coral renacentista"],
  },
  {
    id: "3-8",
    numerator: 3,
    denominator: 8,
    kind: "simple",
    beats: 3,
    beatValue: 0.5,
    subdivision: 2,
    name: "Compás de tres por ocho",
    description:
      "Tres pulsos de corchea. Suele sentirse como un solo pulso ternario rápido por compás. Beethoven escribió «Para Elisa» en 3/8.",
    accents: [1, 0, 0],
    examples: ["«Para Elisa» (Beethoven)", "Danzas rápidas"],
  },
  {
    id: "6-8",
    numerator: 6,
    denominator: 8,
    kind: "compuesto",
    beats: 2,
    beatValue: 1.5,
    subdivision: 3,
    name: "Compás de seis por ocho (binario compuesto)",
    description:
      "Seis corcheas agrupadas en dos pulsos de negra con puntillo. Cada pulso se subdivide en tres. Suena «balanceado»: es el compás de la tarantela, la barcarola y muchas baladas.",
    accents: [1, 0.5],
    examples: ["Tarantela", "«Sobre las olas»", "«We Are the Champions» (versos)"],
  },
  {
    id: "9-8",
    numerator: 9,
    denominator: 8,
    kind: "compuesto",
    beats: 3,
    beatValue: 1.5,
    subdivision: 3,
    name: "Compás de nueve por ocho (ternario compuesto)",
    description:
      "Nueve corcheas en tres pulsos de negra con puntillo. Es como un 3/4 donde cada pulso se divide en tres.",
    accents: [1, 0, 0],
    examples: ["Jigas lentas", "«Clair de lune» (Debussy)"],
  },
  {
    id: "12-8",
    numerator: 12,
    denominator: 8,
    kind: "compuesto",
    beats: 4,
    beatValue: 1.5,
    subdivision: 3,
    name: "Compás de doce por ocho (cuaternario compuesto)",
    description:
      "Doce corcheas en cuatro pulsos de negra con puntillo. Muy usado en blues lento, góspel y baladas con «tresillos» continuos.",
    accents: [1, 0, 0.5, 0],
    examples: ["Blues lento", "Baladas de los años 50", "Góspel"],
  },
  {
    id: "5-4",
    numerator: 5,
    denominator: 4,
    kind: "irregular",
    beats: 5,
    beatValue: 1,
    subdivision: "mixta",
    name: "Compás de cinco por cuatro (irregular o de amalgama)",
    description:
      "Cinco pulsos de negra, agrupados normalmente 3+2 o 2+3. Se percibe como la suma de un compás ternario y uno binario.",
    accents: [1, 0, 0, 0.5, 0],
    examples: ["«Take Five» (Dave Brubeck)", "«Marte» (Holst)"],
  },
  {
    id: "7-8",
    numerator: 7,
    denominator: 8,
    kind: "irregular",
    beats: 7,
    beatValue: 0.5,
    subdivision: "mixta",
    name: "Compás de siete por ocho (irregular)",
    description:
      "Siete corcheas agrupadas 2+2+3, 3+2+2 o 2+3+2. Frecuente en música balcánica, griega y en el rock progresivo.",
    accents: [1, 0, 0.5, 0, 0.5, 0, 0],
    examples: ["Música balcánica", "«Money» (Pink Floyd, en 7/4)"],
  },
];

export const TIME_SIGNATURE_BY_ID = Object.fromEntries(TIME_SIGNATURES.map((t) => [t.id, t]));

/** Duración total del compás en negras. */
export function measureBeats(ts: TimeSignature): number {
  return (ts.numerator * 4) / ts.denominator;
}

export function vexTimeSpec(ts: TimeSignature): string {
  return `${ts.numerator}/${ts.denominator}`;
}
