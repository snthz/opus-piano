"use client";

import { buildMusicXml } from "@/lib/music/musicxml-build";
import { parseMusicXml, type ParsedScore } from "@/lib/music/musicxml";
import { getPageSize, renderPage } from "@/lib/pdf-thumbnail";
import { UserError } from "@/lib/user-error";
import { mergePages } from "./merge";
import { readNdjson } from "@/lib/ndjson";

/**
 * Recognizes a scanned score without language models: the server runs each
 * page through oemer (pretrained OMR models) and returns its MusicXML.
 *
 * The browser drives the PDF traversal — renders a page, sends it, waits,
 * moves to the next — so the recognition service knows nothing about PDF and
 * pages never leave the device whole, only the one being looked at.
 *
 * What comes back is real MusicXML but may include things Opus Piano can't
 * draw (more than two staves, several voices), so it's read and rewritten
 * through the app's own reader/writer to keep a single dialect.
 */

/** Pages per recognition; each one is several minutes of server CPU. */
export const MAX_OMR_PAGES = 4;

/** Width to render the page at; oemer rescales to ~3.6M px internally, so this matches an A4 at 200 dpi — enough detail without going over. */
const RENDER_WIDTH = 1700;

/** How long a page takes on the deployed service (A4 piano score, 4 vCPU); just paces the progress ring while waiting. */
const EXPECTED_SECONDS = 125;

export interface OmrInput {
  scoreName: string;
  pdf: Blob;
  /** First and last PDF page, both inclusive. */
  from: number;
  to: number;
  onStatus?: (text: string) => void;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface OmrOutcome {
  /** MusicXML ready to attach to the score. */
  xml: string;
  score: ParsedScore;
  warnings: string[];
  pages: number;
  engine: string;
}

/** Whether the server has it configured (OMR_URL set). */
export async function omrAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/omr", { cache: "no-store" });
    if (!res.ok) return false;
    return !!((await res.json()) as { enabled?: boolean }).enabled;
  } catch {
    return false; // offline: the app still works, just without this option
  }
}

export async function transcribeWithOmr(input: OmrInput): Promise<OmrOutcome> {
  const total = input.to - input.from + 1;
  const pages: ParsedScore[] = [];
  const numbers: number[] = [];

  for (let page = input.from; page <= input.to; page++) {
    const index = page - input.from + 1;
    input.onStatus?.(total > 1 ? `Preparando la página ${index} de ${total}…` : "Preparando la página…");
    input.onProgress?.((index - 1) / total);

    const image = await pageImage(input.pdf, page);
    const musicxml = await recognise(image, input.signal, (seconds) => {
      const done = Math.min(0.95, seconds / EXPECTED_SECONDS);
      input.onProgress?.((index - 1 + done) / total);
      input.onStatus?.(`Reconociendo la página ${index} de ${total}… ${clock(seconds)}`);
    });

    let parsed: ParsedScore;
    try {
      parsed = parseMusicXml(musicxml);
    } catch {
      throw new UserError(`No se ha entendido el resultado del reconocimiento de la página ${index}.`);
    }
    pages.push(parsed);
    numbers.push(page);
    input.onProgress?.(index / total);
  }

  input.onStatus?.("Montando el MusicXML…");
  const { score, warnings } = mergePages(pages, { title: input.scoreName, pageNumbers: numbers });
  const engine = "oemer";
  const xml = buildMusicXml(score, { software: `Opus Piano · reconocimiento con ${engine}` });
  return { xml, score, warnings, pages: total, engine };
}

/** A page as PNG: thin high-contrast lines, exactly where JPEG leaves artifacts. */
async function pageImage(pdf: Blob, page: number): Promise<Blob> {
  const { width } = await getPageSize(pdf, page);
  const canvas = await renderPage(pdf, page, RENDER_WIDTH / width);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new UserError("No se ha podido preparar la imagen de la página.");
  return blob;
}

/**
 * Sends the page and waits. The response streams NDJSON lines (see
 * `/api/omr`): heartbeats with elapsed seconds while it works, then the
 * MusicXML or the error.
 */
async function recognise(image: Blob, signal: AbortSignal | undefined, onWait: (seconds: number) => void): Promise<string> {
  const body = new FormData();
  body.append("file", image, "page.png");

  let res: Response;
  try {
    res = await fetch("/api/omr", { method: "POST", body, signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new UserError("No hay conexión con el servidor. Comprueba la red e inténtalo de nuevo.");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new UserError(data?.error ?? "No se ha podido reconocer la partitura.");
  }
  if (!res.body) throw new UserError("El servidor no ha devuelto ninguna respuesta.");

  let musicxml: string | null = null;
  let failure: string | null = null;

  await readNdjson(res.body, (event) => {
    if (event.type === "working") onWait(typeof event.seconds === "number" ? event.seconds : 0);
    else if (event.type === "done" && typeof event.musicxml === "string") musicxml = event.musicxml;
    else if (event.type === "error") failure = typeof event.message === "string" ? event.message : "No se ha podido reconocer la partitura.";
  });

  if (failure) throw new UserError(failure);
  if (!musicxml) throw new UserError("El reconocimiento se ha cortado antes de terminar. Vuelve a intentarlo.");
  return musicxml;
}

/** "1 min 20 s" / "45 s", so the wait doesn't look stuck. */
function clock(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}
