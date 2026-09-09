"use client";

import { buildMusicXml } from "@/lib/music/musicxml-build";
import { parseMusicXml, type ParsedScore } from "@/lib/music/musicxml";
import { getPageSize, renderPage } from "@/lib/pdf-thumbnail";
import { UserError } from "@/lib/user-error";
import { mergePages } from "./merge";
import { MAX_OMR_PAGES, transcriptionProgress, type TranscriptionJob } from "./shared";

/**
 * Reconocimiento de partituras (OMR) visto desde el navegador.
 *
 * El navegador hace solo lo que el servidor no puede: rasterizar las páginas
 * del PDF (que nunca sale entero del dispositivo) y, al final, montar el
 * MusicXML de todas ellas. Lo lento —pasar cada página por oemer, minutos de
 * CPU— es un encargo al servidor, que sigue adelante aunque se cierre la
 * pestaña; aquí solo se pregunta cómo va.
 *
 * Lo que vuelve es MusicXML de verdad, pero puede traer cosas que Opus Piano
 * no dibuja (más de dos pentagramas, varias voces), así que se lee y se
 * reescribe con el lector y el escritor de la app para hablar un solo
 * dialecto.
 */

export { MAX_OMR_PAGES };
export type { TranscriptionJob };

/** Ancho al que se rasteriza cada página: oemer reescala a ~3,6 Mpx, y esto es un A4 a 200 ppp. */
const RENDER_WIDTH = 1700;

/** Cada cuánto se pregunta al servidor cómo va. */
const POLL_MS = 4000;

export interface OmrOutcome {
  /** MusicXML listo para vincular a la partitura. */
  xml: string;
  score: ParsedScore;
  warnings: string[];
  pages: number;
  engine: string;
  /** El encargo del que salió, para poder quitarlo del servidor al recogerlo. */
  jobId: string;
}

export interface TranscribeInput {
  /** Partitura de la biblioteca a la que pertenece. */
  scoreId: string;
  scoreName: string;
  pdf: Blob;
  /** Primera y última página del PDF, las dos incluidas. */
  from: number;
  to: number;
  onStatus?: (text: string) => void;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** Si el servidor lo tiene configurado (OMR_URL). */
export async function omrAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/omr", { cache: "no-store" });
    if (!res.ok) return false;
    return !!((await res.json()) as { enabled?: boolean }).enabled;
  } catch {
    return false; // sin conexión: la app sigue funcionando, solo que sin esta opción
  }
}

/** Los encargos que hay ahora mismo en el servidor (en marcha o listos para recoger). */
export async function listTranscriptions(): Promise<TranscriptionJob[]> {
  try {
    const res = await fetch("/api/transcriptions", { cache: "no-store" });
    if (!res.ok) return [];
    return ((await res.json()) as { jobs?: TranscriptionJob[] }).jobs ?? [];
  } catch {
    return [];
  }
}

/** Lo quita del servidor: cancela lo que quede por hacer y borra las páginas. */
export async function forgetTranscription(id: string): Promise<void> {
  try {
    await fetch(`/api/transcriptions/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    // sin conexión: el encargo se queda en el servidor y ya se verá al volver
  }
}

/**
 * Encarga el reconocimiento: rasteriza las páginas pedidas, las sube y
 * devuelve el encargo recién creado. A partir de aquí el trabajo es del
 * servidor.
 */
async function requestTranscription(input: TranscribeInput): Promise<TranscriptionJob> {
  const total = input.to - input.from + 1;
  const body = new FormData();
  body.append("scoreId", input.scoreId);
  body.append("scoreName", input.scoreName);
  body.append("fromPage", String(input.from));

  for (let page = input.from; page <= input.to; page++) {
    const index = page - input.from + 1;
    input.onStatus?.(total > 1 ? `Preparando la página ${index} de ${total}…` : "Preparando la página…");
    body.append("pages", await pageImage(input.pdf, page), `p${index}.png`);
  }

  input.onStatus?.("Enviando las páginas al servidor…");
  let res: Response;
  try {
    res = await fetch("/api/transcriptions", { method: "POST", body, signal: input.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new UserError("No hay conexión con el servidor. Comprueba la red e inténtalo de nuevo.");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new UserError(data?.error ?? "No se ha podido empezar el reconocimiento.");
  }
  return ((await res.json()) as { job: TranscriptionJob }).job;
}

/**
 * Sigue un encargo hasta que termina y monta el MusicXML.
 *
 * Cancelar de verdad es cosa del usuario: si la señal se aborta se le dice
 * al servidor que lo deje. Cerrar la pestaña no aborta nada, así que el
 * encargo sigue y se recoge a la vuelta.
 */
export async function followTranscription(
  start: TranscriptionJob,
  opts: { onStatus?: (text: string) => void; onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<OmrOutcome> {
  let job = start;
  try {
    while (job.status === "pending" || job.status === "running") {
      report(job, opts);
      await wait(POLL_MS, opts.signal);
      job = (await fetchJob(job.id)) ?? { ...job, status: "error", error: "El reconocimiento ha desaparecido del servidor." };
    }
  } catch (e) {
    if (opts.signal?.aborted) void forgetTranscription(job.id);
    throw e;
  }

  if (job.status === "error") {
    // el error ya se enseña aquí; en el servidor no pinta nada, y si se quedara
    // reaparecería como una tarea fallida cada vez que se abre la biblioteca
    void forgetTranscription(job.id);
    throw new UserError(job.error ?? "No se ha podido reconocer la partitura.");
  }

  opts.onProgress?.(1);
  opts.onStatus?.("Montando el MusicXML…");
  return assemble(job);
}

/** Encargar y seguir: lo que hace el botón de reconocer. */
export async function transcribeWithOmr(input: TranscribeInput): Promise<OmrOutcome> {
  const job = await requestTranscription(input);
  return followTranscription(job, input);
}

async function fetchJob(id: string): Promise<TranscriptionJob | null> {
  try {
    const res = await fetch(`/api/transcriptions/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { job: TranscriptionJob }).job;
  } catch {
    return null; // un corte de red no es el final: se vuelve a preguntar en la siguiente vuelta
  }
}

function report(job: TranscriptionJob, opts: { onStatus?: (t: string) => void; onProgress?: (f: number) => void }) {
  opts.onProgress?.(transcriptionProgress(job));
  const page = Math.min(job.donePages + 1, job.pages);
  const elapsed = clock(Math.round((Date.now() - job.createdAt) / 1000));
  opts.onStatus?.(
    job.status === "pending"
      ? "En cola en el servidor…"
      : job.pages > 1
        ? `Reconociendo la página ${page} de ${job.pages}… ${elapsed}`
        : `Reconociendo la página… ${elapsed}`,
  );
}

/** Junta el MusicXML de todas las páginas en una partitura sola. */
async function assemble(job: TranscriptionJob): Promise<OmrOutcome> {
  let res: Response;
  try {
    res = await fetch(`/api/transcriptions/${encodeURIComponent(job.id)}/xml`, { cache: "no-store" });
  } catch {
    throw new UserError("No hay conexión con el servidor para recoger el resultado.");
  }
  if (!res.ok) throw new UserError("El resultado del reconocimiento ya no está en el servidor.");
  const { pages } = (await res.json()) as { pages: string[] };
  if (!pages.length) throw new UserError("El reconocimiento no ha devuelto ninguna página.");

  const parsed: ParsedScore[] = [];
  const numbers: number[] = [];
  pages.forEach((musicxml, i) => {
    try {
      parsed.push(parseMusicXml(musicxml));
      numbers.push(job.fromPage + i);
    } catch {
      throw new UserError(`No se ha entendido el resultado del reconocimiento de la página ${i + 1}.`);
    }
  });

  const { score, warnings } = mergePages(parsed, { title: job.scoreName, pageNumbers: numbers });
  const engine = "oemer";
  const xml = buildMusicXml(score, { software: `Opus Piano · reconocimiento con ${engine}` });
  return { xml, score, warnings, pages: parsed.length, engine, jobId: job.id };
}

/** Una página como PNG: líneas finas y muy contrastadas, justo donde el JPEG deja artefactos. */
async function pageImage(pdf: Blob, page: number): Promise<Blob> {
  const { width } = await getPageSize(pdf, page);
  const canvas = await renderPage(pdf, page, RENDER_WIDTH / width);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new UserError("No se ha podido preparar la imagen de la página.");
  return blob;
}

/** Espera que se corta si el usuario cancela. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason as Error);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason as Error);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** «1 min 20 s» / «45 s», para que la espera no parezca colgada. */
function clock(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}
