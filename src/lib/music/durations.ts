/**
 * Figuras rítmicas y silencios. `beats` es la duración en negras (negra = 1).
 */

export interface Figure {
  id: string;
  /** Nombre en español (España / Latinoamérica) */
  name: string;
  /** Nombres alternativos usados en algunos países */
  altNames: string[];
  /** Nombre en inglés, útil para buscar material */
  english: string;
  /** Duración en negras */
  beats: number;
  /** Código de duración de VexFlow */
  vex: "w" | "h" | "q" | "8" | "16" | "32" | "64";
  /** Glifo SMuFL de la nota (plica arriba) */
  noteGlyph: string;
  /** Glifo SMuFL del silencio */
  restGlyph: string;
  /** Nombre del silencio */
  restName: string;
}

export const FIGURES: Figure[] = [
  {
    id: "redonda",
    name: "Redonda",
    altNames: ["semibreve"],
    english: "whole note",
    beats: 4,
    vex: "w",
    noteGlyph: "noteWhole",
    restGlyph: "restWhole",
    restName: "Silencio de redonda",
  },
  {
    id: "blanca",
    name: "Blanca",
    altNames: ["mínima"],
    english: "half note",
    beats: 2,
    vex: "h",
    noteGlyph: "noteHalfUp",
    restGlyph: "restHalf",
    restName: "Silencio de blanca",
  },
  {
    id: "negra",
    name: "Negra",
    altNames: ["semínima"],
    english: "quarter note",
    beats: 1,
    vex: "q",
    noteGlyph: "noteQuarterUp",
    restGlyph: "restQuarter",
    restName: "Silencio de negra",
  },
  {
    id: "corchea",
    name: "Corchea",
    altNames: [],
    english: "eighth note",
    beats: 0.5,
    vex: "8",
    noteGlyph: "note8thUp",
    restGlyph: "rest8th",
    restName: "Silencio de corchea",
  },
  {
    id: "semicorchea",
    name: "Semicorchea",
    altNames: [],
    english: "sixteenth note",
    beats: 0.25,
    vex: "16",
    noteGlyph: "note16thUp",
    restGlyph: "rest16th",
    restName: "Silencio de semicorchea",
  },
  {
    id: "fusa",
    name: "Fusa",
    altNames: [],
    english: "thirty-second note",
    beats: 0.125,
    vex: "32",
    noteGlyph: "note32ndUp",
    restGlyph: "rest32nd",
    restName: "Silencio de fusa",
  },
  {
    id: "semifusa",
    name: "Semifusa",
    altNames: [],
    english: "sixty-fourth note",
    beats: 0.0625,
    vex: "64",
    noteGlyph: "note64thUp",
    restGlyph: "rest64th",
    restName: "Silencio de semifusa",
  },
];

export const FIGURE_BY_VEX = Object.fromEntries(FIGURES.map((f) => [f.vex, f])) as Record<
  Figure["vex"],
  Figure
>;

/** Duración total con puntillos: cada puntillo añade la mitad del valor anterior. */
export function dottedBeats(beats: number, dots: number): number {
  let total = beats;
  let add = beats;
  for (let i = 0; i < dots; i++) {
    add /= 2;
    total += add;
  }
  return total;
}
