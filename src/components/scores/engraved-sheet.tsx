"use client";

import { useEffect, useState } from "react";
import { engraveScore } from "@/lib/music/engrave";
import { ChevronIcon } from "@/components/ui/arrow-icon";

/**
 * La partitura tal y como está escrita, página a página, como si fuera el
 * papel: título, ligaduras, matices, digitaciones y pedal incluidos.
 *
 * Es lo que se ve de un PDF en la biblioteca, pero salido del MusicXML: lo
 * graba Verovio en el propio navegador. El dibujo de la app —el que se
 * ilumina nota a nota mientras suena— aplana las voces y se deja los
 * adornos, que está bien para seguir la música y mal para decidir si esta
 * pieza es la que quieres tocar.
 *
 * El SVG viene de Verovio a partir de un archivo del catálogo (nuestro), no
 * de nada que escriba un usuario.
 */
export function EngravedSheet({ xml, className = "" }: { xml: string; className?: string }) {
  const [pages, setPages] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    engraveScore(xml).then(
      (svgs) => !cancelled && setPages(svgs),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [xml]);

  if (failed) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        {pages ? (
          <div
            className="engraved [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            // el SVG lo escribe Verovio a partir del MusicXML de la pieza
            dangerouslySetInnerHTML={{ __html: pages[Math.min(page, pages.length - 1)] }}
          />
        ) : (
          <div className="grid aspect-[3/4] place-items-center text-sm text-ink-2">Preparando la partitura…</div>
        )}
      </div>

      {pages && pages.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-circle h-9 w-9 disabled:opacity-30"
            aria-label="Página anterior"
          >
            <ChevronIcon dir="left" />
          </button>
          <span className="min-w-16 text-center text-xs text-ink-2">
            {Math.min(page, pages.length - 1) + 1} / {pages.length}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))}
            disabled={page >= pages.length - 1}
            className="btn-circle h-9 w-9 disabled:opacity-30"
            aria-label="Página siguiente"
          >
            <ChevronIcon dir="right" />
          </button>
        </div>
      )}
    </div>
  );
}
