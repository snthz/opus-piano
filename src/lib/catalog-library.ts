import { CATALOG } from "@/data/catalog";

/**
 * Qué piezas del catálogo tiene ya el usuario en su biblioteca.
 *
 * Se decide por el título, que es lo que el usuario ve y lo que se guarda al
 * añadirla. Si la renombra deja de reconocerse y podrá añadirla otra vez: un
 * fallo barato comparado con guardar un id oculto en cada partitura solo
 * para esto. Lo comparten el catálogo y la ruta de aprendizaje, así que vive
 * aquí y no en un componente.
 */
export function ownedPieces(scores: { id: string; name: string }[]): Map<string, string> {
  const owned = new Map<string, string>();
  for (const piece of CATALOG) {
    const saved = scores.find((s) => s.name === piece.title);
    if (saved) owned.set(piece.id, saved.id);
  }
  return owned;
}
