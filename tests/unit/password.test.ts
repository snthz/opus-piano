import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "@/lib/server/password";

describe("contraseñas (scrypt)", () => {
  test("acepta la contraseña correcta y rechaza las demás", async () => {
    const hash = await hashPassword("correcto caballo batería grapa");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correcto caballo batería grapa", hash)).toBe(true);
    expect(await verifyPassword("correcto caballo bateria grapa", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  test("dos hashes de la misma contraseña son distintos (sal aleatoria)", async () => {
    const a = await hashPassword("secreto123");
    const b = await hashPassword("secreto123");
    expect(a).not.toBe(b);
    expect(await verifyPassword("secreto123", a)).toBe(true);
    expect(await verifyPassword("secreto123", b)).toBe(true);
  });

  test("un hash corrupto o de otro formato no valida", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$algo")).toBe(false);
    expect(await verifyPassword("x", "scrypt$16384$8$1$$")).toBe(false);
  });
});
