import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { CATALOG, piecesByLevel } from "@/data/catalog";

/**
 * Cada pieza del catálogo es un .mxl de una biblioteca de dominio público:
 * que exista, se abra y sea un MusicXML partwise para piano con los compases
 * que dice la ficha. Las alturas hay que escucharlas; esto atrapa lo demás.
 *
 * El MusicXML se revisa como texto y no con `parseMusicXml` porque ese lee
 * con `DOMParser`, que en el runner de bun no existe (igual que en
 * `omr-merge.test.ts`).
 */

describe("catálogo de dominio público", () => {
  test("hay piezas y todas tienen id único", () => {
    expect(CATALOG.length).toBeGreaterThan(10);
    expect(new Set(CATALOG.map((p) => p.id)).size).toBe(CATALOG.length);
  });

  test("cada pieza trae un análisis de verdad, no un hueco", () => {
    for (const piece of CATALOG) {
      expect(piece.analysis.summary.length).toBeGreaterThan(80);
      expect(piece.analysis.approach.length).toBeGreaterThanOrEqual(3);
      expect(piece.analysis.watchOut.length).toBeGreaterThanOrEqual(1);
      expect(piece.skills.length).toBeGreaterThanOrEqual(2);
      expect(piece.measures).toBeGreaterThan(0);
    }
  });

  test("hay obras originales y algún arreglo fácil para el primer día, todos de biblioteca", () => {
    const arranged = CATALOG.filter((p) => p.source.arranged);
    expect(arranged.length).toBeGreaterThan(0);
    expect(CATALOG.length - arranged.length).toBeGreaterThan(10);
    // el nivel cero solo tiene arreglos, y el título lo dice
    for (const p of arranged) expect(p.title).toContain("arreglo fácil");
    for (const p of CATALOG.filter((p) => p.level === "principiante")) expect(p.source.arranged).toBe(true);
  });

  for (const piece of CATALOG) {
    describe(piece.title, () => {
      test("el archivo existe, es un .mxl válido y tiene los compases de la ficha", () => {
        const path = `public${piece.source.path}`;
        expect(existsSync(path)).toBe(true);
        const files = unzipSync(new Uint8Array(readFileSync(path)));
        expect(files["META-INF/container.xml"]).toBeDefined();
        // el container.xml dice cómo se llama la partitura dentro del zip (igual que hace `unpackMxl`)
        const root = strFromU8(files["META-INF/container.xml"]).match(/full-path="([^"]+)"/)?.[1] ?? "score.xml";
        const xml = strFromU8(files[root]);
        expect(xml).toContain("<score-partwise");
        const parts = (xml.match(/<part id=/g) ?? []).length;
        expect(xml.match(/<measure /g) ?? []).toHaveLength(piece.measures * parts);
        // Piano: una parte de dos pentagramas, o dos partes de uno.
        expect(parts === 1 ? xml.includes("<staves>2</staves>") : parts === 2).toBe(true);
      });

      test("dice de dónde viene la transcripción", () => {
        expect(piece.source.origin.url).toMatch(/^https:\/\//);
        expect(piece.source.path).toBe(`/catalog/${piece.id}.mxl`);
      });
    });
  }

  test("las piezas se agrupan por nivel sin perder ninguna", () => {
    const grouped = piecesByLevel().flatMap((g) => g.pieces);
    expect(grouped.length).toBe(CATALOG.length);
  });
});
