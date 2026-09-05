import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * Archivos de las partituras en disco, fuera de la base de datos: un PDF de
 * 25 MB no debe pasar por el JSON de Prisma ni cargarse entero en memoria.
 * Se escriben y se leen en streaming. Ruta: SCORES_DIR/<userId>/<scoreId>.<file|xml>
 *
 * Las rutas son dinámicas a propósito; `turbopackIgnore` evita que el build
 * intente rastrearlas (y meta el proyecto entero en la salida standalone).
 */
export type FileKind = "file" | "xml";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_XML_BYTES = 10 * 1024 * 1024;

export function scoresDir(): string {
  return (process.env.SCORES_DIR || `${process.cwd()}/data/scores`).replace(/\/+$/, "");
}

export function quotaBytes(): number {
  return Number(process.env.SCORES_QUOTA_MB || 300) * 1024 * 1024;
}

const ID_RE = /^[0-9a-f-]{36}$/i;
export const isScoreId = (id: string) => ID_RE.test(id);

function pathOf(userId: string, scoreId: string, kind: FileKind): string {
  if (!isScoreId(scoreId) || !/^[a-z0-9]+$/i.test(userId)) throw new Error("Id no válido");
  return `${scoresDir()}/${userId}/${scoreId}.${kind}`;
}

export class TooLargeError extends Error {}

/**
 * Vuelca el cuerpo de la petición a disco contando bytes; si supera `limit`
 * corta y borra lo escrito. Devuelve el tamaño final.
 */
export async function writeUpload(userId: string, scoreId: string, kind: FileKind, body: ReadableStream<Uint8Array> | null, limit: number): Promise<number> {
  if (!body) return 0;
  const target = pathOf(userId, scoreId, kind);
  await mkdir(/*turbopackIgnore: true*/ `${scoresDir()}/${userId}`, { recursive: true });
  const tmp = `${target}.part`;
  let bytes = 0;
  const counter = new Writable({
    write(chunk: Buffer, _enc, cb) {
      bytes += chunk.length;
      if (bytes > limit) return cb(new TooLargeError("Archivo demasiado grande"));
      out.write(chunk, cb);
    },
    final(cb) {
      out.end(cb);
    },
  });
  const out = createWriteStream(/*turbopackIgnore: true*/ tmp);
  try {
    await pipeline(Readable.fromWeb(body as unknown as import("node:stream/web").ReadableStream<Uint8Array>), counter);
  } catch (e) {
    out.destroy();
    await rm(/*turbopackIgnore: true*/ tmp, { force: true });
    throw e;
  }
  await rename(/*turbopackIgnore: true*/ tmp, target);
  return bytes;
}

export async function fileSize(userId: string, scoreId: string, kind: FileKind): Promise<number | null> {
  try {
    return (await stat(/*turbopackIgnore: true*/ pathOf(userId, scoreId, kind))).size;
  } catch {
    return null;
  }
}

/** Stream de lectura para la respuesta HTTP, o null si no existe. */
export async function readStream(userId: string, scoreId: string, kind: FileKind): Promise<ReadableStream | null> {
  const p = pathOf(userId, scoreId, kind);
  try {
    await stat(/*turbopackIgnore: true*/ p);
  } catch {
    return null;
  }
  return Readable.toWeb(createReadStream(/*turbopackIgnore: true*/ p)) as unknown as ReadableStream;
}

export async function removeFile(userId: string, scoreId: string, kind: FileKind): Promise<void> {
  await rm(/*turbopackIgnore: true*/ pathOf(userId, scoreId, kind), { force: true });
}

export async function removeFiles(userId: string, scoreId: string): Promise<void> {
  await Promise.all([
    rm(/*turbopackIgnore: true*/ pathOf(userId, scoreId, "file"), { force: true }),
    rm(/*turbopackIgnore: true*/ pathOf(userId, scoreId, "xml"), { force: true }),
  ]);
}

export async function removeUserDir(userId: string): Promise<void> {
  if (!/^[a-z0-9]+$/i.test(userId)) return;
  await rm(/*turbopackIgnore: true*/ `${scoresDir()}/${userId}`, { recursive: true, force: true });
}
