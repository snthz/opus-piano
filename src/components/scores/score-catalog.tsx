"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATALOG, type CatalogPiece } from "@/data/catalog";
import { loadCatalogParsed } from "@/lib/catalog-load";
import { ownedPieces } from "@/lib/catalog-library";
import type { ParsedScore } from "@/lib/music/musicxml";
import { listScores, onScoresChange } from "@/lib/scores-db";
import type { Level } from "@/lib/study-plan";
import { LEVELS } from "@/lib/study-plan";
import { CoverDot, CoverTag, ScoreCover } from "./score-cover";

/**
 * El catálogo de piezas libres: una cuadrícula de portadas, como una tienda
 * de partituras, con el nivel en cada una y unos chips para quedarse solo con
 * uno. Cada tarjeta lleva a su vista previa —la partitura entera, sonando,
 * con el análisis— y desde allí se guarda en la biblioteca. Aquí solo se
 * decide cuál abrir, así que la tarjeta dice lo justo: portada, título,
 * autor y tamaño.
 */

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

/** Los primeros compases de una pieza del catálogo, para su portada; null mientras llegan o si no llegan. */
function useCatalogParsed(piece: CatalogPiece): ParsedScore | null {
  const [parsed, setParsed] = useState<ParsedScore | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCatalogParsed(piece).then(
      (p) => !cancelled && setParsed(p),
      () => !cancelled && setParsed(null),
    );
    return () => {
      cancelled = true;
    };
  }, [piece]);
  return parsed;
}

export function ScoreCatalog() {
  const owned = useOwnedPieces();
  const [level, setLevel] = useState<Level | null>(null);
  const levels = LEVELS.filter((l) => CATALOG.some((p) => p.level === l));
  const pieces = level ? CATALOG.filter((p) => p.level === level) : CATALOG;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Nivel">
        <button type="button" onClick={() => setLevel(null)} className={`pill py-1.5 text-xs ${level === null ? "pill-active" : ""}`}>
          Todas
        </button>
        {levels.map((l) => (
          <button key={l} type="button" onClick={() => setLevel(l)} className={`pill py-1.5 text-xs ${level === l ? "pill-active" : ""}`}>
            {LEVEL_HEADING[l] ?? l}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-3">
          {pieces.length} {pieces.length === 1 ? "pieza" : "piezas"}
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {pieces.map((piece) => (
          <li key={piece.id}>
            <PieceCard piece={piece} owned={owned.has(piece.id)} />
          </li>
        ))}
      </ul>

      <p className="px-1 text-xs leading-relaxed text-ink-3">
        Todas son obras de dominio público: de autores fallecidos hace más de un siglo, o tradicionales. Las partituras
        vienen de bibliotecas MusicXML de dominio público (cada ficha dice de cuál); las marcadas como «arreglo fácil»
        son versiones simplificadas de esas mismas bibliotecas, no la obra tal cual. Puedes tocarlas, imprimirlas y
        compartirlas sin pedir permiso a nadie.
      </p>
    </div>
  );
}

function PieceCard({ piece, owned }: { piece: CatalogPiece; owned: boolean }) {
  const parsed = useCatalogParsed(piece);
  return (
    <Link
      href={`/scores/catalog/${piece.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow)] focus-visible:-translate-y-0.5"
    >
      <div className="p-2.5 pb-1.5">
        <ScoreCover parsed={parsed} zoom>
          <CoverTag className={`${LEVEL_COLOR[piece.level] ?? "bg-surface/85"} text-ink`}>{LEVEL_HEADING[piece.level] ?? piece.level}</CoverTag>
          {owned && (
            <span className="absolute bottom-2 right-2">
              <CoverDot label="En tu biblioteca" className="bg-ink text-bg">
                <CheckIcon className="h-3 w-3" />
              </CoverDot>
            </span>
          )}
        </ScoreCover>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 px-3.5 pb-3.5 pt-2">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{piece.title}</p>
        <p className="line-clamp-1 text-xs text-ink-2">{piece.composer}</p>
        <p className="mt-auto pt-1 text-[11px] text-ink-3">
          {piece.year} · {piece.measures} compases
        </p>
      </div>
    </Link>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
