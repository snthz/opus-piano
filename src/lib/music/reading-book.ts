/**
 * El cuaderno de lectura: material graduado para leer a primera vista, por
 * grados, como los cuadernos de papel.
 *
 * Los demás ejercicios de lectura piden una respuesta —el nombre de la nota,
 * la tecla, el golpe a tiempo— y la corrigen. Esto no: es material, y se lee
 * en el piano que uno tenga delante. La pantalla pone el texto, el pulso y el
 * orden; lo demás pasa en las manos, y nadie lo puede comprobar desde aquí.
 *
 * De ahí la forma: nada de puntuaciones. Cada pieza se marca como leída
 * cuando uno la ha leído, y el grado avanza cuando el grado se sostiene.
 *
 * Puro: ni audio ni React. El material está en `src/data/reading-book/`.
 */

import { parseEasyScore } from "./easyscore";
import { measureBeats, type TimeSignature } from "./meter";

export type BookItemKind = "rhythm" | "melody" | "piece";

/** Qué mano lee. «Las dos» es el sistema doble. */
export type BookHand = "right" | "left" | "both";

export const KIND_LABEL: Record<BookItemKind, string> = {
  rhythm: "Ritmo",
  melody: "Fórmula",
  piece: "Pieza",
};

export const KIND_HINT: Record<BookItemKind, string> = {
  rhythm: "Palmea o golpea el ritmo con el metrónomo, sin tocar el piano.",
  melody: "Una fórmula corta para leer y repetir hasta que salga sin pensar.",
  piece: "Léela entera, de principio a fin, sin parar a corregir.",
};

export const HAND_LABEL: Record<BookHand, string> = {
  right: "Mano derecha",
  left: "Mano izquierda",
  both: "Las dos manos",
};

export interface BookItem {
  id: string;
  kind: BookItemKind;
  title: string;
  /** En qué fijarse antes de empezar; una o dos frases. */
  focus: string;
  /** Qué mano lee; los ejercicios de ritmo van a palmas y no llevan ninguna. */
  hand?: BookHand;
  /** Clave del pentagrama único, o la de la mano derecha en el sistema doble. */
  clef: "treble" | "bass";
  keyVex: string;
  tsId: string;
  /** Tempo sugerido: el de la primera lectura y el objetivo. */
  bpm: [number, number];
  /** Compases del pentagrama de arriba, en EasyScore. */
  top: string[];
  /** Los de abajo; con ellos, la pieza es de sistema doble. */
  bottom?: string[];
  /** Dónde van las manos antes de empezar. */
  position?: string;
  /** Preguntas que se contestan antes de tocar. Con ellas, la pieza es «preparada». */
  prep?: string[];
  /** Ligaduras de prolongación entre índices de figura del pentagrama de arriba. */
  ties?: [number, number][];
  bassTies?: [number, number][];
  /** Ligaduras de expresión, entre índices de figura. */
  slurs?: [number, number][];
}

export interface BookStage {
  n: number;
  title: string;
  /** Lo que añade esta etapa respecto a la anterior. */
  goal: string;
  items: BookItem[];
}

export interface BookGrade {
  n: number;
  title: string;
  subtitle: string;
  color: string;
  /** El temario del grado: lo que entra y lo que todavía no. */
  scope: {
    keys: string;
    meters: string;
    figures: string;
    range: string;
    texture: string;
  };
  /** Cuándo se puede pasar al siguiente. */
  ready: string;
  stages: BookStage[];
}

export const gradeItems = (grade: BookGrade): BookItem[] => grade.stages.flatMap((s) => s.items);

/** Las piezas con preguntas de preparación. */
export const isPrepared = (item: BookItem): boolean => !!item.prep?.length;

/** Cuántas figuras hay en un pentagrama, silencios incluidos: el tope de los índices de las ligaduras. */
export function figureCount(measures: string[]): number {
  return measures.reduce((sum, measure) => sum + parseEasyScore(measure).length, 0);
}

/**
 * Los compases repartidos en sistemas para dibujarlos. `Score` pinta todos los
 * compases en una sola línea, y ocho en una línea no se leen: en el cuaderno
 * hay que ver las figuras, no adivinarlas.
 */
export function systems(measures: string[], perSystem = 4): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < measures.length; i += perSystem) out.push(measures.slice(i, i + perSystem));
  return out;
}

/** Cuántos compases caben por línea: los compases largos (9/8, 12/8) van de dos en dos. */
export function measuresPerSystem(ts: TimeSignature): number {
  return measureBeats(ts) > 4 ? 2 : 4;
}

export interface BookSystem {
  measures: string[];
  bass?: string[];
  /** Índices relativos al sistema, que es lo que `Score` numera. */
  ties?: [number, number][];
  bassTies?: [number, number][];
  slurs?: [number, number][];
  first: boolean;
  last: boolean;
}

/** Los tramos que caen enteros dentro del sistema, renumerados desde su primera figura. */
function within(spans: [number, number][] | undefined, from: number, to: number): [number, number][] | undefined {
  const out = (spans ?? [])
    .filter(([a, b]) => a >= from && b < to)
    .map(([a, b]) => [a - from, b - from] as [number, number]);
  return out.length ? out : undefined;
}

/**
 * La pieza repartida en líneas, con las ligaduras renumeradas para cada una.
 *
 * `Score` numera las figuras desde cero en cada dibujo, así que una ligadura
 * escrita sobre la pieza entera apunta a otra nota en cuanto la pieza se parte.
 * Las que cruzan de una línea a la siguiente se quedan fuera: VexFlow no puede
 * dibujar una curva entre dos dibujos distintos, y una ligadura mal puesta
 * engaña más que una que falta. El material está escrito para que no pase
 * ninguna, y hay una prueba que lo vigila.
 */
export function layoutItem(item: BookItem, perSystem: number): BookSystem[] {
  const top = systems(item.top, perSystem);
  const bottom = item.bottom ? systems(item.bottom, perSystem) : null;
  let topSeen = 0;
  let bassSeen = 0;
  return top.map((measures, i) => {
    const topEnd = topSeen + figureCount(measures);
    const bass = bottom?.[i];
    const bassEnd = bassSeen + (bass ? figureCount(bass) : 0);
    const system: BookSystem = {
      measures,
      bass,
      ties: within(item.ties, topSeen, topEnd),
      slurs: within(item.slurs, topSeen, topEnd),
      bassTies: within(item.bassTies, bassSeen, bassEnd),
      first: i === 0,
      last: i === top.length - 1,
    };
    topSeen = topEnd;
    bassSeen = bassEnd;
    return system;
  });
}
