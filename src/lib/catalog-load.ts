"use client";

import type { CatalogPiece } from "@/data/catalog";
import { catalogMusicXml } from "@/lib/music/catalog-score";
import { unpackMxl } from "@/lib/music/musicxml";
import { addScore, type ScoreRecord } from "@/lib/scores-db";
import { UserError } from "@/lib/user-error";

/**
 * De la ficha del catálogo al MusicXML que la app lee. Las piezas escritas en
 * notación compacta se generan aquí mismo; las originales se descargan de
 * `public/catalog` (el service worker las guarda al primer uso, así que la
 * segunda vez funcionan sin conexión).
 */

export const MUSICXML_MIME = "application/vnd.recordare.musicxml+xml";

export async function loadCatalogXml(piece: CatalogPiece): Promise<string> {
  if (piece.source.kind === "compact") return catalogMusicXml(piece.source.music, piece.title, piece.composer);
  let res: Response;
  try {
    res = await fetch(piece.source.path);
  } catch {
    throw new UserError("No se ha podido descargar la partitura. Comprueba la conexión.");
  }
  if (!res.ok) throw new UserError("Esta partitura no está disponible ahora mismo.");
  return unpackMxl(new Uint8Array(await res.arrayBuffer()));
}

/** Lo que va en las notas de la partitura al guardarla: de dónde viene, para que no se pierda. */
export function catalogCredit(piece: CatalogPiece): string {
  const origin = piece.source.kind === "file" ? `Transcripción: ${piece.source.origin.name}.` : "Arreglo sencillo de Opus Piano.";
  return `${piece.composer} · ${piece.year}. Obra de dominio público. ${origin}`;
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
