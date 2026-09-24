/**
 * Rutas de estudio contra Postgres real: crear, listar, la versión más nueva
 * gana, aislamiento entre usuarios y borrado. El estado de las partituras
 * viaja con sus metadatos y se comprueba aquí también.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { prisma } from "@/lib/db";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as list, POST as upsert } from "@/app/api/routes/route";
import { GET as getOne, DELETE as remove } from "@/app/api/routes/[id]/route";
import { POST as createScore } from "@/app/api/scores/route";
import { GET as getScore, PATCH as patchScore } from "@/app/api/scores/[id]/route";
import { COOKIE } from "@/lib/server/session";
import { newPiece, newRoute } from "@/lib/study-route";

const email = `routes-${Date.now()}@opus.test`;
const password = "contraseña-muy-larga-123";
const ctx = (i: string) => ({ params: Promise.resolve({ id: i }) });
let cookie = "";
let otherCookie = "";

// Registrations are rate limited per IP, in memory, across the whole test
// process: this file signs up from its own address so it doesn't eat the
// allowance of the files that run after it.
const req = (path: string, method: string, opts: { json?: unknown; cookie?: string } = {}) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      host: "localhost",
      "x-forwarded-for": "10.0.0.42",
      ...(opts.json !== undefined ? { "content-type": "application/json" } : {}),
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  });

function cookieOf(res: Response): string {
  const m = (res.headers.get("set-cookie") ?? "").match(new RegExp(`${COOKIE}=([^;]*)`));
  if (!m) throw new Error("sin cookie");
  return `${COOKIE}=${m[1]}`;
}

beforeAll(async () => {
  await prisma.$connect();
  cookie = cookieOf(await register(req("/api/auth/register", "POST", { json: { name: "A", email, password } })));
  otherCookie = cookieOf(await register(req("/api/auth/register", "POST", { json: { name: "B", email: `b-${email}`, password } })));
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: "@opus.test" } } });
  await prisma.$disconnect();
});

const route = newRoute({ name: "Mi ruta", pieces: [newPiece({ id: "p1", title: "Minueto" })] }, 1000);
const body = (r: typeof route) => ({ id: r.id, data: r, updatedAt: r.updatedAt });

describe("rutas de estudio (integración)", () => {
  test("sin sesión → 401", async () => {
    expect((await list(req("/api/routes", "GET"))).status).toBe(401);
  });

  test("crear y listar", async () => {
    expect((await upsert(req("/api/routes", "POST", { json: body(route), cookie }))).status).toBe(201);
    const { routes } = await (await list(req("/api/routes", "GET", { cookie }))).json();
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ id: route.id, updatedAt: 1000 });
    expect(routes[0].data.pieces[0].title).toBe("Minueto");
  });

  test("datos inválidos → 400", async () => {
    expect((await upsert(req("/api/routes", "POST", { json: { ...body(route), data: { ...route, name: "" } }, cookie }))).status).toBe(400);
    expect((await upsert(req("/api/routes", "POST", { json: { ...body(route), id: "otro" }, cookie }))).status).toBe(400);
  });

  test("gana la versión más nueva; una más vieja devuelve la guardada", async () => {
    const newer = { ...route, name: "Renombrada", updatedAt: 2000 };
    expect((await (await upsert(req("/api/routes", "POST", { json: body(newer), cookie }))).json()).data.name).toBe("Renombrada");
    const stale = { ...route, name: "Vieja", updatedAt: 1500 };
    const res = await upsert(req("/api/routes", "POST", { json: body(stale), cookie }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.name).toBe("Renombrada");
  });

  test("otro usuario no la ve ni la pisa", async () => {
    expect((await getOne(req(`/api/routes/${route.id}`, "GET", { cookie: otherCookie }), ctx(route.id))).status).toBe(404);
    expect((await upsert(req("/api/routes", "POST", { json: body({ ...route, updatedAt: 9000 }), cookie: otherCookie }))).status).toBe(409);
    await remove(req(`/api/routes/${route.id}`, "DELETE", { cookie: otherCookie }), ctx(route.id));
    expect((await getOne(req(`/api/routes/${route.id}`, "GET", { cookie }), ctx(route.id))).status).toBe(200);
  });

  test("borrar", async () => {
    expect((await remove(req(`/api/routes/${route.id}`, "DELETE", { cookie }), ctx(route.id))).status).toBe(204);
    expect((await getOne(req(`/api/routes/${route.id}`, "GET", { cookie }), ctx(route.id))).status).toBe(404);
  });
});

describe("estado de la partitura (integración)", () => {
  const id = crypto.randomUUID();
  const meta = { id, name: "Pastorale", kind: "pdf", notes: "", pageCount: 2, thumbnail: "", updatedAt: 1000 };

  test("sin estado se guarda como null; con estado vuelve tal cual", async () => {
    const created = await (await createScore(req("/api/scores", "POST", { json: meta, cookie }))).json();
    expect(created.status).toBeNull();
    const patched = await (await patchScore(req(`/api/scores/${id}`, "PATCH", { json: { status: "studying", updatedAt: 2000 }, cookie }), ctx(id))).json();
    expect(patched.status).toBe("studying");
    expect((await (await getScore(req(`/api/scores/${id}`, "GET", { cookie }), ctx(id))).json()).status).toBe("studying");
  });

  test("un estado desconocido → 400", async () => {
    expect((await patchScore(req(`/api/scores/${id}`, "PATCH", { json: { status: "mastered", updatedAt: 3000 }, cookie }), ctx(id))).status).toBe(400);
  });
});
