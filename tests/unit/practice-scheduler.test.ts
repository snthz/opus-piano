import { describe, expect, test } from "bun:test";
import {
  accuracy,
  applyAnswer,
  BOX_MINUTES,
  chooseItem,
  emptyStat,
  MAX_BOX,
  settledCount,
  weakest,
  weight,
  type ItemStat,
  type ItemStats,
} from "@/lib/practice/scheduler";
import { itemLabel } from "@/lib/practice/labels";

const NOW = 1_757_000_000_000;

/** Item answered `attempts` times with `correct` hits, all of them just now. */
function stat(attempts: number, correct: number, box = 0, last = NOW): ItemStat {
  return { attempts, correct, streak: 0, box, last, due: last + BOX_MINUTES[box] * 60_000 };
}

describe("applyAnswer", () => {
  test("una respuesta correcta sube de caja y aleja el repaso", () => {
    const s = applyAnswer(undefined, true, NOW);
    expect(s.attempts).toBe(1);
    expect(s.correct).toBe(1);
    expect(s.streak).toBe(1);
    expect(s.box).toBe(1);
    expect(s.due).toBe(NOW + BOX_MINUTES[1] * 60_000);
  });

  test("un fallo baja una caja y corta la racha", () => {
    const s = applyAnswer(stat(4, 4, 3), false, NOW);
    expect(s.box).toBe(2);
    expect(s.streak).toBe(0);
    expect(s.correct).toBe(4);
    expect(s.attempts).toBe(5);
  });

  test("la caja no baja de 0 ni sube de MAX_BOX", () => {
    expect(applyAnswer(emptyStat(NOW), false, NOW).box).toBe(0);
    expect(applyAnswer(stat(9, 9, MAX_BOX), true, NOW).box).toBe(MAX_BOX);
  });
});

describe("weight", () => {
  test("lo que nunca se ha preguntado pesa más que lo asentado", () => {
    const settled = stat(10, 10, MAX_BOX, NOW - 60_000);
    expect(weight(undefined, NOW)).toBeGreaterThan(weight(settled, NOW));
  });

  test("lo que aún no toca repasar casi no sale", () => {
    const fresh = applyAnswer(undefined, true, NOW);
    expect(weight(fresh, NOW)).toBeLessThan(0.5);
    // pasada la espera de su caja, vuelve a contar
    expect(weight(fresh, fresh.due + 1)).toBeGreaterThan(1);
  });

  test("lo que más se falla pesa más", () => {
    const bad = stat(10, 2, 0, NOW - 60_000);
    const good = stat(10, 9, 0, NOW - 60_000);
    expect(weight(bad, NOW)).toBeGreaterThan(weight(good, NOW));
  });
});

describe("chooseItem", () => {
  const pool = ["a", "b", "c"];
  const id = (x: string) => x;

  test("nunca repite la anterior si hay alternativas", () => {
    for (let i = 0; i < 50; i++) {
      const got = chooseItem(pool, id, {}, { now: NOW, exclude: "b", rng: () => i / 50 });
      expect(got).not.toBe("b");
    }
  });

  test("con un solo elemento lo devuelve aunque sea el excluido", () => {
    expect(chooseItem(["a"], id, {}, { now: NOW, exclude: "a" })).toBe("a");
  });

  test("el reparto favorece a lo que se falla", () => {
    const stats: ItemStats = {
      a: stat(10, 1, 0, NOW - 60_000), // se falla casi siempre
      b: stat(10, 10, MAX_BOX, NOW - 60_000), // asentada
      c: stat(10, 10, MAX_BOX, NOW - 60_000),
    };
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 1000; i++) {
      counts[chooseItem(pool, id, stats, { now: NOW, rng: () => i / 1000 })]++;
    }
    expect(counts.a).toBeGreaterThan(counts.b + counts.c);
    // pero lo asentado sigue apareciendo: nadie quiere tres notas en bucle
    expect(counts.b).toBeGreaterThan(0);
    expect(counts.c).toBeGreaterThan(0);
  });

  test("una pool vacía es un error del que la llama", () => {
    expect(() => chooseItem([], id, {}, { now: NOW })).toThrow();
  });
});

describe("weakest", () => {
  const all = {
    notas: {
      "treble|F5": stat(10, 3),
      "treble|C4": stat(10, 9),
      "bass|G2": stat(2, 0), // pocas respuestas: aún no es un punto débil
    },
    armaduras: { Eb: stat(8, 2) },
    simbolos: { calderon: stat(6, 6) }, // sin fallos
  };

  test("ordena por tasa de acierto y descarta lo que no procede", () => {
    const list = weakest(all);
    expect(list.map((w) => w.itemId)).toEqual(["Eb", "treble|F5", "treble|C4"]);
    expect(list[0].exerciseId).toBe("armaduras");
    expect(list[0].rate).toBeCloseTo(0.25);
  });

  test("respeta el límite", () => {
    expect(weakest(all, 1)).toHaveLength(1);
  });
});

test("settledCount cuenta lo que ya está en la última caja", () => {
  expect(settledCount({ a: stat(9, 9, MAX_BOX), b: stat(3, 2, 2) })).toBe(1);
});

test("accuracy usa un prior para no fiarse de dos respuestas", () => {
  expect(accuracy(undefined)).toBe(0.5);
  expect(accuracy(stat(2, 2))).toBeCloseTo(0.75);
  expect(accuracy(stat(100, 100))).toBeGreaterThan(0.98);
});

describe("itemLabel", () => {
  test("nombra las notas con el sistema elegido", () => {
    expect(itemLabel("notas", "bass|F3")).toBe("fa3 en clave de fa");
    expect(itemLabel("teclado", "treble|C#4", "anglosajon")).toBe("C♯4 en clave de sol");
  });

  test("nombra tonalidades, símbolos e intervalos", () => {
    expect(itemLabel("armaduras", "Eb")).toBe("Mi♭ mayor");
    expect(itemLabel("oido", "7|asc")).toContain("ascendente");
    expect(itemLabel("simbolos", "clave-sol")).toBe("Clave de sol");
  });

  test("un id que no se entiende se enseña tal cual", () => {
    expect(itemLabel("notas", "loquesea")).toBe("loquesea");
    expect(itemLabel("otro", "x")).toBe("x");
  });
});
