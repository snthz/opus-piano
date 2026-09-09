"use client";

import type { CatalogPiece } from "@/data/catalog";
import { parseMusicXml, unpackMxl, type ParsedScore } from "@/lib/music/musicxml";
import { addScore, type ScoreRecord } from "@/lib/scores-db";
import { UserError } from "@/lib/user-error";

/**
 * De la ficha del catálogo al MusicXML que la app lee. Las piezas se
 * descargan de `public/catalog` (el service worker las guarda al primer uso,
 * así que la segunda vez funcionan sin conexión).
 */

export const MUSICXML_MIME = "application/vnd.recordare.musicxml+xml";

export async function loadCatalogXml(piece: CatalogPiece): Promise<string> {
  let res: Response;
  try {
    res = await fetch(piece.source.path);
  } catch {
    throw new UserError("No se ha podido descargar la partitura. Comprueba la conexión.");
  }
  if (!res.ok) throw new UserError("Esta partitura no está disponible ahora mismo.");
  return unpackMxl(new Uint8Array(await res.arrayBuffer()));
}

// Las portadas del catálogo dibujan los primeros compases de cada pieza: el
// análisis se hace una vez por pieza y se comparte entre la lista y la ficha.
const parsed = new Map<string, Promise<ParsedScore>>();

/** La pieza analizada, lista para dibujar; un fallo no queda cacheado. */
export function loadCatalogParsed(piece: CatalogPiece): Promise<ParsedScore> {
  let p = parsed.get(piece.id);
  if (!p) {
    p = loadCatalogXml(piece).then(parseMusicXml);
    parsed.set(piece.id, p);
    p.catch(() => parsed.delete(piece.id));
  }
  return p;
}

/** Lo que va en las notas de la partitura al guardarla: de dónde viene, para que no se pierda. */
export function catalogCredit(piece: CatalogPiece): string {
  const kind = piece.source.arranged ? "Arreglo fácil" : "Transcripción";
  return `${piece.composer} · ${piece.year}. Obra de dominio público. ${kind}: ${piece.source.origin.name}.`;
}

/** Guarda la pieza en la biblioteca como si se hubiera subido; con cuenta, sube sola al servidor. */
export async function saveCatalogPiece(piece: CatalogPiece, xml?: string): Promise<ScoreRecord> {
  const text = xml ?? (await loadCatalogXml(piece));
  return addScore({
    name: piece.title,
    file: new Blob([text], { type: MUSICXML_MIME }),
    thumbnail: "",
    notes: catalogCredit(piece),
    pageCount: piece.measures,
    kind: "musicxml",
  });
}
