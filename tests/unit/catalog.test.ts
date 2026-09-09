import { describe, expect, test } from "bun:test";
import { CATALOG, piecesByLevel } from "@/data/catalog";
import { catalogMusicXml, parseCatalogMusic } from "@/lib/music/catalog-score";
import { durationWarnings, measureBeats } from "@/lib/music/musicxml-build";
import { buildTimeline } from "@/lib/music/musicxml";
import { keyByVex } from "@/lib/music/keys";

/**
 * Las piezas del catálogo se escriben a mano, así que lo que se puede
 * comprobar solo se comprueba aquí: que cada compás dure lo que pide su
 * cifra, que el MusicXML salga con la tonalidad y los compases correctos y
 * que la pieza suene. Las alturas hay que escucharlas; esto atrapa lo demás.
 *
 * El MusicXML se revisa como texto y no con `parseMusicXml` porque ese lee
 * con `DOMParser`, que en el runner de bun no existe (igual que en
 * `omr-merge.test.ts`).
 */

describe("catálogo de dominio público", () => {
  test("hay piezas y todas tienen id único", () => {
    expect(CATALOG.length).toBeGreaterThan(0);
    expect(new Set(CATALOG.map((p) => p.id)).size).toBe(CATALOG.length);
  });

  for (const piece of CATALOG) {
    describe(piece.title, () => {
      const parsed = parseCatalogMusic(piece.music, piece.title);

      test("cada compás suma lo que pide el compás", () => {
        expect(durationWarnings(parsed)).toEqual([]);
      });

      test("las dos manos están escritas en los dos pentagramas", () => {
        expect(parsed.clefs).toEqual(["treble", "bass"]);
        for (const m of parsed.measures) expect(m.staves.length).toBe(2);
      });

      test("el MusicXML sale con la tonalidad, el compás y las notas de la pieza", () => {
        const xml = catalogMusicXml(piece.music, piece.title, piece.composer);
        expect(xml).toContain(`<work-title>${piece.title}</work-title>`);
        expect(xml).toContain(`<fifths>${keyByVex(piece.music.keyVex).fifths}</fifths>`);
        expect(xml).toContain(`<beats>${piece.music.time.num}</beats><beat-type>${piece.music.time.den}</beat-type>`);
        expect(xml).toContain(`<per-minute>${piece.music.tempo}</per-minute>`);
        expect(xml).toContain("<staves>2</staves>");

        // Un <measure> por compás y un <note> por nota (los acordes escriben una por altura).
        expect(xml.match(/<measure number=/g) ?? []).toHaveLength(piece.music.measures.length);
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
