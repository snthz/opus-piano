/**
 * Lectura infinita: material nuevo del nivel que toque, generado al vuelo.
 *
 * El cuaderno escrito enseña en un orden y se acaba; esto es lo otro que hace
 * falta para leer a primera vista, que es tener siempre delante algo que no
 * has visto nunca. Lo que sale respeta el temario del grado —tonalidades,
 * compases, figuras, registro y qué hace la izquierda— y se devuelve con la
 * misma forma que una pieza del cuaderno, así que se lee en la misma página.
 *
 * La melodía se genera antes que la armonía: primero sale la línea de la
 * derecha y después se le busca a cada compás el acorde que mejor le encaja.
 * Al revés —acordes primero y melodía encima— la izquierda choca con la
 * derecha una vez de cada tres, y una pieza para leer no puede sonar mal.
 *
 * Puro: ni audio ni React.
 */

import { easyScorePiece } from "./easyscore";
import { applyKey, easyScoreInKey, keyByVex, keyName, type KeyInfo } from "./keys";
import { generateMelody } from "./melody";
import { measureBeats, TIME_SIGNATURE_BY_ID, type TimeSignature } from "./meter";
import { LETTERS, parsePitch, toMidi, type Letter, type Pitch } from "./pitch";
import { fillBar, generateRhythm, rhythmToEasyScore, type RhythmLevel } from "./rhythm";
import type { BookItem, BookItemKind } from "./reading-book";
import { pick } from "@/lib/random";

/** Qué hace la mano izquierda debajo de la melodía. */
export type LeftStyle = "whole" | "fifths" | "triad" | "half" | "broken";

export interface GradeRecipe {
  keys: string[];
  meters: string[];
  rhythm: RhythmLevel;
  /** Compases por tipo de ejercicio. */
  bars: Record<BookItemKind, number>;
  /** Registro de la derecha y de la izquierda, en notación científica. */
  treble: [string, string];
  bass: [string, string];
  left: LeftStyle[];
  /** Tempo de referencia en negras; se ajusta al pulso del compás que salga. */
  tempo: [number, number];
}

/**
 * El temario de cada grado, el mismo que el del cuaderno escrito. Cambiar esto
 * cambia lo que sale en la lectura infinita, no lo que hay escrito.
 */
export const RECIPES: Record<number, GradeRecipe> = {
  1: {
    keys: ["C", "G", "F"],
    meters: ["4-4", "3-4", "2-4"],
    rhythm: 1,
    bars: { rhythm: 4, melody: 4, piece: 8 },
    treble: ["C4", "C5"],
    bass: ["C3", "C4"],
    left: ["whole"],
    tempo: [52, 69],
  },
  2: {
    keys: ["C", "G", "F", "D", "Am", "Em"],
    meters: ["4-4", "3-4", "2-4"],
    rhythm: 2,
    bars: { rhythm: 4, melody: 4, piece: 8 },
    treble: ["C4", "D5"],
    bass: ["G2", "C4"],
    left: ["whole", "half", "broken"],
    tempo: [52, 72],
  },
  3: {
    keys: ["G", "F", "D", "Bb", "Em", "Dm"],
    meters: ["4-4", "3-4", "6-8"],
    rhythm: 2,
    bars: { rhythm: 4, melody: 4, piece: 8 },
    treble: ["C4", "E5"],
    bass: ["G2", "C4"],
    left: ["half", "broken", "fifths"],
    tempo: [50, 72],
  },
  4: {
    keys: ["Eb", "A", "Gm", "D", "Bb"],
    meters: ["4-4", "3-4", "2-2", "3-8"],
    rhythm: 3,
    bars: { rhythm: 4, melody: 4, piece: 8 },
    treble: ["C4", "F5"],
    bass: ["A2", "C4"],
    left: ["fifths", "triad", "half"],
    tempo: [50, 72],
  },
  5: {
    keys: ["E", "Ab", "Cm", "Eb", "A"],
    meters: ["4-4", "2-2", "6-8", "9-8", "12-8"],
    rhythm: 3,
    bars: { rhythm: 4, melody: 4, piece: 8 },
    treble: ["C4", "G5"],
    bass: ["A2", "D4"],
    left: ["triad", "broken", "fifths"],
    tempo: [48, 69],
  },
};

/** El tempo sugerido, del pulso del compás y no de la negra. */
export function tempoFor(ts: TimeSignature, tempo: [number, number]): [number, number] {
  const factor = ts.beatValue === 0.5 ? 2 : ts.beatValue === 1.5 ? 0.9 : ts.beatValue === 2 ? 0.85 : 1;
  const round = (v: number) => Math.max(30, Math.min(160, Math.round((v * factor) / 2) * 2));
  return [round(tempo[0]), round(tempo[1])];
}

/** Las tres letras del acorde sobre el grado `degree` (0 = tónica) de la tonalidad. */
function chordLetters(key: KeyInfo, degree: number): Letter[] {
  const root = LETTERS.indexOf(key.tonic);
  return [0, 2, 4].map((step) => LETTERS[(root + degree + step) % 7]);
}

/** Todas las octavas de esa nota que caben en el registro, de grave a aguda. */
function occurrences(key: KeyInfo, letter: Letter, lo: number, hi: number): Pitch[] {
  const out: Pitch[] = [];
  for (let octave = 0; octave <= 8; octave++) {
    const p = applyKey(key, letter, octave);
    const midi = toMidi(p);
    if (midi >= lo && midi <= hi) out.push(p);
  }
  return out;
}

/**
 * Las notas del acorde, de grave a aguda y dentro del registro de la
 * izquierda.
 *
 * Primero se prueba en estado fundamental; si el acorde no cabe entero por
 * arriba —el sol de una izquierda que llega hasta el do4, por ejemplo— se
 * invierte, que es exactamente lo que hace un pianista con la mano donde la
 * tiene. Salirse del registro no es una opción: la nota acabaría por encima de
 * la melodía o debajo de lo que el grado dice que se lee.
 */
function voicing(key: KeyInfo, degree: number, lo: number, hi: number): Pitch[] {
  const letters = chordLetters(key, degree);
  const [roots, thirds, fifths] = letters.map((letter) => occurrences(key, letter, lo, hi));

  for (const root of roots) {
    const third = thirds.find((p) => toMidi(p) > toMidi(root));
    const fifth = third && fifths.find((p) => toMidi(p) > toMidi(third));
    if (third && fifth) return [root, third, fifth];
  }

  // Invertido: cada nota en su octava más grave, ordenadas.
  const inverted = [roots[0], thirds[0], fifths[0]].filter(Boolean).sort((a, b) => toMidi(a) - toMidi(b));
  if (inverted.length === 3) return inverted;
  // Registro imposible (menos de una octava): lo que haya, repetido.
  const any = inverted[0] ?? applyKey(key, letters[0], 3);
  return [any, inverted[1] ?? any, inverted[2] ?? any];
}

/** Grados candidatos: I, ii, IV, V y vi (o sus equivalentes menores). */
const DEGREES = [0, 1, 3, 4, 5];

/**
 * El acorde de cada compás, elegido por lo que hace la melodía encima: gana el
 * que más notas del compás tiene como notas suyas, con la primera contando
 * doble. El primero y el último son la tónica, que es lo que hace que la pieza
 * empiece y acabe en su sitio.
 */
function harmonize(key: KeyInfo, bars: { letter: Letter; weight: number }[][]): number[] {
  const out: number[] = [];
  bars.forEach((notes, i) => {
    if (i === 0 || i === bars.length - 1) {
      out.push(0);
      return;
    }
    let best = 0;
    let bestScore = -Infinity;
    for (const degree of DEGREES) {
      const letters = chordLetters(key, degree);
      let score = notes.reduce((sum, n) => sum + n.weight * (letters.includes(n.letter) ? 1 : -0.6), 0);
      // Un empujón para que la armonía se mueva y no se quede en la tónica.
      if (degree === out[i - 1]) score -= 0.4;
      if (i === bars.length - 2 && degree === 4) score += 0.3;
      score += Math.random() * 0.2;
      if (score > bestScore) {
        bestScore = score;
        best = degree;
      }
    }
    out.push(best);
  });
  return out;
}

/** Un compás de la mano izquierda, en EasyScore. */
function leftMeasure(key: KeyInfo, style: LeftStyle, tones: Pitch[], ts: TimeSignature): string {
  const total = measureBeats(ts);
  const note = (p: Pitch) => easyScoreInKey(key, p);
  const keys = (list: Pitch[]) => (list.length === 1 ? note(list[0]) : `(${list.map(note).join(" ")})`);
  const chord = style === "triad" ? tones : style === "fifths" ? [tones[0], tones[2]] : [tones[0]];

  if (style === "broken") {
    const parts: string[] = [];
    for (let pulse = 0; pulse < ts.beats; pulse++) {
      if (ts.subdivision === 3) {
        // Tres corcheas por pulso: el arpegio del compás compuesto.
        for (let i = 0; i < 3; i++) parts.push(easyScorePiece(note(tones[i]), "8"));
      } else {
        const figure = fillBar(ts.beatValue)[0];
        parts.push(easyScorePiece(note(tones[pulse % 3]), figure.vex));
      }
    }
    return parts.join(", ");
  }

  if (style === "half") {
    const halves = fillBar(total / 2);
    // Solo si media parte es una figura limpia; en 9/8 y 3/8 no lo es.
    if (halves.length === 1) {
      return [easyScorePiece(keys([tones[0]]), halves[0].vex), easyScorePiece(keys([tones[2]]), halves[0].vex)].join(", ");
    }
  }

  return fillBar(total)
    .map((figure) => easyScorePiece(keys(chord), figure.vex))
    .join(", ");
}

/**
 * Una melodía que no empieza con una nota que ocupa el compás entero.
 *
 * El generador de ritmo puede sacar una redonda de primer compás, y una
 * lectura que arranca con cuatro tiempos de nada no enseña nada: el primer
 * compás es el que marca el paso. Se vuelve a tirar unas cuantas veces y, si
 * insiste, se acepta lo que haya.
 */
function melodyWithEntrance(
  key: KeyInfo,
  clef: "treble" | "bass",
  ts: TimeSignature,
  bars: number,
  level: RhythmLevel,
  range: [string, string],
) {
  const opts = { range: [parsePitch(range[0]), parsePitch(range[1])] as [Pitch, Pitch], noRests: level < 2 };
  let melody = generateMelody(key, clef, ts, bars, level, opts);
  for (let tries = 0; tries < 5 && melody.measures[0].length < 2; tries++) {
    melody = generateMelody(key, clef, ts, bars, level, opts);
  }
  return melody;
}

let counter = 0;

export interface RandomOptions {
  /** Fuerza la mano de las fórmulas; por defecto sale una al azar. */
  hand?: "right" | "left";
}

/**
 * Una lectura nueva del grado pedido, con la forma de una pieza del cuaderno
 * para que se lea en la misma página.
 */
export function randomBookItem(gradeN: number, kind: BookItemKind, opts: RandomOptions = {}): BookItem {
  const recipe = RECIPES[gradeN] ?? RECIPES[1];
  const tsId = pick(recipe.meters);
  const ts = TIME_SIGNATURE_BY_ID[tsId];
  const keyVex = pick(recipe.keys);
  const key = keyByVex(keyVex);
  const bars = recipe.bars[kind];
  const bpm = tempoFor(ts, recipe.tempo);
  const id = `azar-${gradeN}-${kind}-${++counter}`;
  const meter = `${ts.numerator}/${ts.denominator}`;

  if (kind === "rhythm") {
    const measures = generateRhythm(ts, recipe.rhythm, bars);
    return {
      id,
      kind,
      title: "Ritmo nuevo",
      focus: `Ritmo en ${meter}, ${bars} compases. Palmea con el metrónomo y cuenta en voz alta; si te pierdes, entra otra vez en el compás siguiente.`,
      clef: "treble",
      keyVex: "C",
      tsId,
      bpm,
      top: measures.map((measure) => rhythmToEasyScore(measure)),
    };
  }

  if (kind === "melody") {
    const hand = opts.hand ?? pick(["right", "left"] as const);
    const clef = hand === "right" ? "treble" : "bass";
    const range = hand === "right" ? recipe.treble : recipe.bass;
    const melody = melodyWithEntrance(key, clef, ts, bars, recipe.rhythm, range);
    return {
      id,
      kind,
      title: "Fórmula nueva",
      focus: `Cuatro compases en ${keyName(key)} y ${meter} para la mano ${hand === "right" ? "derecha" : "izquierda"}. Léela dos veces seguidas sin parar entre una y otra.`,
      hand,
      clef,
      keyVex,
      tsId,
      bpm,
      top: melody.easy,
    };
  }

  const melody = melodyWithEntrance(key, "treble", ts, bars, recipe.rhythm, recipe.treble);

  // Las notas de cada compás, con la primera pesando el doble: es la que manda
  // en el acorde.
  const byBar = melody.measures.map((measure) =>
    measure.filter((n) => !n.rest).map((n, i) => ({ letter: n.pitch.letter, weight: i === 0 ? 2 : 1 })),
  );
  const lo = toMidi(parsePitch(recipe.bass[0]));
  // El techo de la izquierda es la nota más grave de la derecha: por encima de
  // ahí las manos se cruzan, y eso no se lee a primera vista.
  const melodyFloor = Math.min(...melody.measures.flat().filter((n) => !n.rest).map((n) => toMidi(n.pitch)));
  const hi = Math.max(lo + 12, Math.min(toMidi(parsePitch(recipe.bass[1])), melodyFloor));
  const style = pick(recipe.left);
  const bottom = harmonize(key, byBar).map((degree) => leftMeasure(key, style, voicing(key, degree, lo, hi), ts));

  return {
    id,
    kind,
    title: "Pieza nueva",
    focus: `Pieza de ${bars} compases en ${keyName(key)} y ${meter}. Míralo veinte segundos, cuenta un compás de espera y léela entera sin volver atrás.`,
    hand: "both",
    clef: "treble",
    keyVex,
    tsId,
    bpm,
    top: melody.easy,
    bottom,
    prep: [
      "¿Cuántas alteraciones tiene la armadura y a qué notas afectan?",
      "¿Cuál es la nota más aguda de la derecha y en qué compás está?",
      "Recorre la izquierda sin tocar: ¿en qué compases cambia de acorde?",
      `Cuenta un compás de espera al tempo que vayas a leer y entra sin frenar.`,
    ],
  };
}
