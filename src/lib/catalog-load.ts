"use client";

import { catalogCover, type CatalogPiece } from "@/data/catalog";
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

/**
 * La portada del catálogo, encogida y en data URL, para que la partitura
 * guardada se vea igual en la biblioteca (y viaje con ella al servidor). Un
 * fallo aquí no impide guardar: sin portada, la tarjeta enseña una hoja en
 * blanco.
 */
async function coverDataUrl(id: string): Promise<string> {
  try {
    const res = await fetch(catalogCover(id));
    if (!res.ok) return "";
    const image = new Image();
    image.src = URL.createObjectURL(await res.blob());
    try {
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 800;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.72);
    } finally {
      URL.revokeObjectURL(image.src);
    }
  } catch {
    return "";
  }
}

/** Guarda la pieza en la biblioteca como si se hubiera subido; con cuenta, sube sola al servidor. */
export async function saveCatalogPiece(piece: CatalogPiece, xml?: string): Promise<ScoreRecord> {
  const text = xml ?? (await loadCatalogXml(piece));
  return addScore({
    name: piece.title,
    file: new Blob([text], { type: MUSICXML_MIME }),
    thumbnail: await coverDataUrl(piece.id),
    notes: catalogCredit(piece),
    pageCount: piece.measures,
    kind: "musicxml",
  });
}
