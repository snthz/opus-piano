/**
 * Flujo completo contra un Postgres real (DATABASE_URL): registro → sesión →
 * progreso → cierre de sesión → borrado de cuenta. Se ejecuta en CI con
 * `bun run test:integration`; localmente necesita la base de datos del compose.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { prisma } from "@/lib/db";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { DELETE as deleteAccount } from "@/app/api/auth/account/route";
import { GET as getProgress, DELETE as deleteProgress } from "@/app/api/progress/route";
import { POST as postAnswers } from "@/app/api/progress/answers/route";
import { COOKIE } from "@/lib/server/session";
import { findOrCreateOAuthUser } from "@/lib/server/oauth";

const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@opus.test`;
const password = "contraseña-muy-larga-123";

const json = (path: string, method: string, body?: unknown, cookie?: string) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      host: "localhost",
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** Extrae `opus_session=…` de Set-Cookie para reenviarla en la siguiente petición. */
function cookieOf(res: Response): string {
  const set = res.headers.get("set-cookie") ?? "";
  const m = set.match(new RegExp(`${COOKIE}=([^;]*)`));
  if (!m) throw new Error("La respuesta no trae cookie de sesión");
  return `${COOKIE}=${m[1]}`;
}

beforeAll(async () => {
  await prisma.$connect();
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: "@opus.test" } } });
  await prisma.$disconnect();
});

describe("cuentas y progreso (integración)", () => {
  let cookie = "";

  test("registro: crea la cuenta, devuelve el usuario y abre sesión", async () => {
    const res = await register(json("/api/auth/register", "POST", { name: " Ana  Prueba ", email: email.toUpperCase(), password }));
    expect(res.status).toBe(201);
    const user = await res.json();
    expect(user).toMatchObject({ name: "Ana Prueba", email });
    expect(user.passwordHash).toBeUndefined();
    cookie = cookieOf(res);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
  });

  test("registro repetido con el mismo correo → 409", async () => {
    const res = await register(json("/api/auth/register", "POST", { name: "Otra", email, password }));
    expect(res.status).toBe(409);
  });

  test("registro con datos inválidos → 400", async () => {
    expect((await register(json("/api/auth/register", "POST", { name: "x", email: "no-es-correo", password }))).status).toBe(400);
    expect((await register(json("/api/auth/register", "POST", { name: "x", email: "a@b.co", password: "corta" }))).status).toBe(400);
    expect((await register(json("/api/auth/register", "POST", { email: "a@b.co", password }))).status).toBe(400);
  });

  test("/me devuelve el usuario con la cookie y 401 sin ella", async () => {
    expect((await me(json("/api/auth/me", "GET", undefined, cookie))).status).toBe(200);
    expect((await me(json("/api/auth/me", "GET"))).status).toBe(401);
    expect((await me(json("/api/auth/me", "GET", undefined, `${COOKIE}=tokenInventadoQueNoExiste1234`))).status).toBe(401);
  });

  test("las respuestas se acumulan y el progreso vuelve agregado", async () => {
    const day = "2026-09-05";
    const answers = [
      { exerciseId: "notas", correct: true, streak: 1, day, at: "2026-09-05T10:00:00Z" },
      { exerciseId: "notas", correct: true, streak: 2, day, at: "2026-09-05T10:00:05Z" },
      { exerciseId: "notas", correct: false, streak: 0, day, at: "2026-09-05T10:00:10Z" },
      { exerciseId: "ritmo", correct: true, streak: 1, day: "2026-09-04", at: "2026-09-04T09:00:00Z" },
    ];
    const res = await postAnswers(json("/api/progress/answers", "POST", { answers }, cookie));
    expect(res.status).toBe(200);
    const map = await res.json();
    expect(map.notas).toMatchObject({ attempts: 3, correct: 2, bestStreak: 2 });
    expect(map.notas.days[day]).toEqual({ attempts: 3, correct: 2 });
    expect(map.ritmo).toMatchObject({ attempts: 1, correct: 1 });

    // Un segundo lote se suma al anterior y la mejor racha no baja.
    const res2 = await postAnswers(
      json("/api/progress/answers", "POST", { answers: [{ exerciseId: "notas", correct: true, streak: 1, day, at: "2026-09-05T11:00:00Z" }] }, cookie),
    );
    const map2 = await res2.json();
    expect(map2.notas).toMatchObject({ attempts: 4, correct: 3, bestStreak: 2 });
    expect(map2.notas.days[day]).toEqual({ attempts: 4, correct: 3 });
  });

  test("respuestas mal formadas → 400 y sin sesión → 401", async () => {
    const bad = await postAnswers(json("/api/progress/answers", "POST", { answers: [{ exerciseId: "notas" }] }, cookie));
    expect(bad.status).toBe(400);
    const anon = await postAnswers(json("/api/progress/answers", "POST", { answers: [] }));
    expect(anon.status).toBe(401);
  });

  test("otra cuenta no ve el progreso de la primera", async () => {
    const other = await register(json("/api/auth/register", "POST", { name: "B", email: `b-${email}`, password }));
    const otherCookie = cookieOf(other);
    const res = await getProgress(json("/api/progress", "GET", undefined, otherCookie));
    expect(await res.json()).toEqual({});
  });

  test("inicio de sesión: correcto, contraseña errónea y correo inexistente", async () => {
    const ok = await login(json("/api/auth/login", "POST", { email, password }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).email).toBe(email);
    expect((await login(json("/api/auth/login", "POST", { email, password: "otra-contraseña" }))).status).toBe(401);
    expect((await login(json("/api/auth/login", "POST", { email: "nadie@opus.test", password }))).status).toBe(401);
  });

  test("peticiones desde otro origen se rechazan (CSRF)", async () => {
    const req = new Request("http://localhost/api/progress/answers", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost", origin: "https://evil.example", cookie },
      body: JSON.stringify({ answers: [] }),
    });
    expect((await postAnswers(req)).status).toBe(403);
  });

  test("borrar progreso deja el mapa vacío", async () => {
    expect((await deleteProgress(json("/api/progress", "DELETE", undefined, cookie))).status).toBe(204);
    expect(await (await getProgress(json("/api/progress", "GET", undefined, cookie))).json()).toEqual({});
  });

  test("cerrar sesión invalida la cookie", async () => {
    const res = await logout(json("/api/auth/logout", "POST", undefined, cookie));
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    expect((await me(json("/api/auth/me", "GET", undefined, cookie))).status).toBe(401);
  });

  test("Google: crea cuenta sin contraseña, reutiliza la identidad y vincula por correo verificado", async () => {
    const sub = `sub-${Date.now()}`;
    const created = await findOrCreateOAuthUser({ provider: "google", providerAccountId: sub, email: `g-${email}`, emailVerified: true, name: "Gabi Google" });
    expect(created.name).toBe("Gabi Google");
    const again = await findOrCreateOAuthUser({ provider: "google", providerAccountId: sub, email: "otro@opus.test", emailVerified: true, name: null });
    expect(again.id).toBe(created.id);
    // Sin contraseña no se puede entrar por el formulario.
    expect((await login(json("/api/auth/login", "POST", { email: `g-${email}`, password }))).status).toBe(401);
    // Correo verificado que ya tiene cuenta con contraseña: se vincula a esa cuenta.
    const linked = await findOrCreateOAuthUser({ provider: "google", providerAccountId: `other-${sub}`, email, emailVerified: true, name: null });
    expect(linked.email).toBe(email);
    // Sin verificar, no se vincula a una cuenta ajena.
    await expect(
      findOrCreateOAuthUser({ provider: "google", providerAccountId: `x-${sub}`, email, emailVerified: false, name: null }),
    ).rejects.toThrow();
    // Borrar una cuenta sin contraseña no la pide.
    const me2 = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(me2.passwordHash).toBeNull();
  });

  test("borrar la cuenta exige la contraseña y elimina todo", async () => {
    const fresh = cookieOf(await login(json("/api/auth/login", "POST", { email, password })));
    expect((await deleteAccount(json("/api/auth/account", "DELETE", { password: "mal" }, fresh))).status).toBe(403);
    expect((await deleteAccount(json("/api/auth/account", "DELETE", { password }, fresh))).status).toBe(204);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect((await login(json("/api/auth/login", "POST", { email, password }))).status).toBe(401);
  });
});
