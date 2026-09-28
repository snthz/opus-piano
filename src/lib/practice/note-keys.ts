"use client";

import { useEffect, useRef } from "react";
import { LETTERS, isBlackKey, type Letter } from "@/lib/music/pitch";

/**
 * Responder con el teclado del ordenador.
 *
 * Los ejercicios de lectura se hacen a contrarreloj, y llevar el ratón hasta
 * el botón cuesta más que reconocer la nota: con el teclado, la respuesta es
 * un dedo que ya está puesto. Hay dos formas de decir la misma nota —los
 * números 1-7 en el orden de la escala y las letras del cifrado— porque el
 * ejercicio se juega en los dos sistemas.
 */

/** 1-7 → do re mi fa sol la si; C-B → su propia letra. */
export function letterFromKey(key: string): Letter | null {
  if (key.length === 1 && key >= "1" && key <= "7") return LETTERS[Number(key) - 1];
  const upper = key.toUpperCase();
  return key.length === 1 && (LETTERS as string[]).includes(upper) ? (upper as Letter) : null;
}

/** Alteración: ↓ o «-» bemol, ↑ o «+» sostenido, 0 o «8» natural. */
export function accidentalFromKey(key: string): number | null {
  if (key === "-" || key === "ArrowDown") return -1;
  if (key === "+" || key === "#" || key === "ArrowUp") return 1;
  if (key === "0" || key === "8") return 0;
  return null;
}

/** Los eventos de teclado que no son para el ejercicio (está escribiendo en otro sitio). */
function fromField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function useNoteKeyboard({
  enabled,
  onLetter,
  onAccidental,
}: {
  enabled: boolean;
  onLetter: (letter: Letter) => void;
  onAccidental?: (accidental: number) => void;
}) {
  const handlers = useRef({ onLetter, onAccidental });
  useEffect(() => {
    handlers.current = { onLetter, onAccidental };
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || fromField(e.target)) return;
      const { onLetter: letterHandler, onAccidental: accidentalHandler } = handlers.current;
      if (accidentalHandler) {
        const accidental = accidentalFromKey(e.key);
        if (accidental !== null) {
          e.preventDefault();
          accidentalHandler(accidental);
          return;
        }
      }
      const letter = letterFromKey(e.key);
      if (letter) {
        e.preventDefault();
        letterHandler(letter);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

/* ---- Tocar en el teclado del ordenador (primera vista) ---- */

/**
 * Dos filas, una por mano: la de casa para la derecha y la de abajo para la
 * izquierda, igual que están las manos en el piano. La de abajo va solo con
 * blancas: sus negras caerían en teclas que ya usa la otra fila, y en un
 * acompañamiento de notas largas no hacen falta.
 */
const ROWS: Record<"home" | "low", { whites: string[]; blacks: [string, number][] }> = {
  home: {
    whites: ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ", ";"],
    // La negra y sobre qué blanca se apoya, como en el teclado de verdad.
    blacks: [
      ["w", 0],
      ["e", 1],
      ["t", 3],
      ["y", 4],
      ["u", 5],
      ["o", 7],
      ["p", 8],
    ],
  },
  low: {
    whites: ["z", "x", "c", "v", "b", "n", "m", ",", ".", "-"],
    blacks: [],
  },
};

/**
 * Qué nota toca cada tecla del ordenador, empezando por la primera blanca a
 * partir de `from`. Es la distribución de los pianos virtuales de siempre,
 * calculada sobre las blancas reales: así sigue valiendo aunque el registro no
 * empiece en do.
 */
export function computerKeyMap(from: number, to: number, row: "home" | "low" = "home"): Record<string, number> {
  const { whites: keys, blacks } = ROWS[row];
  let start = from;
  while (isBlackKey(start)) start--;
  const whites: number[] = [];
  for (let m = start; m <= to && whites.length < keys.length; m++) {
    if (!isBlackKey(m)) whites.push(m);
  }
  const map: Record<string, number> = {};
  whites.forEach((midi, i) => {
    map[keys[i]] = midi;
  });
  for (const [key, white] of blacks) {
    const base = whites[white];
    if (base !== undefined && isBlackKey(base + 1) && base + 1 <= to) map[key] = base + 1;
  }
  return map;
}

/** El mapa del revés: qué tecla del ordenador lleva a cada nota, para escribirlo en el piano dibujado. */
export function keyHints(map: Record<string, number>): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [key, midi] of Object.entries(map)) out[midi] = key === "," ? "," : key === "." ? "." : key.toUpperCase();
  return out;
}

export function usePianoKeyboardKeys({
  enabled,
  map,
  onPress,
}: {
  enabled: boolean;
  map: Record<string, number>;
  onPress: (midi: number, timeStamp: number) => void;
}) {
  const handler = useRef(onPress);
  const table = useRef(map);
  useEffect(() => {
    handler.current = onPress;
    table.current = map;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || fromField(e.target)) return;
      const midi = table.current[e.key.toLowerCase()];
      if (midi === undefined) return;
      e.preventDefault();
      handler.current(midi, e.timeStamp);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
