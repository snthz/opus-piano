"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { piecesByLevel, type CatalogPiece } from "@/data/catalog";
import { ownedPieces } from "@/lib/catalog-library";
import { catalogMusicXml } from "@/lib/music/catalog-score";
import { addScore, listScores, onScoresChange } from "@/lib/scores-db";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { ProgressRing } from "@/components/ui/progress-ring";

/**
 * El catálogo de piezas libres. Cada una se genera aquí mismo —el MusicXML
 * sale de la notación compacta de `catalog.ts`, no hay archivos que
 * descargar— y entra en la biblioteca como cualquier partitura subida: se
 * guarda en IndexedDB y, con cuenta, sube al servidor sola.
 */

const MIME = "application/vnd.recordare.musicxml+xml";

/** Un glifo por nivel, para que las tarjetas se distingan sin leerlas. */
const LEVEL_GLYPH: Record<string, string> = {
  principiante: "noteQuarterUp",
  elemental: "note8thUp",
  intermedio: "gClef",
  avanzado: "fClef",
};

/** Los rótulos de `LEVEL_LABELS` están escritos para un formulario («empiezo a leer»); aquí hacen de título. */
const LEVEL_HEADING: Record<string, string> = {
  principiante: "Para empezar",
  elemental: "Elemental",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

const LEVEL_COLOR: Record<string, string> = {
  principiante: "bg-mint",
  elemental: "bg-blue",
  intermedio: "bg-peach",
  avanzado: "bg-pink",
};

export function ScoreCatalog() {
  const [owned, setOwned] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Encadenado y no `async`/`await` como el resto de la app: así el setState
  // cae en un microtask y no dentro del cuerpo del efecto.
  const reload = () => listScores().then((scores) => setOwned(ownedPieces(scores)));

  useEffect(() => {
    void reload();
  }, []);
  useEffect(() => onScoresChange(() => void reload()), []);

  const add = async (piece: CatalogPiece) => {
    setBusy(piece.id);
    setError(null);
    try {
      const xml = catalogMusicXml(piece.music, piece.title, piece.composer);
      const record = await addScore({
        name: piece.title,
        file: new Blob([xml], { type: MIME }),
        thumbnail: "",
        notes: `${piece.composer} · ${piece.year}. Arreglo sencillo de Opus Piano sobre una obra de dominio público.`,
        pageCount: piece.music.measures.length,
        kind: "musicxml",
      });
      setOwned((prev) => new Map(prev).set(piece.id, record.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido añadir la pieza.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      {error && <p className="px-1 text-xs text-bad">{error}</p>}

      {piecesByLevel().map(({ level, pieces }) => (
        <section key={level}>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">{LEVEL_HEADING[level] ?? level}</h2>
          <ul className="space-y-3">
            {pieces.map((piece) => (
              <li key={piece.id}>
                <PieceCard
                  piece={piece}
                  scoreId={owned.get(piece.id)}
                  busy={busy === piece.id}
                  onAdd={() => void add(piece)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="px-1 text-xs leading-relaxed text-ink-3">
        Todas son obras de dominio público —tradicionales o de autores fallecidos hace más de un siglo— y los arreglos
        están escritos para Opus Piano, no copiados de ninguna edición. Puedes tocarlas, imprimirlas y compartirlas sin
        pedir permiso a nadie.
      </p>
    </div>
  );
}

function PieceCard({
  piece,
  scoreId,
  busy,
  onAdd,
}: {
  piece: CatalogPiece;
  scoreId?: string;
  busy: boolean;
  onAdd: () => void;
}) {
  return (
    <article className={`card-pastel ${LEVEL_COLOR[piece.level] ?? "bg-ash"} relative overflow-hidden p-5`}>
      <GlyphIcon
        name={LEVEL_GLYPH[piece.level] ?? "gClef"}
        size={120}
        className="pointer-events-none absolute -right-4 -top-4 opacity-[0.10]"
      />
      <div className="relative">
        <h3 className="pr-16 text-lg font-semibold leading-tight tracking-tight">{piece.title}</h3>
        <p className="mt-0.5 text-xs text-ink-2">
          {piece.composer} · {piece.year} · {piece.music.measures.length} compases
        </p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">{piece.about}</p>

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {piece.skills.map((s) => (
            <li key={s} className="pill py-1 text-xs">
              {s}
            </li>
          ))}
        </ul>

        <div className="mt-4">
          {scoreId ? (
            <Link href={`/scores?score=${encodeURIComponent(scoreId)}`} className="pill pill-active">
              Abrir en mi biblioteca
              <ArrowIcon className="h-4 w-4" />
            </Link>
          ) : (
            <button type="button" onClick={onAdd} disabled={busy} className="pill pill-active disabled:opacity-60">
              {busy ? <ProgressRing progress={null} className="h-4 w-4" /> : null}
              {busy ? "Añadiendo…" : "Añadir a mi biblioteca"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
