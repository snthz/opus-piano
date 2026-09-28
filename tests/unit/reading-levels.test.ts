import { describe, expect, test } from "bun:test";
import {
  LEVEL_BY_ID,
  READING_LEVELS,
  ROUND_LENGTH,
  buildLevelPool,
  gradeRound,
  levelGroups,
  questionKey,
} from "@/lib/practice/reading-levels";
import { starTotals, unlockedCount, type LevelRecord } from "@/lib/practice/level-progress";
import { accidentalFromKey, computerKeyMap, keyHints, letterFromKey } from "@/lib/practice/note-keys";
import { toMidi, parsePitch } from "@/lib/music/pitch";

const IDS = READING_LEVELS.map((l) => l.id);
const record = (stars: number): LevelRecord => ({ stars, best: stars * 30, plays: 1 });

describe("READING_LEVELS", () => {
  test("los identificadores no se repiten y van numerados en orden", () => {
    expect(new Set(IDS).size).toBe(IDS.length);
    expect(READING_LEVELS.map((l) => l.n)).toEqual(READING_LEVELS.map((_, i) => i + 1));
  });

  // Los niveles con alteraciones dan más tiempo a propósito: hay que elegir
  // dos cosas, la alteración y la nota. Dentro de cada tipo, el reloj aprieta.
  test("el tiempo por nota no sube al avanzar dentro de un bloque", () => {
    for (const { levels } of levelGroups()) {
      for (const accidentals of [false, true]) {
        const same = levels.filter((l) => l.accidentals === accidentals);
        for (let i = 1; i < same.length; i++) {
          expect(same[i].seconds).toBeLessThanOrEqual(same[i - 1].seconds);
        }
      }
    }
  });

  test("todos los niveles tienen preguntas de sobra para una tanda", () => {
    for (const level of READING_LEVELS) {
      expect(buildLevelPool(level).length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("buildLevelPool", () => {
  test("un rango se expande nota a nota, sin alteraciones", () => {
    const pool = buildLevelPool(LEVEL_BY_ID["sol-1"]);
    expect(pool.map((q) => questionKey(q))).toEqual([
      "treble|C4",
      "treble|D4",
      "treble|E4",
      "treble|F4",
      "treble|G4",
    ]);
  });

  test("una lista cerrada da exactamente esas notas", () => {
    const pool = buildLevelPool(LEVEL_BY_ID["sol-2"]);
    expect(pool.map((q) => questionKey(q))).toEqual(["treble|E4", "treble|G4", "treble|B4", "treble|D5", "treble|F5"]);
  });

  test("con alteraciones, cada nota trae también su sostenido y su bemol", () => {
    const pool = buildLevelPool(LEVEL_BY_ID["mix-2"]);
    expect(pool).toContainEqual({ clef: "treble", pitch: parsePitch("F#4") });
    expect(pool).toContainEqual({ clef: "treble", pitch: parsePitch("Fb4") });
    // Las dos claves, y ninguna nota fuera de su pentagrama.
    expect(pool.some((q) => q.clef === "bass")).toBe(true);
    for (const q of pool) {
      const midi = toMidi(q.pitch);
      if (q.clef === "treble") expect(midi).toBeGreaterThanOrEqual(toMidi(parsePitch("Eb4")));
      else expect(midi).toBeLessThanOrEqual(toMidi(parsePitch("A#3")));
    }
  });
});

describe("gradeRound", () => {
  const limit = 8000;

  test("pleno y rápido son tres estrellas", () => {
    expect(gradeRound(12, 12, 3000, limit)).toEqual({ stars: 3, passed: true, score: 100 });
  });

  test("pleno pero lento se queda en dos: leer no es contar líneas", () => {
    expect(gradeRound(12, 12, 7000, limit).stars).toBe(2);
  });

  test("un fallo son dos estrellas; hasta tres, una", () => {
    expect(gradeRound(11, 12, 3000, limit).stars).toBe(2);
    expect(gradeRound(9, 12, 3000, limit).stars).toBe(1);
  });

  test("con cuatro fallos no se aprueba", () => {
    const grade = gradeRound(8, 12, 3000, limit);
    expect(grade.stars).toBe(0);
    expect(grade.passed).toBe(false);
    expect(grade.score).toBe(67);
  });

  test("una tanda sin respuestas no rompe la media", () => {
    expect(gradeRound(0, 0, 0, 0)).toEqual({ stars: 0, passed: false, score: 0 });
  });
});

describe("unlockedCount", () => {
  test("de entrada solo está abierto el primero", () => {
    expect(unlockedCount(IDS, {})).toBe(1);
  });

  test("cada nivel aprobado abre el siguiente", () => {
    expect(unlockedCount(IDS, { [IDS[0]]: record(1) })).toBe(2);
    expect(unlockedCount(IDS, { [IDS[0]]: record(3), [IDS[1]]: record(2) })).toBe(3);
  });

  test("aprobar uno de más adelante no salta los de en medio", () => {
    expect(unlockedCount(IDS, { [IDS[4]]: record(3) })).toBe(1);
  });

  test("no pasa del último nivel", () => {
    const all = Object.fromEntries(IDS.map((id) => [id, record(3)]));
    expect(unlockedCount(IDS, all)).toBe(IDS.length);
  });

  test("las estrellas se suman sobre tres por nivel", () => {
    expect(starTotals(IDS, { [IDS[0]]: record(2), [IDS[1]]: record(3) })).toEqual({
      earned: 5,
      possible: IDS.length * 3,
    });
  });
});

describe("teclado del ordenador", () => {
  test("los números siguen el orden de la escala y las letras, el cifrado", () => {
    expect(letterFromKey("1")).toBe("C");
    expect(letterFromKey("7")).toBe("B");
    expect(letterFromKey("g")).toBe("G");
    expect(letterFromKey("B")).toBe("B");
  });

  test("lo que no es una nota se ignora", () => {
    for (const key of ["8", "9", "0", "h", "Enter", "ArrowLeft", "Shift", ""]) {
      expect(letterFromKey(key)).toBeNull();
    }
  });

  test("las flechas y los signos ponen la alteración", () => {
    expect(accidentalFromKey("ArrowUp")).toBe(1);
    expect(accidentalFromKey("+")).toBe(1);
    expect(accidentalFromKey("ArrowDown")).toBe(-1);
    expect(accidentalFromKey("-")).toBe(-1);
    expect(accidentalFromKey("0")).toBe(0);
    expect(accidentalFromKey("a")).toBeNull();
  });

  test("la fila de casa cae sobre las blancas desde el do central", () => {
    const map = computerKeyMap(60, 84);
    expect(map.a).toBe(60); // do4
    expect(map.s).toBe(62); // re4
    expect(map.j).toBe(71); // si4
    expect(map.k).toBe(72); // do5
    expect(map.w).toBe(61); // do♯4
    expect(map.e).toBe(63); // re♯4
    // Entre mi y fa no hay negra, así que «r» no existe en el mapa.
    expect(map.r).toBeUndefined();
  });

  test("empezando en una negra, baja a la blanca anterior", () => {
    expect(computerKeyMap(61, 80).a).toBe(60);
  });

  test("la fila de abajo es solo de blancas y no pisa a la de casa", () => {
    const low = computerKeyMap(48, 59, "low");
    expect(low.z).toBe(48);
    expect(Object.values(low).every((midi) => ![1, 3, 6, 8, 10].includes(midi % 12))).toBe(true);
    const home = computerKeyMap(60, 84);
    expect(Object.keys(low).some((k) => k in home)).toBe(false);
  });

  test("el mapa del revés sirve para escribir la tecla en el piano", () => {
    expect(keyHints({ a: 60, w: 61 })).toEqual({ 60: "A", 61: "W" });
  });
});

test("una tanda son doce notas", () => {
  expect(ROUND_LENGTH).toBe(12);
});
