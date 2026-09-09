/**
 * El ciclo entero de un reconocimiento contra un Postgres real
 * (DATABASE_URL) y un servicio de OMR de mentira: encargar → ver cómo
 * avanza → recoger el MusicXML → quitarlo de en medio. Y lo que importa de
 * verdad: que el encargo siga adelante sin nadie mirando y que solo lo pare
 * quien lo cancela.
 *
 * Se ejecuta con `bun run test:integration`; localmente necesita la base de
 * datos del compose.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as listJobs, POST as createJob } from "@/app/api/transcriptions/route";
import { DELETE as removeJob, GET as getJob } from "@/app/api/transcriptions/[id]/route";
import { GET as getXml } from "@/app/api/transcriptions/[id]/xml/route";
import { COOKIE } from "@/lib/server/session";
import type { TranscriptionJob } from "@/lib/omr/shared";

const email = `omr-${Date.now()}-${Math.random().toString(36).slice(2)}@opus.test`;
const scoreId = crypto.randomUUID();

const musicxml = (page: number) =>
  `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="${page}"><attributes><divisions>1</divisions></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure></part></score-partwise>`;

/** Cuánto tarda el servicio falso en «reconocer» una página. */
const PAGE_MS = 150;

let service: ReturnType<typeof Bun.serve>;
let cookie: string;
let dir: string;
let userId: string;
/** Peticiones que ha recibido el servicio falso: delatan si algo siguió corriendo. */
let seen = 0;
/** Cuando está puesto, el servicio se queda colgado en vez de responder. */
let stall = false;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "opus-omr-"));
  process.env.SCORES_DIR = dir;

  service = Bun.serve({
    port: 0,
    async fetch(req) {
      if (!req.url.endsWith("/v1/transcribe")) return new Response("no", { status: 404 });
      seen++;
      const mine = seen;
      await Bun.sleep(stall ? 60_000 : PAGE_MS);
      return Response.json({ musicxml: musicxml(mine), seconds: 1 });
    },
  });
  process.env.OMR_URL = `http://localhost:${service.port}`;
  process.env.OMR_TOKEN = "";

  await prisma.$connect();
  const res = await register(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost" },
      body: JSON.stringify({ email, password: "contraseña-muy-larga-123", name: "OMR" }),
    }),
  );
  expect(res.status).toBe(201);
  const set = res.headers.get("set-cookie") ?? "";
  cookie = `${COOKIE}=${new RegExp(`${COOKIE}=([^;]*)`).exec(set)?.[1] ?? ""}`;
  userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
});

afterAll(async () => {
  service?.stop(true);
  await prisma.user.deleteMany({ where: { email: { endsWith: "@opus.test" } } });
  await prisma.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

/** Un PNG mínimo de verdad: la ruta solo comprueba que sea un archivo con bytes. */
const png = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])], { type: "image/png" });

function post(pages: number): Request {
  const body = new FormData();
  body.append("scoreId", scoreId);
  body.append("scoreName", "Sonata de prueba");
  body.append("fromPage", "3");
  for (let i = 0; i < pages; i++) body.append("pages", png(), `p${i + 1}.png`);
  return new Request("http://localhost/api/transcriptions", { method: "POST", body, headers: { host: "localhost", cookie } });
}

const get = (path: string) => new Request(`http://localhost${path}`, { headers: { host: "localhost", cookie } });
const del = (path: string) => new Request(`http://localhost${path}`, { method: "DELETE", headers: { host: "localhost", cookie } });

const params = (id: string) => ({ params: Promise.resolve({ id }) });

/** Espera a que el encargo llegue a un estado final (o se agote la paciencia). */
async function settle(id: string, tries = 60): Promise<TranscriptionJob> {
  for (let i = 0; i < tries; i++) {
    const res = await getJob(get(`/api/transcriptions/${id}`), params(id));
    const { job } = (await res.json()) as { job: TranscriptionJob };
    if (job.status === "done" || job.status === "error") return job;
    await Bun.sleep(100);
  }
  throw new Error("el reconocimiento no ha terminado");
}

describe("reconocimiento en el servidor", () => {
  test("hace falta cuenta", async () => {
    const res = await createJob(new Request("http://localhost/api/transcriptions", { method: "POST", headers: { host: "localhost" } }));
    expect(res.status).toBe(401);
  });

  test("encarga, sigue solo y guarda el MusicXML de cada página", async () => {
    const created = await createJob(post(2));
    expect(created.status).toBe(201);
    const { job } = (await created.json()) as { job: TranscriptionJob };
    expect(job.pages).toBe(2);
    expect(job.fromPage).toBe(3);
    expect(job.scoreId).toBe(scoreId);
    expect(job.status).toBe("pending");

    // nadie mira: el trabajo avanza igual
    const done = await settle(job.id);
    expect(done.status).toBe("done");
    expect(done.donePages).toBe(2);

    const xml = await getXml(get(`/api/transcriptions/${job.id}/xml`), params(job.id));
    const { pages } = (await xml.json()) as { pages: string[] };
    expect(pages).toHaveLength(2);
    for (const page of pages) expect(page).toContain("<score-partwise");

    // al recogerlo se quita del servidor, con sus archivos
    expect(existsSync(join(dir, userId, "omr", job.id))).toBe(true);
    expect((await removeJob(del(`/api/transcriptions/${job.id}`), params(job.id))).status).toBe(200);
    expect((await getJob(get(`/api/transcriptions/${job.id}`), params(job.id))).status).toBe(404);
    expect(existsSync(join(dir, userId, "omr", job.id))).toBe(false);
    const after = await listJobs(get("/api/transcriptions"));
    expect(((await after.json()) as { jobs: TranscriptionJob[] }).jobs).toHaveLength(0);
  });

  test("al volver, la lista dice lo que hay a medio hacer", async () => {
    const created = await createJob(post(1));
    const { job } = (await created.json()) as { job: TranscriptionJob };

    const res = await listJobs(get("/api/transcriptions"));
    const { jobs } = (await res.json()) as { jobs: TranscriptionJob[] };
    expect(jobs.map((j) => j.id)).toContain(job.id);
    expect(jobs[0].scoreName).toBe("Sonata de prueba");

    await settle(job.id);
    await removeJob(del(`/api/transcriptions/${job.id}`), params(job.id));
  });

  test("solo una partitura a la vez", async () => {
    stall = true;
    const first = await createJob(post(1));
    const { job } = (await first.json()) as { job: TranscriptionJob };

    const second = await createJob(post(1));
    expect(second.status).toBe(409);

    // cancelar a mano lo para y lo borra, y entonces sí se puede encargar otro
    expect((await removeJob(del(`/api/transcriptions/${job.id}`), params(job.id))).status).toBe(200);
    stall = false;
    const third = await createJob(post(1));
    expect(third.status).toBe(201);
    const { job: last } = (await third.json()) as { job: TranscriptionJob };
    await settle(last.id);
    await removeJob(del(`/api/transcriptions/${last.id}`), params(last.id));
  });

  test("no se aceptan más páginas de la cuenta", async () => {
    const res = await createJob(post(9));
    expect(res.status).toBe(400);
  });
});
