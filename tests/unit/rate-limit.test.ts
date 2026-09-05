import { describe, expect, test } from "bun:test";
import { clearRateLimit, clientIp, rateLimited } from "@/lib/server/rate-limit";

describe("limitador de intentos", () => {
  test("bloquea a partir del intento 11 en la ventana y se libera al pasar", () => {
    const key = "test:" + Math.random();
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) expect(rateLimited(key, t0)).toBe(false);
    expect(rateLimited(key, t0)).toBe(true);
    // Pasada la ventana (15 min) vuelve a contar desde cero.
    expect(rateLimited(key, t0 + 16 * 60 * 1000)).toBe(false);
  });

  test("clearRateLimit reinicia la cuenta", () => {
    const key = "test:" + Math.random();
    for (let i = 0; i < 11; i++) rateLimited(key, 5);
    expect(rateLimited(key, 5)).toBe(true);
    clearRateLimit(key);
    expect(rateLimited(key, 5)).toBe(false);
  });

  test("clientIp prefiere x-forwarded-for (detrás de Traefik)", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" } });
    expect(clientIp(req)).toBe("203.0.113.5");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});
