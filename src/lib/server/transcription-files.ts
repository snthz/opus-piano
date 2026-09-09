import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { scoresDir } from "./score-files";

/**
 * Los archivos de un reconocimiento: la imagen que mandó el navegador de
 * cada página y el MusicXML que devuelve el servicio para cada una.
 *
 * Van en disco y no en la base de datos por lo mismo que las partituras: son
 * megas de PNG. Ruta: SCORES_DIR/<userId>/omr/<id>/p<n>.<png|xml>
 *
 * Las rutas son dinámicas a propósito; `turbopackIgnore` evita que el build
 * intente rastrearlas (y meta el proyecto entero en la salida standalone).
 */

/** Una página, ya renderizada por el navegador; el servicio corta en 10 MB. */
export const MAX_PAGE_BYTES = 12 * 1024 * 1024;

const ID_RE = /^[a-z0-9]+$/i;

function dirOf(userId: string, id: string): string {
  if (!ID_RE.test(userId) || !ID_RE.test(id)) throw new Error("Id no válido");
  return `${scoresDir()}/${userId}/omr/${id}`;
}

const pagePath = (userId: string, id: string, page: number, ext: "png" | "xml") =>
  `${dirOf(userId, id)}/p${Math.trunc(page)}.${ext}`;

export async function writePageImage(userId: string, id: string, page: number, bytes: Uint8Array): Promise<void> {
  await mkdir(/*turbopackIgnore: true*/ dirOf(userId, id), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ pagePath(userId, id, page, "png"), bytes);
}

export async function readPageImage(userId: string, id: string, page: number): Promise<Buffer> {
  return readFile(/*turbopackIgnore: true*/ pagePath(userId, id, page, "png"));
}

export async function writePageXml(userId: string, id: string, page: number, xml: string): Promise<void> {
  await mkdir(/*turbopackIgnore: true*/ dirOf(userId, id), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ pagePath(userId, id, page, "xml"), xml, "utf8");
}

/** El MusicXML de cada página, en orden. Falta alguna si el reconocimiento no llegó al final. */
export async function readPagesXml(userId: string, id: string, pages: number): Promise<string[]> {
  const out: string[] = [];
  for (let page = 1; page <= pages; page++) {
    try {
      out.push(await readFile(/*turbopackIgnore: true*/ pagePath(userId, id, page, "xml"), "utf8"));
    } catch {
      break;
    }
  }
  return out;
}

export async function removeTranscriptionFiles(userId: string, id: string): Promise<void> {
  await rm(/*turbopackIgnore: true*/ dirOf(userId, id), { recursive: true, force: true });
}
