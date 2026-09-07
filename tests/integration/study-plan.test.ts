/**
 * El plan de estudio viaja con los metadatos de la partitura: se crea con ella,
 * se actualiza por PATCH (progreso de objetivos), se borra con null y vuelve en
 * la lista. Solo se valida su forma: la IA corre en el dispositivo del usuario.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as list, POST as create } from "@/app/api/scores/route";
import { GET as getOne, PATCH as patch } from "@/app/api/scores/[id]/route";
import { COOKIE } from "@/lib/server/session";

const email = `plan-${Date.now()}@opus.test`;
const password = "contraseña-muy-larga-123";
const id = crypto.randomUUID();
const ctx = (i: string) => ({ params: Promise.resolve({ id: i }) });
let cookie = "";
let dir = "";

const req = (path: string, method: string, opts: { json?: unknown; cookie?: string } = {}) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { host: "localhost", ...(opts.json !== undefined ? { "content-type": "application/json" } : {}), ...(opts.cookie ? { cookie: opts.cookie } : {}) },
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  });

function cookieOf(res: Response): string {
  const m = (res.headers.get("set-cookie") ?? "").match(new RegExp(`${COOKIE}=([^;]*)`));
  if (!m) throw new Error("sin cookie");
  return `${COOKIE}=${m[1]}`;
}

const plan = {
  title: "Minueto en Sol",
  composer: "Petzold",
  analysis: { key: "Sol mayor", scale: "Sol mayor.", timeSignature: "3/4", tempo: "♩ = 100", form: "A B", difficulty: "elemental", character: "Danza.", challenges: [] },
  prerequisites: [{ title: "Escala", description: "Sol mayor.", lesson: "escalas", exercise: null }],
  warmups: [],
  goals: [{ id: "g1", title: "MD c. 1-4", from: 1, to: 4, hands: "derecha", description: "Lento.", tips: [], fingering: "", targetTempo: "", sessions: 2 }],
  routine: { sessionMinutes: 20, weeks: 4, blocks: [], advice: "A diario." },
};
const state = { plan, progress: {}, model: "gpt-5.6-terra", createdAt: 1_700_000_000_000 };

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "opus-plan-it-"));
  process.env.SCORES_DIR = dir;
  await prisma.$connect();
  cookie = cookieOf(await register(req("/api/auth/register", "POST", { json: { name: "A", email, password } })));
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: "@opus.test" } } });
  await prisma.$disconnect();
  await rm(dir, { recursive: true, force: true });
});

describe("plan de estudio en la cuenta (integración)", () => {
  test("se crea con la partitura y vuelve en la lista y en el detalle", async () => {
    const res = await create(req("/api/scores", "POST", { json: { id, name: "Minueto", kind: "musicxml", pageCount: 16, updatedAt: 1000, plan: state }, cookie }));
    expect(res.status).toBe(201);
    expect((await res.json()).plan).toEqual(state);
    const all = await (await list(req("/api/scores", "GET", { cookie }))).json();
    expect(all.scores[0].plan.plan.title).toBe("Minueto en Sol");
  });

  test("un plan mal formado se rechaza", async () => {
    const bad = { ...state, plan: { ...plan, goals: [] } };
    expect((await patch(req(`/api/scores/${id}`, "PATCH", { json: { plan: bad, updatedAt: 2000 }, cookie }), ctx(id))).status).toBe(400);
    const lesson = { ...state, plan: { ...plan, prerequisites: [{ ...plan.prerequisites[0], lesson: "no-existe" }] } };
    expect((await patch(req(`/api/scores/${id}`, "PATCH", { json: { plan: lesson, updatedAt: 2000 }, cookie }), ctx(id))).status).toBe(400);
  });

  test("el progreso de los objetivos se actualiza por PATCH", async () => {
    const res = await patch(req(`/api/scores/${id}`, "PATCH", { json: { plan: { ...state, progress: { g1: true } }, updatedAt: 3000 }, cookie }), ctx(id));
    expect(res.status).toBe(200);
    const one = await (await getOne(req(`/api/scores/${id}`, "GET", { cookie }), ctx(id))).json();
    expect(one.plan.progress).toEqual({ g1: true });
    expect(one.updatedAt).toBe(3000);
  });

  test("un PATCH sin plan no lo toca; con null lo borra", async () => {
    await patch(req(`/api/scores/${id}`, "PATCH", { json: { notes: "hola", updatedAt: 4000 }, cookie }), ctx(id));
    expect((await (await getOne(req(`/api/scores/${id}`, "GET", { cookie }), ctx(id))).json()).plan.progress).toEqual({ g1: true });
    await patch(req(`/api/scores/${id}`, "PATCH", { json: { plan: null, updatedAt: 5000 }, cookie }), ctx(id));
    expect((await (await getOne(req(`/api/scores/${id}`, "GET", { cookie }), ctx(id))).json()).plan).toBeUndefined();
  });
});
