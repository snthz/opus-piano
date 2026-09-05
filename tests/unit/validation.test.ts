import { describe, expect, test } from "bun:test";
import { firstIssue, loginSchema, registerSchema, PASSWORD_MIN } from "@/lib/validation";

const valid = { name: "Ana", email: "ana@ejemplo.com", password: "a".repeat(PASSWORD_MIN) };

describe("esquemas de cuenta (zod)", () => {
  test("registro válido: normaliza correo y nombre", () => {
    const r = registerSchema.safeParse({ ...valid, name: "  Ana   María ", email: " Ana@Ejemplo.COM " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ name: "Ana María", email: "ana@ejemplo.com", password: valid.password });
  });

  test("rechaza correos mal formados", () => {
    for (const bad of ["", "ana", "ana@", "@ejemplo.com", "a b@ejemplo.com", 42, null, undefined]) {
      const r = registerSchema.safeParse({ ...valid, email: bad });
      expect(r.success).toBe(false);
      if (!r.success) expect(firstIssue(r)).toMatch(/correo/i);
    }
  });

  test("nombre vacío o demasiado largo", () => {
    expect(registerSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, name: "x".repeat(61) }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, name: 7 }).success).toBe(false);
  });

  test("contraseña: longitud mínima y máxima, con mensaje en español", () => {
    const short = registerSchema.safeParse({ ...valid, password: "a".repeat(PASSWORD_MIN - 1) });
    expect(short.success).toBe(false);
    if (!short.success) expect(firstIssue(short)).toContain(`${PASSWORD_MIN}`);
    expect(registerSchema.safeParse({ ...valid, password: "a".repeat(201) }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: undefined }).success).toBe(false);
  });

  test("login: solo exige correo válido y contraseña no vacía", () => {
    expect(loginSchema.safeParse({ email: "ana@ejemplo.com", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "ana@ejemplo.com", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "ana", password: "x" }).success).toBe(false);
  });
});
