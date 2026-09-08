/**
 * La configuración del profesor son las tres perillas con las que quien
 * despliega controla su factura: si hay clave, qué modelo se usa y cuántos
 * planes cabe pedir. Se leen en cada petición, no al arrancar, porque en
 * producción llegan por entorno y no por el build.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { askLimit, planEnabled, planLimit, planModel } from "@/lib/server/study-plan";

const KEYS = ["ANTHROPIC_API_KEY", "STUDY_PLAN_MODEL", "PLANS_PER_DAY", "PLAN_QUESTIONS_PER_HOUR"] as const;

// También antes: bun carga el `.env` del proyecto, y en la máquina de quien
// desarrolla suele haber una clave de verdad que haría pasar el primer caso.
beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("configuración del plan de estudio", () => {
  test("sin clave de API, la función queda desactivada", () => {
    expect(planEnabled()).toBe(false);
    // Una variable puesta pero vacía (docker compose con `${VAR:-}`) es lo mismo que no ponerla.
    process.env.ANTHROPIC_API_KEY = "   ";
    expect(planEnabled()).toBe(false);
    process.env.ANTHROPIC_API_KEY = "sk-ant-loquesea";
    expect(planEnabled()).toBe(true);
  });

  test("el modelo por defecto es Sonnet y se puede cambiar por entorno", () => {
    expect(planModel()).toBe("claude-sonnet-5");
    process.env.STUDY_PLAN_MODEL = "claude-opus-5";
    expect(planModel()).toBe("claude-opus-5");
  });

  test("los límites tienen valores por defecto y se leen del entorno", () => {
    expect(planLimit()).toEqual({ max: 3, windowMs: 24 * 60 * 60 * 1000 });
    expect(askLimit()).toEqual({ max: 40, windowMs: 60 * 60 * 1000 });
    process.env.PLANS_PER_DAY = "10";
    process.env.PLAN_QUESTIONS_PER_HOUR = "5";
    expect(planLimit().max).toBe(10);
    expect(askLimit().max).toBe(5);
  });
});
