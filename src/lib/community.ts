"use client";

import { unpackMxl } from "@/lib/music/musicxml";
import { addScore, type ScoreRecord, type Visibility } from "@/lib/scores-db";
import { UserError } from "@/lib/user-error";

/**
 * Lado del navegador de las partituras compartidas: la lista pública, la
 * ficha de una y guardarla en la biblioteca propia. No hace falta cuenta
 * para mirar ni para guardar; la copia guardada es tuya y no se entera de
 * lo que haga después el original.
 */

export interface SharedScore {
  id: string;
  name: string;
  kind: "pdf" | "musicxml";
  pageCount: number;
  thumbnail: string;
  description: string;
  playable: boolean;
  hasXml: boolean;
  visibility: Visibility;
  owner: string;
  sharedAt: number;
}

const MUSICXML_MIME = "application/vnd.recordare.musicxml+xml";

async function get(path: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, { cache: "no-store" });
  } catch {
    throw new UserError("No hay conexión con el servidor. Comprueba la red e inténtalo de nuevo.");
  }
  if (res.status === 404) throw new UserError("Esta partitura no existe o su dueño ha dejado de compartirla.");
  if (!res.ok) throw new UserError("No se ha podido cargar la partitura compartida.");
  return res;
}

export async function listShared(): Promise<SharedScore[]> {
  const body = (await (await get("/api/community")).json()) as { scores: SharedScore[] };
  return body.scores;
}

export async function getShared(id: string): Promise<SharedScore> {
  return (await (await get(`/api/community/${encodeURIComponent(id)}`)).json()) as SharedScore;
}

/** El archivo principal; un MusicXML comprimido (.mxl) se deja ya descomprimido, como al subirlo. */
export async function sharedFile(meta: SharedScore): Promise<Blob> {
  const res = await get(`/api/community/${encodeURIComponent(meta.id)}/file`);
  const blob = await res.blob();
  if (meta.kind !== "musicxml") return blob;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // "PK": cabecera zip
  const zipped = bytes[0] === 0x50 && bytes[1] === 0x4b;
  return zipped ? new Blob([unpackMxl(bytes)], { type: MUSICXML_MIME }) : new Blob([bytes], { type: MUSICXML_MIME });
}

export async function sharedXml(meta: SharedScore): Promise<Blob | undefined> {
  if (!meta.hasXml) return undefined;
  const res = await fetch(`/api/community/${encodeURIComponent(meta.id)}/xml`, { cache: "no-store" });
  return res.ok ? res.blob() : undefined;
}

/** Copia en la biblioteca propia. Privada, como todo lo que se añade; compartirla otra vez es decisión del nuevo dueño. */
export async function saveShared(meta: SharedScore, file?: Blob, linkedXml?: Blob): Promise<ScoreRecord> {
  const blob = file ?? (await sharedFile(meta));
  const xml = linkedXml ?? (await sharedXml(meta));
  const credit = `Compartida por ${meta.owner} en Opus Piano.`;
  return addScore({
    name: meta.name,
    file: blob,
    thumbnail: meta.thumbnail,
    notes: meta.description ? `${credit}\n\n${meta.description}` : credit,
    pageCount: meta.pageCount,
    kind: meta.kind,
    linkedXml: xml,
  });
}

/** La dirección que se copia al compartir por enlace. */
export const sharedUrl = (id: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/scores/community/${encodeURIComponent(id)}`;
