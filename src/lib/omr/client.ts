"use client";

import { buildMusicXml } from "@/lib/music/musicxml-build";
import { parseMusicXml, type ParsedScore } from "@/lib/music/musicxml";
import { getPageSize, renderPage } from "@/lib/pdf-thumbnail";
import { UserError } from "@/lib/user-error";
import { mergePages } from "./merge";
import { readNdjson } from "@/lib/ndjson";

/**
 * Reconocimiento de una partitura escaneada sin modelos de lenguaje: el
 * servidor pasa cada página por oemer (modelos de OMR ya entrenados) y devuelve
 * su MusicXML.
 *
 * El recorrido del PDF lo lleva el navegador: dibuja una página, la manda,
 * espera y sigue con la siguiente. Así el servicio de reconocimiento no
 * necesita saber nada de PDF y las páginas nunca salen del dispositivo enteras,
 * solo la que se está mirando.
 *
 * Lo que vuelve del servicio es MusicXML de verdad, pero puede traer cosas que
 * Opus Piano no dibuja (más de dos pentagramas, varias voces). Se lee con el
 * lector de la aplicación y se vuelve a escribir con su escritor, de modo que
 * lo que se guarda es siempre el mismo dialecto que produce todo lo demás.
 */

/** Páginas por reconocimiento. Cada una son varios minutos de CPU del servidor. */
export const MAX_OMR_PAGES = 4;

/**
 * Ancho al que se dibuja la página. oemer reescala por dentro a unos 3,6
 * millones de píxeles pasándole lo que se le pase, así que esto es un A4 a 200
 * ppp: el detalle que aprovecha, sin subir de más.
 */
const RENDER_WIDTH = 1700;

/**
 * Lo que tarda una página en el servicio desplegado (una A4 de piano con cuatro
 * vCPU). Solo sirve para que el anillo avance mientras se espera: si se pasa,
 * se queda casi lleno hasta que llegue la respuesta.
 */
const EXPECTED_SECONDS = 125;

export interface OmrInput {
  scoreName: string;
  pdf: Blob;
  /** Primera y última página del PDF, ambas incluidas */
  from: number;
  to: number;
  onStatus?: (text: string) => void;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface OmrOutcome {
  /** MusicXML listo para vincular a la partitura */
  xml: string;
  score: ParsedScore;
  warnings: string[];
  pages: number;
  engine: string;
}

/** Está configurado en el servidor (hay OMR_URL). */
export async function omrAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/omr", { cache: "no-store" });
    if (!res.ok) return false;
    return !!((await res.json()) as { enabled?: boolean }).enabled;
  } catch {
    return false; // sin conexión: la aplicación sigue, solo que sin esta opción
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

/** Una página como PNG: línea fina de alto contraste, que es donde el JPEG deja artefactos. */
async function pageImage(pdf: Blob, page: number): Promise<Blob> {
  const { width } = await getPageSize(pdf, page);
  const canvas = await renderPage(pdf, page, RENDER_WIDTH / width);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new UserError("No se ha podido preparar la imagen de la página.");
  return blob;
}

/**
 * Manda la página y espera. La respuesta es un flujo de líneas JSON (ver
 * `/api/omr`): mientras el servicio trabaja llegan señales de vida con los
 * segundos que lleva, y al final el MusicXML o el error.
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

/** «1 min 20 s» / «45 s», para que la espera no parezca colgada. */
function clock(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}
