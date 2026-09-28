import { describe, expect, test } from "bun:test";
import {
  SIGHT_LEVELS,
  SIGHT_LEVEL_BY_ID,
  generateSightPiece,
  gradeSight,
  noteTolerance,
  type SightNote,
} from "@/lib/music/sight-reading";
import { TIME_SIGNATURE_BY_ID, measureBeats } from "@/lib/music/meter";
import { generateMelody } from "@/lib/music/melody";
import { keyByVex } from "@/lib/music/keys";
import { parsePitch, toMidi } from "@/lib/music/pitch";

const note = (over: Partial<SightNote> = {}): SightNote => ({
  staff: "top",
  index: 0,
  midi: 60,
  beat: 0,
  beats: 1,
  ...over,
});

describe("SIGHT_LEVELS", () => {
  test("los identificadores no se repiten y van numerados en orden", () => {
    const ids = SIGHT_LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SIGHT_LEVELS.map((l) => l.n)).toEqual(SIGHT_LEVELS.map((_, i) => i + 1));
  });

  test("todos apuntan a un compás que existe y a un registro legible", () => {
    for (const level of SIGHT_LEVELS) {
      expect(TIME_SIGNATURE_BY_ID[level.tsId]).toBeDefined();
      expect(toMidi(parsePitch(level.range[0]))).toBeLessThan(toMidi(parsePitch(level.range[1])));
      expect(level.bpm).toBeGreaterThanOrEqual(40);
    }
  });
});

describe("generateSightPiece", () => {
  test("da los compases pedidos y todas las notas dentro del registro", () => {
    for (const level of SIGHT_LEVELS) {
      const piece = generateSightPiece(level);
      const ts = TIME_SIGNATURE_BY_ID[level.tsId];
      expect(piece.top.length).toBe(level.bars);
      expect(piece.totalBeats).toBeCloseTo(measureBeats(ts) * level.bars, 5);

      const lo = toMidi(parsePitch(level.range[0]));
      const hi = toMidi(parsePitch(level.range[1]));
      for (const n of piece.notes.filter((x) => x.staff === "top")) {
        // La armadura puede alterar la nota un semitono respecto al extremo.
        expect(n.midi).toBeGreaterThanOrEqual(lo - 1);
        expect(n.midi).toBeLessThanOrEqual(hi + 1);
      }
    }
  });

  test("sin sistema doble no hay pentagrama de abajo", () => {
    const piece = generateSightPiece(SIGHT_LEVEL_BY_ID["pv-1"]);
    expect(piece.bottom).toBeNull();
    expect(piece.notes.every((n) => n.staff === "top")).toBe(true);
  });

  test("el sistema doble lleva una nota larga por compás en la izquierda", () => {
    const level = SIGHT_LEVEL_BY_ID["pv-10"];
    const piece = generateSightPiece(level);
    const ts = TIME_SIGNATURE_BY_ID[level.tsId];
    const bars = measureBeats(ts);
    const left = piece.notes.filter((n) => n.staff === "bottom");
    expect(piece.bottom).toHaveLength(level.bars);
    expect(left).toHaveLength(level.bars);
    left.forEach((n, i) => {
      expect(n.index).toBe(i);
      expect(n.beat).toBeCloseTo(i * bars, 5);
      expect(n.beats).toBeCloseTo(bars, 5);
      // Registro de la mano izquierda: nada por encima del do central.
      expect(n.midi).toBeLessThanOrEqual(60);
      expect(n.midi).toBeGreaterThanOrEqual(36);
    });
  });

  test("las notas van en orden de tiempo y sin silencios", () => {
    const piece = generateSightPiece(SIGHT_LEVEL_BY_ID["pv-10"]);
    for (let i = 1; i < piece.notes.length; i++) {
      expect(piece.notes[i].beat).toBeGreaterThanOrEqual(piece.notes[i - 1].beat);
    }
    expect(piece.top.join(" ")).not.toContain("/r");
  });

  test("cada índice apunta a una nota distinta de su pentagrama", () => {
    const piece = generateSightPiece(SIGHT_LEVEL_BY_ID["pv-4"]);
    const indexes = piece.notes.map((n) => `${n.staff}:${n.index}`);
    expect(new Set(indexes).size).toBe(indexes.length);
  });
});

describe("generateMelody con registro acotado", () => {
  // Un salto de sexta no cabe en un registro de cinco notas ni hacia arriba ni
  // hacia abajo: antes se daba la vuelta y se salía por el otro extremo.
  test("ninguna nota se sale, por estrecho que sea el registro", () => {
    const key = keyByVex("C");
    const ts = TIME_SIGNATURE_BY_ID["4-4"];
    const range: [ReturnType<typeof parsePitch>, ReturnType<typeof parsePitch>] = [parsePitch("C4"), parsePitch("G4")];
    for (let i = 0; i < 200; i++) {
      const melody = generateMelody(key, "treble", ts, 4, 2, { range, noRests: true });
      for (const n of melody.measures.flat()) {
        expect(toMidi(n.pitch)).toBeGreaterThanOrEqual(toMidi(range[0]));
        expect(toMidi(n.pitch)).toBeLessThanOrEqual(toMidi(range[1]));
      }
    }
  });

  test("un registro de una sola nota no cuelga ni produce nada raro", () => {
    const melody = generateMelody(keyByVex("C"), "treble", TIME_SIGNATURE_BY_ID["4-4"], 2, 1, {
      range: [parsePitch("C4"), parsePitch("C4")],
      noRests: true,
    });
    expect(melody.measures.flat().every((n) => toMidi(n.pitch) === 60)).toBe(true);
  });
});

describe("noteTolerance", () => {
  test("una nota larga admite más margen que una corta", () => {
    const beatSec = 60 / 60;
    expect(noteTolerance(note({ beats: 4 }), beatSec)).toBeGreaterThan(noteTolerance(note({ beats: 1 }), beatSec));
  });

  test("ni desaparece a tempo rápido ni se come el compás a tempo lento", () => {
    expect(noteTolerance(note({ beats: 0.5 }), 60 / 160)).toBeGreaterThanOrEqual(0.28);
    expect(noteTolerance(note({ beats: 4 }), 60 / 40)).toBeLessThanOrEqual(1.1);
  });
});

describe("gradeSight", () => {
  test("leerla entera son tres estrellas", () => {
    expect(gradeSight(8, 8)).toEqual({ stars: 3, passed: true, score: 100 });
  });

  test("las notas de más restan medio acierto cada una", () => {
    expect(gradeSight(8, 8, 2).score).toBe(88);
    expect(gradeSight(8, 8, 2).stars).toBe(2);
  });

  test("por debajo del 65 % no se aprueba", () => {
    expect(gradeSight(5, 8).passed).toBe(false);
    expect(gradeSight(6, 8).stars).toBe(1);
  });

  test("la penalización nunca deja la puntuación en negativo", () => {
    expect(gradeSight(1, 8, 40).score).toBe(0);
  });

  test("una lectura vacía no puntúa", () => {
    expect(gradeSight(0, 0)).toEqual({ stars: 0, passed: false, score: 0 });
  });
});
