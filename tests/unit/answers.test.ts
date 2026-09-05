import { describe, expect, test } from "bun:test";
import { isAnswer } from "@/lib/server/progress-service";

const good = { exerciseId: "notas", correct: true, streak: 3, day: "2026-09-05", at: "2026-09-05T10:00:00.000Z" };

describe("validación de respuestas enviadas por el cliente", () => {
  test("acepta una respuesta bien formada", () => {
    expect(isAnswer(good)).toBe(true);
  });

  test("rechaza campos que faltan o de tipo incorrecto", () => {
    expect(isAnswer({ ...good, exerciseId: "../x" })).toBe(false);
    expect(isAnswer({ ...good, correct: "sí" })).toBe(false);
    expect(isAnswer({ ...good, streak: Infinity })).toBe(false);
    expect(isAnswer({ ...good, day: "5/9/2026" })).toBe(false);
    expect(isAnswer({ ...good, at: "ayer" })).toBe(false);
    expect(isAnswer(null)).toBe(false);
    expect(isAnswer("notas")).toBe(false);
  });
});
