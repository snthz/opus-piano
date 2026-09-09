import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";
import { CATALOG, piecesByLevel } from "@/data/catalog";
import { catalogMusicXml, parseCatalogMusic } from "@/lib/music/catalog-score";
import { durationWarnings, measureBeats } from "@/lib/music/musicxml-build";
import { buildTimeline } from "@/lib/music/musicxml";
import { keyByVex } from "@/lib/music/keys";

/**
 * Dos clases de pieza, dos comprobaciones. Las escritas a mano en notación
 * compacta: que cada compás dure lo que pide su cifra, que el MusicXML salga
 * con la tonalidad y los compases correctos y que suene. Las originales: que
 * el .mxl exista, se abra y sea un MusicXML partwise con los compases que
 * dice la ficha. Las alturas hay que escucharlas; esto atrapa lo demás.
 *
 * El MusicXML se revisa como texto y no con `parseMusicXml` porque ese lee
 * con `DOMParser`, que en el runner de bun no existe (igual que en
 * `omr-merge.test.ts`).
 */

const compact = CATALOG.flatMap((p) => (p.source.kind === "compact" ? [{ piece: p, music: p.source.music }] : []));
const originals = CATALOG.flatMap((p) => (p.source.kind === "file" ? [{ piece: p, source: p.source }] : []));

describe("catálogo de dominio público", () => {
  test("hay piezas y todas tienen id único", () => {
    expect(CATALOG.length).toBeGreaterThan(0);
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

  test("hay arreglos para empezar y obras originales", () => {
    expect(compact.length).toBeGreaterThan(0);
    expect(originals.length).toBeGreaterThan(10);
  });

  for (const { piece, source } of originals) {
    describe(piece.title, () => {
      test("el archivo existe, es un .mxl válido y tiene los compases de la ficha", () => {
        const path = `public${source.path}`;
        expect(existsSync(path)).toBe(true);
        const files = unzipSync(new Uint8Array(readFileSync(path)));
        expect(files["META-INF/container.xml"]).toBeDefined();
        const xml = strFromU8(files["score.xml"]);
        expect(xml).toContain("<score-partwise");
        expect(xml.match(/<measure /g) ?? []).toHaveLength(piece.measures * (xml.match(/<part id=/g) ?? []).length);
        // Piano: una parte de dos pentagramas, o dos partes de uno.
        const parts = (xml.match(/<part id=/g) ?? []).length;
        expect(parts === 1 ? xml.includes("<staves>2</staves>") : parts === 2).toBe(true);
      });

      test("dice de dónde viene la transcripción", () => {
        expect(source.origin.url).toMatch(/^https:\/\//);
        expect(source.path).toBe(`/catalog/${piece.id}.mxl`);
      });
    });
  }

  for (const { piece, music } of compact) {
    describe(piece.title, () => {
      const parsed = parseCatalogMusic(music, piece.title);

      test("cada compás suma lo que pide el compás", () => {
        expect(durationWarnings(parsed)).toEqual([]);
      });

      test("las dos manos están escritas en los dos pentagramas", () => {
        expect(parsed.clefs).toEqual(["treble", "bass"]);
        for (const m of parsed.measures) expect(m.staves.length).toBe(2);
      });

      test("el MusicXML sale con la tonalidad, el compás y las notas de la pieza", () => {
        const xml = catalogMusicXml(music, piece.title, piece.composer);
        expect(xml).toContain(`<work-title>${piece.title}</work-title>`);
        expect(xml).toContain(`<fifths>${keyByVex(music.keyVex).fifths}</fifths>`);
        expect(xml).toContain(`<beats>${music.time.num}</beats><beat-type>${music.time.den}</beat-type>`);
        expect(xml).toContain(`<per-minute>${music.tempo}</per-minute>`);
        expect(xml).toContain("<staves>2</staves>");

        // Un <measure> por compás y un <note> por nota (los acordes escriben una por altura).
        expect(xml.match(/<measure number=/g) ?? []).toHaveLength(music.measures.length);
        const notes = parsed.measures.flatMap((m) => m.staves.flat());
        const expectedNotes = notes.reduce((n, e) => n + (e.rest || !e.pitches.length ? 1 : e.pitches.length), 0);
        expect(xml.match(/<note>|<note><chord\/>/g) ?? []).toHaveLength(expectedNotes);
      });

      test("se puede reproducir: la línea de tiempo tiene notas y dura lo que ocupan los compases", () => {
        const timeline = buildTimeline(parsed);
        expect(timeline.length).toBeGreaterThan(0);
        const expected = parsed.measures.reduce((sum, m, i) => {
          // La anacrusa dura menos que un compás entero, por definición.
          const beats = Math.max(...m.staves.map((s) => s.reduce((n, e) => n + e.beats, 0)));
          return sum + (i === 0 ? beats : measureBeats(parsed.time));
        }, 0);
        const end = Math.max(...timeline.map((n) => n.start + n.beats));
        expect(end).toBeCloseTo(expected, 5);
      });
    });
  }

  test("las piezas se agrupan por nivel sin perder ninguna", () => {
    const grouped = piecesByLevel().flatMap((g) => g.pieces);
    expect(grouped.length).toBe(CATALOG.length);
  });
});
