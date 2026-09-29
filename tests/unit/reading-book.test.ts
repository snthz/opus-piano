/**
 * El cuaderno de lectura está escrito a mano, compás a compás, en
 * `src/data/reading-book/`. Un compás que no suma lo que dice su cifra de
 * compás, o una figura que VexFlow no sabe analizar, no se ve al escribirlo:
 * se ve cuando alguien abre la pieza y no hay partitura. Esto es lo que lo
 * comprueba.
 */
import { describe, expect, test } from "bun:test";
import { EasyScore } from "vexflow";
import { READING_BOOK, ALL_BOOK_ITEMS, bookLocation, neighbours } from "@/data/reading-book";
import { easyScoreBeats, parseEasyScore } from "@/lib/music/easyscore";
import { figureCount, gradeItems, layoutItem, measuresPerSystem, systems, type BookItem } from "@/lib/music/reading-book";
import { TIME_SIGNATURE_BY_ID, measureBeats } from "@/lib/music/meter";
import { keyByVex } from "@/lib/music/keys";

const staves = (item: BookItem): { name: string; measures: string[]; ties?: [number, number][] }[] => [
  { name: "arriba", measures: item.top, ties: item.ties },
  ...(item.bottom ? [{ name: "abajo", measures: item.bottom, ties: item.bassTies }] : []),
];

describe("easyScoreBeats", () => {
  test("la duración es pegajosa, como en VexFlow", () => {
    expect(easyScoreBeats("C4/q, D4, E4, F4")).toBe(4);
    expect(easyScoreBeats("C4/8, D4, E4, F4")).toBe(2);
  });

  test("cuenta puntillos, silencios y acordes", () => {
    expect(easyScoreBeats("C4/h.")).toBe(3);
    expect(easyScoreBeats("B4/h/r.")).toBe(3);
    expect(easyScoreBeats("(C4 E4 G4)/w")).toBe(4);
    expect(easyScoreBeats("B4/q, B4/q/r, B4")).toBe(3);
  });

  test("un acorde es una sola figura, con sus alturas", () => {
    const [figure] = parseEasyScore("(E3 G3 B3)/h");
    expect(figure.keys).toEqual(["E3", "G3", "B3"]);
    expect(figure.beats).toBe(2);
  });
});

describe("cuaderno de lectura", () => {
  test("los grados van numerados en orden y las etapas también", () => {
    expect(READING_BOOK.map((g) => g.n)).toEqual(READING_BOOK.map((_, i) => i + 1));
    for (const grade of READING_BOOK) {
      expect(grade.stages.map((s) => s.n)).toEqual(grade.stages.map((_, i) => i + 1));
      expect(grade.stages.length).toBeGreaterThan(0);
    }
  });

  test("los identificadores no se repiten y se encuentran", () => {
    const ids = ALL_BOOK_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of ALL_BOOK_ITEMS) {
      const location = bookLocation(item.id);
      expect(location?.item.id).toBe(item.id);
      expect(location?.stage.items).toContain(item);
    }
  });

  test("cada grado tiene ritmo, fórmulas y piezas en cada etapa", () => {
    for (const grade of READING_BOOK) {
      for (const stage of grade.stages) {
        const kinds = stage.items.map((i) => i.kind);
        expect(kinds).toContain("rhythm");
        expect(kinds).toContain("melody");
        expect(kinds).toContain("piece");
      }
      // Al menos una pieza preparada, con preguntas, por etapa.
      for (const stage of grade.stages) {
        expect(stage.items.some((i) => i.prep?.length)).toBe(true);
      }
    }
  });

  test("las piezas de dos manos tienen los dos pentagramas con los mismos compases", () => {
    for (const item of ALL_BOOK_ITEMS) {
      if (item.hand === "both") expect(item.bottom).toBeDefined();
      if (item.bottom) expect(item.bottom.length).toBe(item.top.length);
    }
  });

  test("la tonalidad y el compás existen, y el tempo va de lento a objetivo", () => {
    for (const item of ALL_BOOK_ITEMS) {
      expect(() => keyByVex(item.keyVex)).not.toThrow();
      expect(TIME_SIGNATURE_BY_ID[item.tsId]).toBeDefined();
      const [slow, target] = item.bpm;
      expect(slow).toBeGreaterThanOrEqual(30);
      expect(slow).toBeLessThan(target);
      expect(target).toBeLessThanOrEqual(160);
    }
  });

  test("todos los compases suman lo que dice la cifra de compás", () => {
    for (const item of ALL_BOOK_ITEMS) {
      const total = measureBeats(TIME_SIGNATURE_BY_ID[item.tsId]);
      for (const staff of staves(item)) {
        staff.measures.forEach((measure, i) => {
          expect(easyScoreBeats(measure)).toBeCloseTo(total, 5);
          // El mensaje del fallo no dice qué compás era; esto sí.
          if (Math.abs(easyScoreBeats(measure) - total) > 1e-6) {
            throw new Error(`${item.id} (${staff.name}), compás ${i + 1}: ${measure}`);
          }
        });
      }
    }
  });

  test("VexFlow analiza todos los compases", () => {
    const score = new EasyScore();
    for (const item of ALL_BOOK_ITEMS) {
      for (const staff of staves(item)) {
        for (const measure of staff.measures) {
          if (!score.parse(measure).success) throw new Error(`${item.id} (${staff.name}): ${measure}`);
        }
      }
    }
  });

  test("las ligaduras unen figuras que existen, seguidas y de la misma altura", () => {
    for (const item of ALL_BOOK_ITEMS) {
      for (const staff of staves(item)) {
        const figures = staff.measures.flatMap((m) => parseEasyScore(m));
        expect(figureCount(staff.measures)).toBe(figures.length);
        for (const [from, to] of staff.ties ?? []) {
          expect(to).toBe(from + 1);
          expect(figures[from]).toBeDefined();
          expect(figures[to]).toBeDefined();
          if (figures[from].keys.join() !== figures[to].keys.join()) {
            throw new Error(`${item.id} (${staff.name}): la ligadura ${from}-${to} une notas distintas`);
          }
        }
      }
    }
  });

  test("las ligaduras de expresión caen dentro del pentagrama de arriba", () => {
    for (const item of ALL_BOOK_ITEMS) {
      const total = figureCount(item.top);
      for (const [from, to] of item.slurs ?? []) {
        expect(from).toBeGreaterThanOrEqual(0);
        expect(from).toBeLessThan(to);
        expect(to).toBeLessThan(total);
      }
    }
  });

  test("los textos están escritos: título, en qué fijarse y preguntas enteras", () => {
    for (const item of ALL_BOOK_ITEMS) {
      expect(item.title.length).toBeGreaterThan(3);
      expect(item.focus.length).toBeGreaterThan(20);
      for (const question of item.prep ?? []) expect(question.length).toBeGreaterThan(20);
    }
  });

  test("los sistemas reparten los compases sin perder ninguno", () => {
    for (const item of ALL_BOOK_ITEMS) {
      expect(systems(item.top, 4).flat()).toEqual(item.top);
      expect(systems(item.top, 2).every((s) => s.length <= 2)).toBe(true);
    }
  });

  test("ninguna ligadura cruza de una línea a la siguiente", () => {
    for (const item of ALL_BOOK_ITEMS) {
      const lines = layoutItem(item, measuresPerSystem(TIME_SIGNATURE_BY_ID[item.tsId]));
      expect(lines.flatMap((l) => l.measures)).toEqual(item.top);
      if (item.bottom) expect(lines.flatMap((l) => l.bass ?? [])).toEqual(item.bottom);

      const kept = (which: keyof Pick<typeof lines[number], "ties" | "bassTies" | "slurs">) =>
        lines.reduce((sum, line) => sum + (line[which]?.length ?? 0), 0);
      // Una ligadura que el reparto se deja por el camino no se dibuja: el
      // alumno leería dos ataques donde hay uno solo.
      expect(kept("ties")).toBe(item.ties?.length ?? 0);
      expect(kept("bassTies")).toBe(item.bassTies?.length ?? 0);
      expect(kept("slurs")).toBe(item.slurs?.length ?? 0);
    }
  });

  test("las ligaduras renumeradas apuntan a la misma nota que antes de partir la pieza", () => {
    for (const item of ALL_BOOK_ITEMS) {
      const lines = layoutItem(item, measuresPerSystem(TIME_SIGNATURE_BY_ID[item.tsId]));
      for (const line of lines) {
        const figures = line.measures.flatMap((m) => parseEasyScore(m));
        for (const [from, to] of line.ties ?? []) {
          expect(figures[from]?.keys).toEqual(figures[to]?.keys);
        }
        for (const [, to] of line.slurs ?? []) expect(figures[to]).toBeDefined();
      }
    }
  });

  test("la pieza siguiente y la anterior se quedan dentro del grado", () => {
    for (const grade of READING_BOOK) {
      const list = gradeItems(grade);
      expect(neighbours(list[0].id).prev).toBeUndefined();
      expect(neighbours(list[0].id).next?.id).toBe(list[1].id);
      expect(neighbours(list[list.length - 1].id).next).toBeUndefined();
    }
    expect(neighbours("no-existe")).toEqual({});
  });
});
