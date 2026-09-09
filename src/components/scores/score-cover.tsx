"use client";

import type { ReactNode } from "react";
import { GlyphIcon } from "@/components/notation/glyph-icon";
import type { ParsedScore } from "@/lib/music/musicxml";
import { ScoreThumb } from "./score-thumb";

/**
 * La portada de una partitura, la misma en la biblioteca, el catálogo y las
 * compartidas: una lámina 3:4 con la miniatura (la primera página del PDF, o
 * los primeros compases dibujados si es MusicXML) y, encima, las insignias
 * que cada tarjeta quiera poner. Sin nada que enseñar, una hoja de
 * pentagramas vacía con las dos claves, para que siga leyéndose como
 * partitura.
 */
export function ScoreCover({
  thumbnail,
  parsed,
  zoom = false,
  className = "",
  children,
}: {
  /** Data URL de la miniatura (PDF). */
  thumbnail?: string;
  /** Partitura analizada, para dibujar sus primeros compases (MusicXML). */
  parsed?: ParsedScore | null;
  /** La miniatura crece un poco al pasar por encima de la tarjeta (`group`). */
  zoom?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const grow = zoom ? "transition-transform duration-300 group-hover:scale-[1.04]" : "";
  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line ${className}`}>
      {thumbnail ? (
        // La miniatura es un data URL generado en el dispositivo: next/image no puede optimizarla.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnail} alt="" className={`h-full w-full object-cover object-top ${grow}`} />
      ) : parsed ? (
        <div className={`absolute inset-0 origin-top bg-surface ${grow}`}>
          <ScoreThumb parsed={parsed} />
        </div>
      ) : (
        <div className="flex h-full w-full flex-col justify-center gap-6 px-3.5" aria-hidden>
          {[0, 1, 2].map((system) => (
            <div key={system} className="relative">
              <div className="space-y-[6px]">
                {[0, 1, 2, 3, 4].map((line) => (
                  <div key={line} className="h-px bg-ink-3 opacity-40" />
                ))}
              </div>
              {system === 0 && (
                <div className="absolute inset-y-0 left-0.5 flex items-center gap-2 text-ink">
                  <GlyphIcon name="gClef" size={34} fit="em" />
                  <GlyphIcon name="fClef" size={34} fit="em" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

/** Etiqueta de texto sobre la portada (formato, nivel). Abajo a la izquierda salvo que se diga otra cosa. */
export function CoverTag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-line backdrop-blur ${className || "bg-surface/85 text-ink-2"}`}
    >
      {children}
    </span>
  );
}

/** Insignia redonda de una capacidad de la partitura (se puede escuchar, tiene trazos, está en la biblioteca). */
export function CoverDot({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <span
      title={label}
      aria-label={label}
      className={`grid h-6 w-6 place-items-center rounded-full ring-1 ring-line backdrop-blur ${className || "bg-surface/85 text-ink-2"}`}
    >
      {children}
    </span>
  );
}
