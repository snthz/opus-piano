/**
 * Primera vista: una melodía que avanza sola y hay que tocar a tiempo.
 *
 * Los demás ejercicios de lectura paran el reloj hasta que contestas, que es
 * justo lo contrario de leer una partitura: ahí el compás sigue, y lo que se
 * entrena es reconocer la nota antes de que llegue. Aquí se genera una pieza
 * corta, se marca el pulso y cada nota tiene su ventana; lo que se responde no
 * es un nombre, es la tecla.
 *
 * Puro: ni audio ni React. El reloj lo pone el componente.
 */

import { easyScorePiece } from "./easyscore";
import { applyKey, keyByVex, type KeyInfo } from "./keys";
import { measureBeats, TIME_SIGNATURE_BY_ID, type TimeSignature } from "./meter";
import { generateMelody } from "./melody";
import { LETTERS, parsePitch, toEasyScore, toMidi, type Pitch } from "./pitch";
import type { RhythmLevel } from "./rhythm";

/** En qué pentagrama está escrita: el de arriba (derecha) o el de abajo (izquierda). */
export type Staff = "top" | "bottom";

export interface SightNote {
  staff: Staff;
  /** Posición dentro de la lista de notas de su pentagrama: lo que `Score` resalta y colorea. */
  index: number;
  midi: number;
  /** Comienzo, en negras desde el principio de la pieza. */
  beat: number;
  /** Duración en negras. */
  beats: number;
}

export interface SightPiece {
  /** Compases del pentagrama de arriba, en EasyScore. */
  top: string[];
  /** Los de abajo, o null si la pieza es de un solo pentagrama. */
  bottom: string[] | null;
  /** Las notas a tocar, en orden de aparición. */
  notes: SightNote[];
  totalBeats: number;
}

export interface SightLevel {
  id: string;
  n: number;
  group: string;
  name: string;
  hint: string;
  color: string;
  /** Clave del pentagrama único, o la de la mano derecha en el sistema doble. */
  clef: "treble" | "bass";
  /** Sistema de dos pentagramas: la izquierda lleva una nota larga por compás. */
  grand: boolean;
  keyVex: string;
  tsId: string;
  bars: number;
  bpm: number;
  rhythm: RhythmLevel;
  /** Registro de la melodía, en notación científica. */
  range: [string, string];
}

const sight = (
  id: string,
  group: string,
  name: string,
  hint: string,
  color: string,
  opts: Omit<SightLevel, "id" | "n" | "group" | "name" | "hint" | "color">,
): Omit<SightLevel, "n"> => ({ id, group, name, hint, color, ...opts });

const DERECHA = "Mano derecha";
const IZQUIERDA = "Mano izquierda";
const DOS = "Las dos manos";

export const SIGHT_LEVELS: SightLevel[] = [
  sight("pv-1", DERECHA, "Posición de do", "Cinco notas, negras y blancas, sin salirte de la posición. Un compás de espera y a tocar.", "bg-mint", {
    clef: "treble", grand: false, keyVex: "C", tsId: "4-4", bars: 2, bpm: 56, rhythm: 1, range: ["C4", "G4"],
  }),
  sight("pv-2", DERECHA, "Hasta el do agudo", "Ahora la mano se abre una octava: de do4 a do5.", "bg-mint", {
    clef: "treble", grand: false, keyVex: "C", tsId: "4-4", bars: 2, bpm: 60, rhythm: 1, range: ["C4", "C5"],
  }),
  sight("pv-3", DERECHA, "El pentagrama entero", "De mi4 a fa5 y en tres por cuatro: el compás también cuenta.", "bg-mint", {
    clef: "treble", grand: false, keyVex: "C", tsId: "3-4", bars: 4, bpm: 66, rhythm: 1, range: ["E4", "F5"],
  }),
  sight("pv-4", DERECHA, "Con corcheas", "Dos notas por pulso. Cuenta «un-y dos-y» por dentro y no mires las manos.", "bg-mint", {
    clef: "treble", grand: false, keyVex: "C", tsId: "4-4", bars: 4, bpm: 66, rhythm: 2, range: ["C4", "C5"],
  }),
  sight("pv-5", DERECHA, "En sol mayor", "Un sostenido en la armadura: todos los fa son fa♯, aunque no lleven nada delante.", "bg-mint", {
    clef: "treble", grand: false, keyVex: "G", tsId: "4-4", bars: 4, bpm: 66, rhythm: 2, range: ["D4", "D5"],
  }),
  sight("pv-6", IZQUIERDA, "Bajando del do central", "Lo mismo en clave de fa, con la mano izquierda: de fa3 a do4.", "bg-blue", {
    clef: "bass", grand: false, keyVex: "C", tsId: "4-4", bars: 2, bpm: 56, rhythm: 1, range: ["F3", "C4"],
  }),
  sight("pv-7", IZQUIERDA, "El pentagrama entero", "De sol2 a la3, en tres por cuatro.", "bg-blue", {
    clef: "bass", grand: false, keyVex: "C", tsId: "3-4", bars: 4, bpm: 63, rhythm: 1, range: ["G2", "A3"],
  }),
  sight("pv-8", IZQUIERDA, "Con corcheas", "La izquierda a dos notas por pulso, que es donde se suele atascar.", "bg-blue", {
    clef: "bass", grand: false, keyVex: "C", tsId: "4-4", bars: 4, bpm: 63, rhythm: 2, range: ["G2", "C4"],
  }),
  sight("pv-9", DOS, "Sistema doble", "Las dos claves a la vez. La izquierda lleva una sola nota larga por compás: la pisas al empezar el compás y la dejas.", "bg-peach", {
    clef: "treble", grand: true, keyVex: "C", tsId: "4-4", bars: 2, bpm: 52, rhythm: 1, range: ["C4", "G4"],
  }),
  sight("pv-10", DOS, "Sistema doble, abierto", "Cuatro compases y la derecha por todo el pentagrama. Lee un compás por delante de donde tocas.", "bg-peach", {
    clef: "treble", grand: true, keyVex: "C", tsId: "4-4", bars: 4, bpm: 56, rhythm: 1, range: ["C4", "C5"],
  }),
].map((l, i) => ({ ...l, n: i + 1 }));

export const SIGHT_LEVEL_BY_ID: Record<string, SightLevel> = Object.fromEntries(SIGHT_LEVELS.map((l) => [l.id, l]));

/** Figura que ocupa un compás entero, en negras. */
function wholeBarDuration(beats: number): string {
  const table: Record<string, string> = { "1": "q", "1.5": "q.", "2": "h", "3": "h.", "4": "w", "6": "w." };
  return table[String(beats)] ?? "w";
}

/** La nota `letter` de la tonalidad en la octava que cae dentro del registro. */
function inRange(key: KeyInfo, letterIndex: number, loMidi: number, hiMidi: number): Pitch {
  const letter = LETTERS[((letterIndex % 7) + 7) % 7];
  let best = applyKey(key, letter, 3);
  for (let octave = 0; octave <= 6; octave++) {
    const p = applyKey(key, letter, octave);
    const m = toMidi(p);
    if (m >= loMidi && m <= hiMidi) return p;
    if (Math.abs(m - (loMidi + hiMidi) / 2) < Math.abs(toMidi(best) - (loMidi + hiMidi) / 2)) best = p;
  }
  return best;
}

/**
 * La mano izquierda del sistema doble: una nota por compás, tónica y dominante
 * alternándose y tónica al final. Larga a propósito: con un dedo en la
 * pantalla no se pueden tocar dos notas a la vez, y una redonda deja tiempo de
 * sobra para pisarla antes de que entre la derecha.
 */
function accompaniment(key: KeyInfo, ts: TimeSignature, bars: number) {
  const beats = measureBeats(ts);
  const vex = wholeBarDuration(beats);
  const tonicIndex = LETTERS.indexOf(key.tonic);
  const easy: string[] = [];
  const pitches: Pitch[] = [];
  for (let i = 0; i < bars; i++) {
    const last = i === bars - 1;
    const degree = last || i % 2 === 0 ? tonicIndex : tonicIndex + 4;
    const p = inRange(key, degree, 40, 55);
    pitches.push(p);
    easy.push(easyScorePiece(toEasyScore(p), vex));
  }
  return { easy, pitches, beats };
}

/** Una pieza nueva para el nivel. Cada llamada da otra distinta. */
export function generateSightPiece(lvl: SightLevel): SightPiece {
  const key = keyByVex(lvl.keyVex);
  const ts = TIME_SIGNATURE_BY_ID[lvl.tsId];
  const melody = generateMelody(key, lvl.clef, ts, lvl.bars, lvl.rhythm, {
    range: [parsePitch(lvl.range[0]), parsePitch(lvl.range[1])],
    noRests: true,
  });

  const notes: SightNote[] = [];
  let beat = 0;
  melody.events.forEach((event, index) => {
    if (event.midis.length) notes.push({ staff: "top", index, midi: event.midis[0], beat, beats: event.beats });
    beat += event.beats;
  });
  const totalBeats = beat;

  let bottom: string[] | null = null;
  if (lvl.grand) {
    const left = accompaniment(key, ts, lvl.bars);
    bottom = left.easy;
    left.pitches.forEach((p, i) => {
      notes.push({ staff: "bottom", index: i, midi: toMidi(p), beat: i * left.beats, beats: left.beats });
    });
  }

  notes.sort((a, b) => a.beat - b.beat || (a.staff === "bottom" ? -1 : 1));
  return { top: melody.easy, bottom, notes, totalBeats };
}

/**
 * Cuánto margen tiene una nota, en segundos. Proporcional a su duración: una
 * redonda de la mano izquierda se puede pisar con calma, una corchea no. Sin
 * esto, el sistema doble sería imposible sin un teclado MIDI.
 */
export function noteTolerance(note: SightNote, beatSec: number): number {
  return Math.max(0.28, Math.min(1.1, beatSec * 0.5 * Math.max(1, note.beats)));
}

export interface SightGrade {
  stars: number;
  passed: boolean;
  /** Porcentaje de notas tocadas a tiempo, 0-100. */
  score: number;
}

/** La nota de una lectura. Las notas de más restan: tocar de sobra no es leer. */
export function gradeSight(hits: number, total: number, extra = 0): SightGrade {
  const penalty = Math.min(hits, extra * 0.5);
  const score = total ? Math.max(0, Math.round(((hits - penalty) / total) * 100)) : 0;
  const stars = score >= 100 ? 3 : score >= 85 ? 2 : score >= 65 ? 1 : 0;
  return { stars, passed: stars > 0, score };
}
