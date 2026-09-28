/**
 * Cómo se llama una nota en los ejercicios de lectura.
 *
 * Hay dos sistemas y los dos hacen falta: «do re mi» es con el que se lee y
 * se canta en español, y el cifrado americano «C D E» es el que traen los
 * acordes, los métodos y casi todo lo que hay en internet. El ajuste `naming`
 * elige el principal; `dualNames` añade el otro en pequeño, que es como se
 * aprende el segundo sin dejar de leer con el primero.
 */

import { ACCIDENTAL_SYMBOL, LATIN_NAMES, type Letter, type NamingSystem, type Pitch } from "@/lib/music/pitch";

export interface NoteLabel {
  /** El nombre en el sistema principal. */
  main: string;
  /** El otro sistema, o null si no se muestran los dos. */
  alt: string | null;
}

export interface NamingPrefs {
  naming: NamingSystem;
  dualNames: boolean;
}

function inSystem(letter: Letter, accidental: number, system: NamingSystem, octave?: number): string {
  const base = system === "latino" ? LATIN_NAMES[letter] : letter;
  return `${base}${ACCIDENTAL_SYMBOL[accidental] ?? ""}${octave === undefined ? "" : octave}`;
}

/** Etiqueta de una letra con su alteración (sin octava): lo que va en los botones. */
export function letterLabel(letter: Letter, accidental: number, { naming, dualNames }: NamingPrefs): NoteLabel {
  const other: NamingSystem = naming === "latino" ? "anglosajon" : "latino";
  return {
    main: inSystem(letter, accidental, naming),
    alt: dualNames ? inSystem(letter, accidental, other) : null,
  };
}

/** Igual, para una nota concreta; con `octave`, en notación científica ("do♯4"). */
export function pitchLabel(p: Pitch, prefs: NamingPrefs, octave = false): NoteLabel {
  const other: NamingSystem = prefs.naming === "latino" ? "anglosajon" : "latino";
  const oct = octave ? p.octave : undefined;
  return {
    main: inSystem(p.letter, p.accidental, prefs.naming, oct),
    alt: prefs.dualNames ? inSystem(p.letter, p.accidental, other, oct) : null,
  };
}

/** Una sola cadena para los mensajes: "do♯4 (C♯4)". */
export function pitchText(p: Pitch, prefs: NamingPrefs, octave = true): string {
  const { main, alt } = pitchLabel(p, prefs, octave);
  return alt ? `${main} (${alt})` : main;
}
