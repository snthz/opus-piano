import { describe, expect, test } from "bun:test";
import { costMicros, monthKey, readUsage } from "@/lib/server/ai-budget";

describe("coste de una llamada al modelo", () => {
  test("un token de entrada cuesta tantos microdólares como dólares por millón vale el modelo", () => {
    // Sonnet 5: 2 $/M de entrada, 10 $/M de salida.
    expect(costMicros("claude-sonnet-5", { inputTokens: 1, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(2);
    expect(costMicros("claude-sonnet-5", { inputTokens: 0, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(10);
    // Un millón de tokens de entrada son 2 $ = 2 000 000 de microdólares.
    expect(costMicros("claude-sonnet-5", { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })).toBe(2_000_000);
  });

  test("la caché se cobra a una décima al leer y a 1,25 al escribir", () => {
    const read = costMicros("claude-sonnet-5", { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1000, cacheWriteTokens: 0 });
    const write = costMicros("claude-sonnet-5", { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 1000 });
    expect(read).toBe(200); // 1000 × 2 × 0,1
    expect(write).toBe(2500); // 1000 × 2 × 1,25
  });

  test("un análisis típico sale por céntimos, no por dólares", () => {
    // Doce páginas a 1568 px rondan los 25 000 tokens de entrada.
    const micros = costMicros("claude-sonnet-5", { inputTokens: 25_000, outputTokens: 4_000, cacheReadTokens: 0, cacheWriteTokens: 0 });
    expect(micros).toBe(90_000); // 0,09 $
  });

  test("un modelo que no está en la tabla se cobra al precio más caro, no gratis", () => {
    const unknown = costMicros("claude-loquesea-9", { inputTokens: 1000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    const priciest = costMicros("claude-fable-5-1", { inputTokens: 1000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
    expect(unknown).toBe(priciest);
    expect(unknown).toBeGreaterThan(0);
  });

  test("readUsage aplana los nulos de la caché", () => {
    expect(readUsage({ input_tokens: 10, output_tokens: 3, cache_read_input_tokens: null, cache_creation_input_tokens: null } as never)).toEqual({
      inputTokens: 10,
      outputTokens: 3,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    expect(readUsage(undefined)).toEqual({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
  });

  test("el mes se agrupa por año-mes en UTC", () => {
    expect(monthKey(new Date("2026-09-09T23:30:00Z"))).toBe("2026-09");
    expect(monthKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
  });
});
