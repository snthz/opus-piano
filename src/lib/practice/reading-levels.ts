/**
 * Los niveles de «Leer notas».
 *
 * El ejercicio era una cola infinita de preguntas con tres ajustes: se podía
 * practicar durante meses sin saber si se avanzaba. Aquí la lectura está
 * partida en niveles cortos —una tanda de preguntas cada uno— que van de las
 * cinco notas de la posición de do a las dos claves con alteraciones, y cada
 * nivel abre el siguiente.
 *
 * Puro a propósito (ni almacenamiento ni reloj): lo que se guarda vive en
 * `level-progress.ts` y lo que se dibuja, en los componentes.
 */

import { diatonicIndex, fromDiatonicIndex, parsePitch, toEasyScore, type Pitch } from "@/lib/music/pitch";

export type Clef = "treble" | "bass";

export interface ReadingQuestion {
  clef: Clef;
  pitch: Pitch;
}

/** De dónde salen las notas de un nivel: una lista cerrada o un rango diatónico. */
export interface LevelSpec {
  clef: Clef;
  /** Notas concretas ("E4", "G4"…). Tiene prioridad sobre el rango. */
  notes?: string[];
  /** Rango inclusivo, en notación científica. */
  from?: string;
  to?: string;
}

export interface ReadingLevel {
  id: string;
  /** Orden, 1 en adelante. Un nivel se abre al aprobar el anterior. */
  n: number;
  /** Bloque al que pertenece; agrupa el mapa de niveles. */
  group: string;
  name: string;
  /** Qué enseña el nivel. Se lee antes de empezarlo. */
  hint: string;
  /** Segundos por respuesta. */
  seconds: number;
  accidentals: boolean;
  /** Clase pastel de la tarjeta. */
  color: string;
  spec: LevelSpec[];
}

/** Preguntas por tanda. */
export const ROUND_LENGTH = 12;

const level = (
  id: string,
  group: string,
  name: string,
  hint: string,
  seconds: number,
  color: string,
  spec: LevelSpec[],
  accidentals = false,
): Omit<ReadingLevel, "n"> => ({ id, group, name, hint, seconds, color, spec, accidentals });

const SOL = "Clave de sol";
const FA = "Clave de fa";
const MIX = "Las dos claves";

export const READING_LEVELS: ReadingLevel[] = [
  level(
    "sol-1",
    SOL,
    "El do central",
    "Las cinco primeras notas de la mano derecha: do, re, mi, fa y sol, desde el do central.",
    10,
    "bg-mint",
    [{ clef: "treble", from: "C4", to: "G4" }],
  ),
  level(
    "sol-2",
    SOL,
    "Las líneas",
    "Mi, sol, si, re, fa: las cinco notas que se escriben sobre una línea, de abajo arriba.",
    9,
    "bg-mint",
    [{ clef: "treble", notes: ["E4", "G4", "B4", "D5", "F5"] }],
  ),
  level(
    "sol-3",
    SOL,
    "Los espacios",
    "Fa, la, do, mi: los cuatro espacios. Leídos seguidos suenan al revés que las líneas.",
    9,
    "bg-mint",
    [{ clef: "treble", notes: ["F4", "A4", "C5", "E5"] }],
  ),
  level(
    "sol-4",
    SOL,
    "El pentagrama entero",
    "Líneas y espacios mezclados, de mi4 a fa5. Ya no vale contar: hay que reconocer.",
    8,
    "bg-mint",
    [{ clef: "treble", from: "E4", to: "F5" }],
  ),
  level(
    "sol-5",
    SOL,
    "Líneas adicionales",
    "Lo que se sale del pentagrama, de la3 a do6. El do central vive justo debajo.",
    8,
    "bg-mint",
    [{ clef: "treble", from: "A3", to: "C6" }],
  ),
  level(
    "fa-1",
    FA,
    "Bajando del do central",
    "Las cinco notas que la mano izquierda tiene bajo el do central: fa, sol, la, si, do.",
    10,
    "bg-blue",
    [{ clef: "bass", from: "F3", to: "C4" }],
  ),
  level(
    "fa-2",
    FA,
    "Las líneas",
    "Sol, si, re, fa, la: las cinco líneas en clave de fa. No son las mismas que en sol.",
    9,
    "bg-blue",
    [{ clef: "bass", notes: ["G2", "B2", "D3", "F3", "A3"] }],
  ),
  level(
    "fa-3",
    FA,
    "Los espacios",
    "La, do, mi, sol: los cuatro espacios en clave de fa.",
    9,
    "bg-blue",
    [{ clef: "bass", notes: ["A2", "C3", "E3", "G3"] }],
  ),
  level(
    "fa-4",
    FA,
    "El pentagrama entero",
    "De sol2 a la3, líneas y espacios mezclados.",
    8,
    "bg-blue",
    [{ clef: "bass", from: "G2", to: "A3" }],
  ),
  level(
    "fa-5",
    FA,
    "Líneas adicionales",
    "De do2 a mi4. Arriba aparece otra vez el do central, ahora por encima del pentagrama.",
    8,
    "bg-blue",
    [{ clef: "bass", from: "C2", to: "E4" }],
  ),
  level(
    "mix-1",
    MIX,
    "Sol y fa mezcladas",
    "La clave cambia en cada pregunta. Míralas en este orden: primero la clave, después la nota.",
    7,
    "bg-peach",
    [
      { clef: "treble", from: "E4", to: "F5" },
      { clef: "bass", from: "G2", to: "A3" },
    ],
  ),
  level(
    "mix-2",
    MIX,
    "Con alteraciones",
    "Sostenidos y bemoles: elige la nota y, además, su alteración.",
    9,
    "bg-peach",
    [
      { clef: "treble", from: "E4", to: "F5" },
      { clef: "bass", from: "G2", to: "A3" },
    ],
    true,
  ),
  level(
    "mix-3",
    MIX,
    "Todo el teclado",
    "Las dos claves, con líneas adicionales y alteraciones. El examen final de lectura.",
    9,
    "bg-peach",
    [
      { clef: "treble", from: "A3", to: "C6" },
      { clef: "bass", from: "C2", to: "E4" },
    ],
    true,
  ),
].map((l, i) => ({ ...l, n: i + 1 }));

export const LEVEL_BY_ID: Record<string, ReadingLevel> = Object.fromEntries(READING_LEVELS.map((l) => [l.id, l]));

/** Los bloques del mapa, en orden, con sus niveles. */
export function levelGroups(levels: ReadingLevel[] = READING_LEVELS): { group: string; levels: ReadingLevel[] }[] {
  const out: { group: string; levels: ReadingLevel[] }[] = [];
  for (const l of levels) {
    const last = out[out.length - 1];
    if (last && last.group === l.group) last.levels.push(l);
    else out.push({ group: l.group, levels: [l] });
  }
  return out;
}

/** Cada nota lleva su propia ficha: el fa en clave de fa no es el fa en clave de sol. */
export const questionKey = (q: ReadingQuestion) => `${q.clef}|${toEasyScore(q.pitch)}`;

function expand(spec: LevelSpec): Pitch[] {
  if (spec.notes) return spec.notes.map(parsePitch);
  const lo = diatonicIndex(parsePitch(spec.from ?? "C4"));
  const hi = diatonicIndex(parsePitch(spec.to ?? "C5"));
  const out: Pitch[] = [];
  for (let i = lo; i <= hi; i++) out.push(fromDiatonicIndex(i));
  return out;
}

/** Todas las notas que un nivel puede preguntar. */
export function buildLevelPool(lvl: ReadingLevel): ReadingQuestion[] {
  const pool: ReadingQuestion[] = [];
  for (const spec of lvl.spec) {
    for (const pitch of expand(spec)) {
      pool.push({ clef: spec.clef, pitch });
      if (lvl.accidentals) {
        // Los extremos del rango con alteración se salen de la escritura
        // normal (si♯ y do♭ existen, pero no se escriben así casi nunca).
        for (const accidental of [1, -1]) pool.push({ clef: spec.clef, pitch: { ...pitch, accidental } });
      }
    }
  }
  return pool;
}

export interface RoundGrade {
  /** 0 = no aprobado, 1-3 estrellas. */
  stars: number;
  passed: boolean;
  /** Porcentaje de aciertos, 0-100. */
  score: number;
}

/**
 * La nota de una tanda. Tres estrellas piden pleno y, además, velocidad: con
 * el límite de tiempo de cada nivel de por medio, responder bien pero al
 * borde del segundero no es leer, es contar líneas.
 */
export function gradeRound(correct: number, total: number, avgMs: number, limitMs: number): RoundGrade {
  if (total <= 0) return { stars: 0, passed: false, score: 0 };
  const misses = total - correct;
  const score = total ? Math.round((correct / total) * 100) : 0;
  const fast = limitMs > 0 && avgMs <= limitMs * 0.5;
  const stars = misses === 0 && fast ? 3 : misses <= 1 ? 2 : misses <= 3 ? 1 : 0;
  return { stars, passed: stars > 0, score };
}
