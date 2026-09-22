import { beforeEach, describe, expect, test } from "bun:test";
import { CONFIG_LIMITS, DEFAULT_CONFIG, phaseMinutes, pomodoro } from "@/lib/pomodoro";

// Without a window the store keeps its state in memory only; the rules are the same.
describe("pomodoro", () => {
  beforeEach(() => {
    pomodoro.reset();
    pomodoro.setConfig(DEFAULT_CONFIG);
  });

  test("empieza en el primer bloque de estudio, parado", () => {
    const s = pomodoro.state();
    expect(s.phase).toBe("focus");
    expect(s.round).toBe(1);
    expect(s.startedAt).toBeNull();
    expect(s.done).toBe(0);
  });

  test("al saltar un bloque llega el descanso corto, y el largo tras la última ronda", () => {
    pomodoro.skip(); // focus 1 → break
    expect(pomodoro.state().phase).toBe("break");
    expect(pomodoro.state().round).toBe(1);
    pomodoro.skip(); // break → focus 2, waiting
    expect(pomodoro.state().phase).toBe("focus");
    expect(pomodoro.state().round).toBe(2);
    expect(pomodoro.state().startedAt).toBeNull();
    pomodoro.skip(); // focus 2 → break
    pomodoro.skip(); // break → focus 3
    pomodoro.skip(); // focus 3 → break
    pomodoro.skip(); // break → focus 4
    pomodoro.skip(); // focus 4 → long break
    expect(pomodoro.state().round).toBe(DEFAULT_CONFIG.rounds);
    expect(pomodoro.state().phase).toBe("long");
    pomodoro.skip(); // long → the cycle starts over
    expect(pomodoro.state().phase).toBe("focus");
    expect(pomodoro.state().round).toBe(1);
  });

  test("saltar un bloque no lo cuenta como hecho", () => {
    pomodoro.skip();
    expect(pomodoro.state().done).toBe(0);
  });

  test("pausar guarda lo que llevaba", () => {
    pomodoro.start();
    expect(pomodoro.state().startedAt).not.toBeNull();
    pomodoro.pause();
    expect(pomodoro.state().startedAt).toBeNull();
    expect(pomodoro.state().elapsed).toBeGreaterThanOrEqual(0);
  });

  test("los tiempos se acotan a sus límites", () => {
    pomodoro.setConfig({ focus: 500, short: 0, rounds: 3 });
    const c = pomodoro.config();
    expect(c.focus).toBe(CONFIG_LIMITS.focus.max);
    expect(c.short).toBe(CONFIG_LIMITS.short.min);
    expect(c.rounds).toBe(3);
    expect(phaseMinutes("long", c)).toBe(DEFAULT_CONFIG.long);
  });
});
