/**
 * Biblioteca de partituras contra Postgres real y un directorio temporal:
 * crear → subir archivo → listar → descargar → editar → MusicXML → borrar,
 * más cuota y aislamiento entre usuarios.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as list, POST as create } from "@/app/api/scores/route";
import { GET as getOne, PATCH as patch, DELETE as remove } from "@/app/api/scores/[id]/route";
import { GET as getFile, PUT as putFile } from "@/app/api/scores/[id]/file/route";
import { GET as getXml, PUT as putXml, DELETE as unlinkXml } from "@/app/api/scores/[id]/xml/route";
import { COOKIE } from "@/lib/server/session";

const email = `scores-${Date.now()}@opus.test`;
const password = "contraseña-muy-larga-123";
const id = crypto.randomUUID();
const ctx = (i: string) => ({ params: Promise.resolve({ id: i }) });
let cookie = "";
let otherCookie = "";
let dir = "";

const req = (path: string, method: string, opts: { json?: unknown; body?: BodyInit; cookie?: string; headers?: Record<string, string> } = {}) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: {
      host: "localhost",
      ...(opts.json !== undefined ? { "content-type": "application/json" } : {}),
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
  });

function cookieOf(res: Response): string {
  const m = (res.headers.get("set-cookie") ?? "").match(new RegExp(`${COOKIE}=([^;]*)`));
  if (!m) throw new Error("sin cookie");
  return `${COOKIE}=${m[1]}`;
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "opus-scores-it-"));
  process.env.SCORES_DIR = dir;
  process.env.SCORES_QUOTA_MB = "1";
  await prisma.$connect();
  cookie = cookieOf(await register(req("/api/auth/register", "POST", { json: { name: "A", email, password } })));
  otherCookie = cookieOf(await register(req("/api/auth/register", "POST", { json: { name: "B", email: `b-${email}`, password } })));
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: "@opus.test" } } });
  await prisma.$disconnect();
  await rm(dir, { recursive: true, force: true });
});

const meta = { id, name: "Clair de lune", kind: "pdf", notes: "", pageCount: 3, thumbnail: "data:image/png;base64,AAAA", updatedAt: 1000 };

describe("biblioteca de partituras (integración)", () => {
  test("sin sesión → 401", async () => {
    expect((await list(req("/api/scores", "GET"))).status).toBe(401);
  });

  test("crear metadatos: aparece en la lista como no subida", async () => {
    const res = await create(req("/api/scores", "POST", { json: meta, cookie }));
    expect(res.status).toBe(201);
    const body = await (await list(req("/api/scores", "GET", { cookie }))).json();
    expect(body.scores).toHaveLength(1);
    expect(body.scores[0]).toMatchObject({ id, name: "Clair de lune", uploaded: false, updatedAt: 1000 });
    expect(body.quota).toBe(1024 * 1024);
  });

  test("metadatos inválidos → 400", async () => {
    expect((await create(req("/api/scores", "POST", { json: { ...meta, id: "no-uuid" }, cookie }))).status).toBe(400);
    expect((await create(req("/api/scores", "POST", { json: { ...meta, kind: "midi" }, cookie }))).status).toBe(400);
  });

  test("subir el archivo y descargarlo igual", async () => {
    const pdf = "%PDF-1.4 contenido de prueba";
    const res = await putFile(req(`/api/scores/${id}/file`, "PUT", { body: pdf, cookie, headers: { "content-length": String(pdf.length) } }), ctx(id));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ uploaded: true, size: pdf.length });
    const dl = await getFile(req(`/api/scores/${id}/file`, "GET", { cookie }), ctx(id));
    expect(dl.status).toBe(200);
    expect(dl.headers.get("content-type")).toBe("application/pdf");
    expect(await dl.text()).toBe(pdf);
  });

  test("la cuota se respeta", async () => {
    const big = "x".repeat(1024 * 1024 + 10);
    const res = await putFile(req(`/api/scores/${id}/file`, "PUT", { body: big, cookie, headers: { "content-length": String(big.length) } }), ctx(id));
    expect(res.status).toBe(507);
  });

  test("editar nombre, notas y trazos; una versión más vieja no pisa la nueva", async () => {
    const annotations = { "1": [{ color: "#f00", width: 0.01, points: [[0.1, 0.2], [0.3, 0.4]] }] };
    const res = await patch(req(`/api/scores/${id}`, "PATCH", { json: { name: "Debussy", notes: "lento", annotations, updatedAt: 2000 }, cookie }), ctx(id));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "Debussy", notes: "lento", annotations, updatedAt: 2000 });
    const stale = await patch(req(`/api/scores/${id}`, "PATCH", { json: { name: "Viejo", updatedAt: 1500 }, cookie }), ctx(id));
    expect((await stale.json()).name).toBe("Debussy");
  });

  test("MusicXML vinculado: subir, leer y desvincular", async () => {
    const xml = "<score-partwise/>";
    expect((await putXml(req(`/api/scores/${id}/xml`, "PUT", { body: xml, cookie, headers: { "content-length": String(xml.length) } }), ctx(id))).status).toBe(200);
    const got = await getXml(req(`/api/scores/${id}/xml`, "GET", { cookie }), ctx(id));
    expect(await got.text()).toBe(xml);
    expect((await (await getOne(req(`/api/scores/${id}`, "GET", { cookie }), ctx(id))).json()).hasXml).toBe(true);
    expect((await unlinkXml(req(`/api/scores/${id}/xml`, "DELETE", { cookie }), ctx(id))).status).toBe(200);
    expect((await getXml(req(`/api/scores/${id}/xml`, "GET", { cookie }), ctx(id))).status).toBe(404);
  });

  test("otro usuario no la ve, no la descarga y no la borra", async () => {
    expect((await getOne(req(`/api/scores/${id}`, "GET", { cookie: otherCookie }), ctx(id))).status).toBe(404);
    expect((await getFile(req(`/api/scores/${id}/file`, "GET", { cookie: otherCookie }), ctx(id))).status).toBe(404);
    expect((await create(req("/api/scores", "POST", { json: meta, cookie: otherCookie }))).status).toBe(409);
    await remove(req(`/api/scores/${id}`, "DELETE", { cookie: otherCookie }), ctx(id));
    expect((await getOne(req(`/api/scores/${id}`, "GET", { cookie }), ctx(id))).status).toBe(200);
  });

  test("borrar elimina la fila y el archivo", async () => {
    expect((await remove(req(`/api/scores/${id}`, "DELETE", { cookie }), ctx(id))).status).toBe(204);
    expect((await getOne(req(`/api/scores/${id}`, "GET", { cookie }), ctx(id))).status).toBe(404);
    expect((await getFile(req(`/api/scores/${id}/file`, "GET", { cookie }), ctx(id))).status).toBe(404);
    expect((await (await list(req("/api/scores", "GET", { cookie }))).json()).used).toBe(0);
  });
});
