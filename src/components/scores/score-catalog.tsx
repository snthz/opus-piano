"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATALOG, catalogCover, type CatalogPiece } from "@/data/catalog";
import { saveCatalogPiece } from "@/lib/catalog-load";
import { ownedPieces } from "@/lib/catalog-library";
import { listScores, onScoresChange } from "@/lib/scores-db";
import { LEVELS, type Level } from "@/lib/study-plan";
import { ProgressRing } from "@/components/ui/progress-ring";
import { CoverTag, ScoreCover, TileText } from "./score-cover";

/**
 * El catálogo de piezas libres: una cuadrícula de portadas, como el
 * escaparate de una tienda de partituras. Cada portada es la primera página
 * de verdad, así que la tarjeta no tiene que explicar qué es la pieza: se
 * ve. Tocarla lleva a la vista previa —entera, sonando, con el análisis— y
 * el corazón la guarda en la biblioteca sin salir de aquí.
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

      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
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
  return (
    <article className="group relative">
      <Link href={`/scores/catalog/${piece.id}`} className="block focus:outline-none">
        <ScoreCover src={catalogCover(piece.id)}>
          <CoverTag className={`${LEVEL_COLOR[piece.level] ?? "bg-surface/90"} text-ink`}>
            {LEVEL_HEADING[piece.level] ?? piece.level}
          </CoverTag>
        </ScoreCover>
        <TileText
          title={piece.title}
          meta={piece.composer}
          sub={`${piece.year} · ${piece.measures} compases`}
        />
      </Link>
      <SaveHeart piece={piece} owned={owned} />
    </article>
  );
}

/**
 * El corazón de la esquina: guarda la pieza en la biblioteca desde la propia
 * tarjeta. Ya guardada, deja de ser un botón y pasa a ser lo que dice: que ya
 * la tienes. Quitarla se hace desde la biblioteca, que es donde están las
 * anotaciones que se perderían.
 */
function SaveHeart({ piece, owned }: { piece: CatalogPiece; owned: boolean }) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  if (owned) {
    return (
      <span
        title="Ya está en tu biblioteca"
        aria-label="Ya está en tu biblioteca"
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-ink text-bg shadow-sm"
      >
        <HeartIcon filled />
      </span>
    );
  }

  const save = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await saveCatalogPiece(piece);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={(e) => void save(e)}
      disabled={saving}
      title={failed ? "No se ha podido guardar; inténtalo otra vez" : "Guardar en mi biblioteca"}
      aria-label={failed ? "No se ha podido guardar; inténtalo otra vez" : "Guardar en mi biblioteca"}
      className={`absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-surface/90 shadow-sm ring-1 ring-line backdrop-blur transition hover:bg-surface hover:text-ink ${
        failed ? "text-bad" : "text-ink-2"
      }`}
    >
      {saving ? <ProgressRing progress={null} className="h-4 w-4" /> : <HeartIcon />}
    </button>
  );
}

function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z" />
    </svg>
  );
}
