/**
 * El modo espera: qué se espera del alumno en cada instante de la partitura.
 */
import { describe, expect, test } from "bun:test";
import { followSteps } from "@/components/scores/use-score-player";
import type { ScoreTimelineNote } from "@/lib/music/musicxml";

const note = (midi: number, start: number, staff: number, silent = false): ScoreTimelineNote => ({
  midis: [midi],
  start,
  beats: 1,
  refs: [{ staff, index: 0 }],
  ...(silent ? { silent: true } : {}),
});

describe("followSteps", () => {
  test("lo que ataca a la vez es un solo paso", () => {
    const steps = followSteps([note(60, 0, 0), note(48, 0, 1), note(62, 1, 0)], []);
    expect(steps).toHaveLength(2);
    expect(steps[0].expected).toEqual([48, 60]);
    expect(steps[1].expected).toEqual([62]);
  });

  test("van en orden aunque la línea de tiempo no lo esté", () => {
    const steps = followSteps([note(64, 2, 0), note(60, 0, 0)], []);
    expect(steps.map((s) => s.start)).toEqual([0, 2]);
  });

  test("con una mano callada, esa es la que toca el alumno y la otra acompaña", () => {
    // La derecha suena (no es «silent»), la izquierda la toca el alumno.
    const steps = followSteps([note(60, 0, 0), note(48, 0, 1, true)], [1]);
    expect(steps[0].expected).toEqual([48]);
    expect(steps[0].accompaniment).toEqual([60]);
  });

  test("un acorde sin nada que tocar no es un paso", () => {
    // Si en ese instante solo suena la mano de la app, no hay nada que esperar.
    const steps = followSteps([note(60, 0, 0), note(48, 1, 1, true)], [1]);
    expect(steps).toHaveLength(1);
    expect(steps[0].start).toBe(1);
  });

  test("una nota repetida en las dos manos se espera una sola vez", () => {
    const steps = followSteps([note(60, 0, 0), note(60, 0, 1)], []);
    expect(steps[0].expected).toEqual([60]);
  });

  test("sin notas no hay pasos", () => {
    expect(followSteps([], [])).toEqual([]);
  });
});
