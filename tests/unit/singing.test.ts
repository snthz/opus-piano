import { describe, expect, test } from "bun:test";
import { expectedNotes, gradeSinging, pitchClassDistance, type PitchSample } from "@/lib/practice/singing";

const BEAT = 0.5; // ♩ = 120

/** Cuatro negras: do, re, mi, silencio. */
const EVENTS = [{ midis: [60], beats: 1 }, { midis: [62], beats: 1 }, { midis: [64], beats: 1 }, { midis: [], beats: 1 }];

/** Muestras densas de una nota mantenida durante toda su duración. */
function sung(note: { start: number; end: number }, midi: number, every = 0.025): PitchSample[] {
  const out: PitchSample[] = [];
  for (let at = note.start; at <= note.end; at += every) out.push({ at, midi });
  return out;
}

describe("expectedNotes", () => {
  const notes = expectedNotes(EVENTS, 10, BEAT);

  test("los silencios no se cantan, pero ocupan su tiempo", () => {
    expect(notes).toHaveLength(3);
    expect(notes.map((n) => n.index)).toEqual([0, 1, 2]);
  });

  test("cada nota empieza donde acaba la anterior", () => {
    expect(notes[0].start).toBe(10);
    expect(notes[0].end).toBe(10.5);
    expect(notes[2].start).toBe(11);
  });
});

describe("pitchClassDistance", () => {
  test("la octava no cuenta", () => {
    expect(pitchClassDistance(48, 60)).toBe(0);
    expect(pitchClassDistance(72, 60)).toBe(0);
  });

  test("mide por el camino corto y con signo", () => {
    expect(pitchClassDistance(61, 60)).toBe(1);
    expect(pitchClassDistance(59, 60)).toBe(-1);
    // si en vez de si bemol, no once semitonos hacia arriba
    expect(pitchClassDistance(71, 60)).toBe(-1);
  });
});

describe("gradeSinging", () => {
  const notes = expectedNotes(EVENTS, 0, BEAT);

  test("cantado bien, todo correcto", () => {
    const samples = notes.flatMap((n) => sung(n, n.midi));
    const result = gradeSinging(notes, samples);
    expect(result.correct).toBe(3);
    expect(result.score).toBe(100);
    expect(result.notes.every((n) => n.correct)).toBe(true);
  });

  test("cantado una octava abajo también es correcto", () => {
    const samples = notes.flatMap((n) => sung(n, n.midi - 12));
    expect(gradeSinging(notes, samples).score).toBe(100);
  });

  test("una nota desafinada se señala, y se dice cuánto", () => {
    const samples = [...sung(notes[0], 60), ...sung(notes[1], 63), ...sung(notes[2], 64)];
    const result = gradeSinging(notes, samples);
    expect(result.correct).toBe(2);
    expect(result.notes[1].correct).toBe(false);
    expect(result.notes[1].cents).toBe(100);
    expect(result.notes[1].index).toBe(1);
  });

  test("medio tono largo pasa; un semitono entero, no", () => {
    const almost = gradeSinging(notes, sung(notes[0], 60.5)).notes[0];
    expect(almost.correct).toBe(true);
    const off = gradeSinging(notes, sung(notes[0], 61)).notes[0];
    expect(off.correct).toBe(false);
  });

  test("lo que no se oye no es correcto, pero se distingue de lo desafinado", () => {
    const result = gradeSinging(notes, sung(notes[0], 60));
    expect(result.notes[0].heard).not.toBeNull();
    expect(result.notes[1].heard).toBeNull();
    expect(result.notes[1].cents).toBeNull();
    expect(result.notes[1].correct).toBe(false);
    expect(result.score).toBe(33);
  });

  test("el ataque y el final no cuentan: solo el centro de la nota", () => {
    // Entra deslizando desde un tono por debajo y sale cayendo: en medio, bien.
    const slide = [
      { at: notes[0].start + 0.01, midi: 58 },
      { at: notes[0].start + 0.05, midi: 59 },
      ...sung({ start: notes[0].start + 0.2, end: notes[0].end - 0.06 }, 60),
      { at: notes[0].end - 0.01, midi: 57 },
    ];
    expect(gradeSinging(notes, slide).notes[0].correct).toBe(true);
  });

  test("una lectura suelta y disparatada no arrastra la nota (mediana, no media)", () => {
    const samples = [...sung(notes[0], 60), { at: notes[0].start + 0.25, midi: 90 }];
    expect(gradeSinging(notes, samples).notes[0].correct).toBe(true);
  });

  test("sin notas que cantar, no hay nota", () => {
    expect(gradeSinging([], []).score).toBe(0);
  });
});
