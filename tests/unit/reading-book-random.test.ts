/**
 * La lectura infinita saca material que nadie ha revisado a mano: si un compás
 * no suma, el alumno se encuentra con una partitura rota en mitad de una
 * sesión. Aquí se generan muchas piezas de cada grado y se comprueban una por
 * una, que es lo más parecido a revisarlas.
 */
import { describe, expect, test } from "bun:test";
import { EasyScore } from "vexflow";
import { RECIPES, randomBookItem, tempoFor } from "@/lib/music/reading-book-random";
import { easyScoreBeats, parseEasyScore } from "@/lib/music/easyscore";
import { fillBar } from "@/lib/music/rhythm";
import { TIME_SIGNATURE_BY_ID, measureBeats } from "@/lib/music/meter";
import { layoutItem, measuresPerSystem, type BookItem, type BookItemKind } from "@/lib/music/reading-book";
import { parsePitch, toMidi } from "@/lib/music/pitch";

const KINDS: BookItemKind[] = ["rhythm", "melody", "piece"];
const GRADES = Object.keys(RECIPES).map(Number);
const ROUNDS = 12;

const everyItem = (fn: (item: BookItem, grade: number) => void) => {
  for (const grade of GRADES) {
    for (const kind of KINDS) {
      for (let i = 0; i < ROUNDS; i++) fn(randomBookItem(grade, kind), grade);
    }
  }
};

describe("fillBar", () => {
  test("los compases compuestos se escriben con figuras con puntillo", () => {
    expect(fillBar(6).map((f) => f.vex)).toEqual(["w."]);
    expect(fillBar(4.5).map((f) => f.vex)).toEqual(["h.", "q."]);
    expect(fillBar(3).map((f) => f.vex)).toEqual(["h."]);
    expect(fillBar(1.5).map((f) => f.vex)).toEqual(["q."]);
  });

  test("los simples siguen como estaban", () => {
    expect(fillBar(4).map((f) => f.vex)).toEqual(["w"]);
    expect(fillBar(2).map((f) => f.vex)).toEqual(["h"]);
    expect(fillBar(1).map((f) => f.vex)).toEqual(["q"]);
  });

  test("lo que sale dura lo que se ha pedido", () => {
    for (const beats of [0.5, 1, 1.5, 2, 3, 4, 4.5, 6]) {
      expect(fillBar(beats).reduce((s, f) => s + f.beats, 0)).toBeCloseTo(beats, 5);
    }
  });
});

describe("tempoFor", () => {
  test("el pulso del compás compuesto va más despacio que la negra, y el de corchea más deprisa", () => {
    const base: [number, number] = [50, 72];
    expect(tempoFor(TIME_SIGNATURE_BY_ID["4-4"], base)[0]).toBe(50);
    expect(tempoFor(TIME_SIGNATURE_BY_ID["6-8"], base)[0]).toBeLessThan(50);
    expect(tempoFor(TIME_SIGNATURE_BY_ID["3-8"], base)[0]).toBeGreaterThan(80);
  });

  test("nunca se sale de lo que admite el metrónomo", () => {
    for (const ts of Object.values(TIME_SIGNATURE_BY_ID)) {
      for (const [slow, fast] of [tempoFor(ts, [48, 69]), tempoFor(ts, [52, 76])]) {
        expect(slow).toBeGreaterThanOrEqual(30);
        expect(fast).toBeLessThanOrEqual(160);
      }
    }
  });
});

describe("randomBookItem", () => {
  test("respeta el temario del grado", () => {
    everyItem((item, grade) => {
      const recipe = RECIPES[grade];
      expect(recipe.meters).toContain(item.tsId);
      if (item.kind !== "rhythm") expect(recipe.keys).toContain(item.keyVex);
      expect(item.top.length).toBe(recipe.bars[item.kind]);
      expect(item.bpm[0]).toBeLessThan(item.bpm[1]);
    });
  });

  test("todos los compases suman lo que dice la cifra de compás", () => {
    everyItem((item) => {
      const total = measureBeats(TIME_SIGNATURE_BY_ID[item.tsId]);
      for (const measures of [item.top, item.bottom ?? []]) {
        for (const measure of measures) {
          if (Math.abs(easyScoreBeats(measure) - total) > 1e-6) {
            throw new Error(`${item.id} (${item.tsId}): "${measure}" suma ${easyScoreBeats(measure)}, no ${total}`);
          }
        }
      }
    });
  });

  test("VexFlow analiza todo lo que sale", () => {
    const score = new EasyScore();
    everyItem((item) => {
      for (const measure of [...item.top, ...(item.bottom ?? [])]) {
        if (!score.parse(measure).success) throw new Error(`${item.id}: ${measure}`);
      }
    });
  });

  test("las piezas llevan las dos manos, con los mismos compases", () => {
    everyItem((item) => {
      if (item.kind !== "piece") {
        expect(item.bottom).toBeUndefined();
        return;
      }
      expect(item.hand).toBe("both");
      expect(item.bottom?.length).toBe(item.top.length);
      expect(item.prep?.length).toBeGreaterThan(0);
    });
  });

  test("las notas caben en el registro del grado", () => {
    const midiOf = (name: string) => toMidi(parsePitch(name));
    everyItem((item, grade) => {
      const recipe = RECIPES[grade];
      if (item.kind === "rhythm") return;
      const melodyRange = item.hand === "left" ? recipe.bass : recipe.treble;
      const notes = item.top.flatMap((m) => parseEasyScore(m)).flatMap((f) => f.keys);
      for (const note of notes) {
        // La armadura puede alterar la nota un semitono respecto al extremo.
        expect(midiOf(note)).toBeGreaterThanOrEqual(midiOf(melodyRange[0]) - 1);
        expect(midiOf(note)).toBeLessThanOrEqual(midiOf(melodyRange[1]) + 1);
      }
      for (const note of (item.bottom ?? []).flatMap((m) => parseEasyScore(m)).flatMap((f) => f.keys)) {
        expect(midiOf(note)).toBeGreaterThanOrEqual(midiOf(recipe.bass[0]) - 1);
        expect(midiOf(note)).toBeLessThanOrEqual(midiOf(recipe.bass[1]) + 1);
      }
    });
  });

  test("la izquierda no cruza por encima de la derecha", () => {
    everyItem((item) => {
      if (!item.bottom) return;
      const top = item.top.flatMap((m) => parseEasyScore(m)).flatMap((f) => f.keys.map((k) => toMidi(parsePitch(k))));
      const bottom = item.bottom.flatMap((m) => parseEasyScore(m)).flatMap((f) => f.keys.map((k) => toMidi(parsePitch(k))));
      expect(Math.max(...bottom)).toBeLessThanOrEqual(Math.min(...top));
    });
  });

  test("las piezas empiezan y acaban en la tónica, con la melodía descansando al final", () => {
    for (const grade of GRADES) {
      for (let i = 0; i < ROUNDS; i++) {
        const item = randomBookItem(grade, "piece");
        const bass = item.bottom!;
        const first = parseEasyScore(bass[0])[0].keys[0].replace(/\d/g, "");
        const last = parseEasyScore(bass[bass.length - 1])[0].keys[0].replace(/\d/g, "");
        expect(first).toBe(last);
      }
    }
  });

  test("se reparten en líneas sin perder compases", () => {
    everyItem((item) => {
      const lines = layoutItem(item, measuresPerSystem(TIME_SIGNATURE_BY_ID[item.tsId]));
      expect(lines.flatMap((l) => l.measures)).toEqual(item.top);
      if (item.bottom) expect(lines.flatMap((l) => l.bass ?? [])).toEqual(item.bottom);
    });
  });

  test("cada lectura tiene su identificador y su texto", () => {
    const ids = new Set<string>();
    everyItem((item) => {
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
      expect(item.focus.length).toBeGreaterThan(20);
      expect(item.title.length).toBeGreaterThan(3);
    });
  });
});
