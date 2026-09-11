/**
 * Lo que suena, compás a compás. Lo que más importa aquí es que los dos
 * pentagramas de un piano vayan a la vez: la fuente puede venir con un compás
 * mal medido —una transcripción automática los trae a puñados— y eso no puede
 * hacer que una mano se adelante a la otra para el resto de la pieza.
 */
import { describe, expect, test } from "bun:test";
import { buildTimeline, measureOffsets, type ParsedScore, type XmlMeasure } from "@/lib/music/musicxml";
import { parseStaffCode } from "@/lib/music/musicxml-build";

/** Una partitura de piano: cada compás son dos líneas, mano derecha e izquierda. */
const piano = (measures: [string, string][], time = { num: 4, den: 4 }): ParsedScore => ({
  title: "",
  keyVex: "C",
  time,
  tempo: 0,
  clefs: ["treble", "bass"],
  measures: measures.map<XmlMeasure>(([right, left], i) => ({
    number: String(i + 1),
    staves: [parseStaffCode(right), parseStaffCode(left)],
  })),
});

/** Los momentos en que entra cada mano, en negras desde el principio. */
const entries = (score: ParsedScore, staff: number) =>
  buildTimeline(score)
    .filter((n) => n.refs.some((r) => r.staff === staff))
    .map((n) => n.start);

describe("línea de tiempo de las dos manos", () => {
  test("con los compases bien medidos, las dos manos entran juntas", () => {
    const s = piano([
      ["C4/w", "C3/w"],
      ["D4/w", "D3/w"],
      ["E4/w", "E3/w"],
    ]);
    expect(entries(s, 0)).toEqual([0, 4, 8]);
    expect(entries(s, 1)).toEqual([0, 4, 8]);
  });

  test("un compás corto en una mano no la adelanta en los siguientes", () => {
    // Al compás 2 de la mano izquierda le falta una negra: es el fallo típico
    // de una transcripción automática. Antes, esa mano se comía la diferencia y
    // seguía adelantada hasta el final; ahora el compás 3 vuelve a empezar a la
    // vez en las dos.
    const s = piano([
      ["C4/w", "C3/w"],
      ["D4/w", "D3/q D3/q D3/q"],
      ["E4/w", "E3/w"],
    ]);
    expect(entries(s, 0)).toEqual([0, 4, 8]);
    expect(entries(s, 1)).toEqual([0, 4, 5, 6, 8]);
  });

  test("un compás largo en una mano tampoco retrasa a la otra", () => {
    const s = piano([
      ["C4/w", "C3/w"],
      ["D4/w D4/q", "D3/w"],
      ["E4/w", "E3/w"],
    ]);
    // El compás 2 dura lo que el pentagrama más largo, cinco negras: la mano
    // derecha mete ahí sus dos notas (4 y 8) y el compás 3 arranca en el 9
    // para las dos manos.
    expect(entries(s, 0)).toEqual([0, 4, 8, 9]);
    expect(entries(s, 1)).toEqual([0, 4, 9]);
  });

  test("la anacrusa sigue valiendo: el primer compás dura lo que ocupa", () => {
    const s = piano([
      ["C4/q", "C3/q"],
      ["D4/w", "D3/w"],
    ]);
    expect(entries(s, 0)).toEqual([0, 1]);
    expect(entries(s, 1)).toEqual([0, 1]);
  });

  test("un compás en silencio en una mano no descoloca a la otra", () => {
    const s = piano([
      ["C4/w", "-"],
      ["D4/w", "D3/w"],
    ]);
    expect(entries(s, 0)).toEqual([0, 4]);
    expect(entries(s, 1)).toEqual([4]);
  });
});

describe("ensayar un trozo", () => {
  const four = piano([
    ["C4/w", "C3/w"],
    ["D4/w", "D3/w"],
    ["E4/w", "E3/w"],
    ["F4/w", "F3/w"],
  ]);

  test("solo suenan los compases pedidos, y empezando por cero", () => {
    const notes = buildTimeline(four, { range: { from: 2, to: 3 } });
    expect(notes.map((n) => n.start)).toEqual([0, 0, 4, 4]);
    expect(notes.every((n) => n.midis.length === 1)).toBe(true);
    // re y mi, las dos manos: nada del compás 1 ni del 4
    expect([...new Set(notes.flatMap((n) => n.midis))].sort((a, b) => a - b)).toEqual([50, 52, 62, 64]);
  });

  test("un compás suelto vale, y los límites se recortan a la pieza", () => {
    expect(buildTimeline(four, { range: { from: 3, to: 3 } })).toHaveLength(2);
    expect(buildTimeline(four, { range: { from: 3, to: 99 } })).toHaveLength(4);
    expect(buildTimeline(four, { range: { from: 0, to: 1 } })).toHaveLength(2);
    // al revés se entiende igual
    expect(buildTimeline(four, { range: { from: 9, to: 2 } })).toHaveLength(2);
  });

  test("la mano callada se sigue viendo y contando: solo no suena", () => {
    const notes = buildTimeline(four, { silentStaves: [1] });
    const left = notes.filter((n) => n.refs[0].staff === 1);
    expect(left).toHaveLength(4);
    expect(left.every((n) => n.silent)).toBe(true);
    expect(notes.filter((n) => n.refs[0].staff === 0).every((n) => !n.silent)).toBe(true);
  });

  test("measureOffsets dice por qué negra empieza cada compás impreso", () => {
    expect(measureOffsets(four)).toEqual([0, 4, 8, 12]);
    // con anacrusa, el primer compás dura lo que ocupa
    expect(measureOffsets(piano([["C4/q", "C3/q"], ["D4/w", "D3/w"]]))).toEqual([0, 1]);
  });
});
