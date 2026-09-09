"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { piecesByLevel, type CatalogPiece } from "@/data/catalog";
import { ownedPieces } from "@/lib/catalog-library";
import { listScores, onScoresChange } from "@/lib/scores-db";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { ArrowIcon } from "@/components/ui/arrow-icon";

/**
 * El catálogo de piezas libres, por nivel. Cada tarjeta lleva a su vista
 * previa —la partitura entera, sonando, con el análisis— y desde allí se
 * guarda en la biblioteca. Aquí solo se decide cuál abrir.
 */

/** Un glifo por nivel, para que las tarjetas se distingan sin leerlas. */
const LEVEL_GLYPH: Record<string, string> = {
  principiante: "noteQuarterUp",
  elemental: "note8thUp",
  intermedio: "gClef",
  avanzado: "fClef",
};

/** Los rótulos de `LEVEL_LABELS` están escritos para un formulario («empiezo a leer»); aquí hacen de título. */
export const LEVEL_HEADING: Record<string, string> = {
  principiante: "Para empezar",
  elemental: "Elemental",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

export const LEVEL_COLOR: Record<string, string> = {
  principiante: "bg-mint",
  elemental: "bg-blue",
  intermedio: "bg-peach",
  avanzado: "bg-pink",
};

export function useOwnedPieces(): Map<string, string> {
  const [owned, setOwned] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    // Encadenado y no `async`/`await`: así el setState cae en un microtask y no dentro del cuerpo del efecto.
    const reload = () => listScores().then((scores) => setOwned(ownedPieces(scores)));
    void reload();
    return onScoresChange(() => void reload());
  }, []);
  return owned;
}

export function ScoreCatalog() {
  const owned = useOwnedPieces();
  return (
    <div className="space-y-8">
      {piecesByLevel().map(({ level, pieces }) => (
        <section key={level}>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">{LEVEL_HEADING[level] ?? level}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {pieces.map((piece) => (
              <li key={piece.id}>
                <PieceCard piece={piece} owned={owned.has(piece.id)} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="px-1 text-xs leading-relaxed text-ink-3">
        Todas son obras de dominio público: de autores fallecidos hace más de un siglo, o tradicionales. Las partituras
        originales vienen de bibliotecas MusicXML de dominio público (cada ficha dice de cuál); las piezas «para
        empezar» son arreglos sencillos escritos para Opus Piano. Puedes tocarlas, imprimirlas y compartirlas sin pedir
        permiso a nadie.
      </p>
    </div>
  );
}

function PieceCard({ piece, owned }: { piece: CatalogPiece; owned: boolean }) {
  return (
    <Link
      href={`/scores/catalog/${piece.id}`}
      className={`card-pastel ${LEVEL_COLOR[piece.level] ?? "bg-ash"} group relative flex h-full flex-col overflow-hidden p-5 transition hover:-translate-y-0.5`}
    >
      <GlyphIcon
        name={LEVEL_GLYPH[piece.level] ?? "gClef"}
        size={120}
        className="pointer-events-none absolute -right-4 -top-4 opacity-[0.10]"
      />
      <span className="relative flex-1">
        <span className="block pr-10 text-lg font-semibold leading-tight tracking-tight">{piece.title}</span>
        <span className="mt-0.5 block text-xs text-ink-2">
          {piece.composer} · {piece.year} · {piece.measures} compases
        </span>
        <span className="mt-2 block max-w-prose text-sm leading-relaxed text-ink-2">{piece.about}</span>
      </span>
      <span className="relative mt-4 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-ink-2">{owned ? "En tu biblioteca" : piece.source.kind === "file" ? "Partitura original" : "Arreglo sencillo"}</span>
        <span className="btn-circle h-9 w-9 group-hover:-translate-y-0.5">
          <ArrowIcon className="h-4 w-4" />
        </span>
      </span>
    </Link>
  );
}
