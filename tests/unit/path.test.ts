import { describe, expect, test } from "bun:test";
import { CATALOG } from "@/data/catalog";
import { EXERCISES } from "@/data/exercises";
import { ALL_LESSONS } from "@/data/lessons";
import { PATH, PATH_STEPS } from "@/data/path";
import { MASTERY_ACCURACY, MASTERY_ATTEMPTS, resolvePath, type PathInput } from "@/lib/path";
import type { ExerciseProgress, ProgressMap } from "@/lib/progress";

const empty: PathInput = { progress: {}, lessonsRead: [], ownedPieces: new Map() };

const exercise = (attempts: number, accuracy: number): ExerciseProgress => ({
  attempts,
  correct: Math.round((attempts * accuracy) / 100),
  bestStreak: 0,
  lastPlayed: new Date().toISOString(),
  days: {},
});

const progress = (entries: Record<string, ExerciseProgress>): ProgressMap => entries;

describe("ruta de aprendizaje", () => {
  test("cada paso apunta a algo que existe de verdad", () => {
    const missing = PATH_STEPS.filter((step) =>
      step.kind === "lesson"
        ? !ALL_LESSONS.some((l) => l.slug === step.ref)
        : step.kind === "exercise"
          ? !EXERCISES.some((e) => e.id === step.ref)
          : !CATALOG.some((p) => p.id === step.ref),
    ).map((s) => `${s.kind}:${s.ref}`);
    expect(missing).toEqual([]);
  });

  test("no repite un paso ni deja etapas vacías", () => {
    const ids = PATH_STEPS.map((s) => `${s.kind}:${s.ref}`);
    expect(new Set(ids).size).toBe(ids.length);
    for (const stage of PATH) expect(stage.steps.length).toBeGreaterThan(0);
  });

  test("recorre todas las lecciones y todos los ejercicios de la app", () => {
    const lessons = PATH_STEPS.filter((s) => s.kind === "lesson").map((s) => s.ref);
    const exercises = PATH_STEPS.filter((s) => s.kind === "exercise").map((s) => s.ref);
    expect(new Set(lessons)).toEqual(new Set(ALL_LESSONS.map((l) => l.slug)));
    expect(new Set(exercises)).toEqual(new Set(EXERCISES.map((e) => e.id)));
  });

  test("de cero, el paso actual es el primero y no hay nada hecho", () => {
    const path = resolvePath(empty);
    expect(path.done).toBe(0);
    expect(path.total).toBe(PATH_STEPS.length);
    expect(path.next?.step).toEqual(PATH_STEPS[0]);
    expect(path.stages[0].steps[0].state).toBe("current");
    expect(path.stages[0].steps[1].state).toBe("todo");
  });

  test("una lección abierta cuenta como hecha y el actual pasa a la siguiente", () => {
    const path = resolvePath({ ...empty, lessonsRead: [PATH_STEPS[0].ref] });
    expect(path.stages[0].steps[0].state).toBe("done");
    expect(path.next?.step).toEqual(PATH_STEPS[1]);
    expect(path.done).toBe(1);
  });

  test("un ejercicio necesita intentos suficientes y acierto suficiente", () => {
    const pocos = resolvePath({ ...empty, progress: progress({ notas: exercise(MASTERY_ATTEMPTS - 1, 100) }) });
    const flojo = resolvePath({ ...empty, progress: progress({ notas: exercise(60, MASTERY_ACCURACY - 5) }) });
    const bien = resolvePath({ ...empty, progress: progress({ notas: exercise(MASTERY_ATTEMPTS, MASTERY_ACCURACY) }) });
    const stepOf = (p: ReturnType<typeof resolvePath>) =>
      p.stages.flatMap((s) => s.steps).find((s) => s.step.kind === "exercise" && s.step.ref === "notas");
    expect(stepOf(pocos)?.state).not.toBe("done");
    expect(stepOf(flojo)?.state).not.toBe("done");
    expect(stepOf(bien)?.state).toBe("done");
  });

  test("el detalle de un ejercicio empezado dice cuántas respuestas lleva y con qué acierto", () => {
    const path = resolvePath({ ...empty, progress: progress({ notas: exercise(30, 90) }) });
    const step = path.stages.flatMap((s) => s.steps).find((s) => s.step.kind === "exercise" && s.step.ref === "notas");
    expect(step?.detail).toBe("Práctica · 30 respuestas, 90% de acierto");
  });

  test("una pieza cuenta cuando está en la biblioteca, y enlaza a ella", () => {
    const pieceStep = PATH_STEPS.find((s) => s.kind === "piece")!;
    const sin = resolvePath(empty);
    const con = resolvePath({ ...empty, ownedPieces: new Map([[pieceStep.ref, "abc-123"]]) });
    const find = (p: ReturnType<typeof resolvePath>) =>
      p.stages.flatMap((s) => s.steps).find((s) => s.step.kind === "piece" && s.step.ref === pieceStep.ref);
    expect(find(sin)?.href).toBe("/scores/catalog");
    expect(find(con)?.state).toBe("done");
    expect(find(con)?.href).toBe("/scores?score=abc-123");
  });

  test("con todo hecho no queda paso actual", () => {
    const path = resolvePath({
      progress: progress(Object.fromEntries(EXERCISES.map((e) => [e.id, exercise(100, 100)]))),
      lessonsRead: ALL_LESSONS.map((l) => l.slug),
      ownedPieces: new Map(CATALOG.map((p) => [p.id, `score-${p.id}`])),
    });
    expect(path.next).toBeNull();
    expect(path.done).toBe(path.total);
  });
});
