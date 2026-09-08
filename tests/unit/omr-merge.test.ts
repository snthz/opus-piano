/**
 * El reconocimiento devuelve una página cada vez y cada MusicXML viene con su
 * propia cabecera, así que lo que hay que probar es el pegado: numeración
 * seguida, la cabecera de la primera página mandando sobre las demás y los
 * avisos de lo que no cuadra. Nada de esto necesita al servicio ni a oemer.
 */
import { describe, expect, test } from "bun:test";
import { parseStaffCode } from "@/lib/music/musicxml-build";
import { mergePages } from "@/lib/omr/merge";
import type { ParsedScore } from "@/lib/music/musicxml";

/** Una página tal como sale de `parseMusicXml` con lo que devuelve el servicio. */
function page(lines: string[][], extra: Partial<ParsedScore> = {}): ParsedScore {
  return {
    title: "Page",
    keyVex: "C",
    time: { num: 4, den: 4 },
    tempo: 0,
    clefs: ["treble", "bass"],
    measures: lines.map((staves, i) => ({ number: String(i + 1), staves: staves.map(parseStaffCode) })),
    ...extra,
  };
}

const FULL = ["C4/w", "C3/w"];

describe("pegado de páginas del OMR", () => {
  test("los compases se numeran de corrido entre páginas", () => {
    const { score } = mergePages([page([FULL, FULL]), page([FULL, FULL, FULL])]);
    expect(score.measures.map((m) => m.number)).toEqual(["1", "2", "3", "4", "5"]);
  });

  test("el nombre de la partitura sustituye al título que inventa el reconocedor", () => {
    const { score } = mergePages([page([FULL])], { title: "Preludio en Do" });
    expect(score.title).toBe("Preludio en Do");
  });

  test("manda la cabecera de la primera página y el cambio se avisa", () => {
    const { score, warnings } = mergePages([
      page([FULL], { keyVex: "G", time: { num: 3, den: 4 } }),
      page([["C4/h."], ["C3/h."]], { keyVex: "D", time: { num: 3, den: 4 } }),
    ]);
    expect(score.keyVex).toBe("G");
    expect(warnings.some((w) => w.includes("Página 2") && w.includes("armadura"))).toBe(true);
  });

  test("un cambio de compás entre páginas también se avisa", () => {
    const { score, warnings } = mergePages([page([FULL]), page([["C4/h."], ["C3/h."]], { time: { num: 3, den: 4 } })]);
    expect(score.time).toEqual({ num: 4, den: 4 });
    expect(warnings.some((w) => w.includes("3/4") && w.includes("4/4"))).toBe(true);
  });

  test("una página sin compases no tira abajo el resto", () => {
    const { score, warnings } = mergePages([page([FULL, FULL]), page([]), page([FULL])]);
    expect(score.measures).toHaveLength(3);
    expect(warnings.some((w) => w.includes("Página 2") && w.includes("ningún compás"))).toBe(true);
  });

  test("los avisos dicen el número de página real, no el orden", () => {
    const { warnings } = mergePages([page([FULL]), page([])], { pageNumbers: [4, 5] });
    expect(warnings.some((w) => w.startsWith("Página 5"))).toBe(true);
  });

  test("los compases que no suman salen como avisos, ya con su número nuevo", () => {
    // Al segundo compás de la segunda página —el cuarto de la pieza— le falta
    // una negra. El aviso tiene que hablar del 4, que es el que verá quien lo
    // revise, y no del 2 de su página.
    const { warnings } = mergePages([page([FULL, FULL]), page([FULL, ["C4/q C4/q C4/q", "C3/w"], FULL])]);
    expect(warnings.some((w) => w.includes("Compás 4, pentagrama 1") && w.includes("dura 3 en vez de 4"))).toBe(true);
  });

  test("sin páginas o sin compases no hay partitura que montar", () => {
    expect(() => mergePages([])).toThrow();
    expect(() => mergePages([page([]), page([])])).toThrow();
  });
});
