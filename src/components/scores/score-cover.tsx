"use client";

import type { ReactNode } from "react";
import { GlyphIcon } from "@/components/notation/glyph-icon";

/**
 * La portada de una partitura, la misma en el catálogo, la biblioteca y las
 * compartidas: la primera página, sobre papel blanco y con las esquinas
 * redondeadas, y encima las insignias que cada tarjeta quiera poner.
 *
 * Es una imagen, no un dibujo hecho en el momento: la primera página de un
 * PDF (`pdf-thumbnail.ts`) o la partitura grabada con Verovio
 * (`music/engrave.ts`). Mientras se prepara —o si no hay ninguna— se ve una
 * hoja de pentagramas vacía, para que la tarjeta no cambie de tamaño ni
 * parezca rota.
 */
export function ScoreCover({
  src,
  className = "",
  children,
}: {
  /** Data URL de la portada, o la ruta de una ya hecha. Vacío mientras se prepara. */
  src?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    // Al pasar por encima solo se marcan el borde y la sombra. La portada no
    // se mueve ni crece: es una hoja de papel, y el papel no hace eso.
    <div
      className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-white ring-1 ring-line transition duration-200 group-hover:shadow-[var(--shadow)] group-hover:ring-ink-3 group-focus-within:ring-ink-3 ${className}`}
    >
      {src ? (
        // Portada generada en el propio dispositivo (data URL) o servida estática: next/image no aporta nada.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
      ) : (
        <EmptySheet />
      )}
      {children}
    </div>
  );
}

/** Hoja de pentagramas en blanco: lo que se ve mientras no hay portada. */
function EmptySheet() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-6 px-3.5" aria-hidden>
      {[0, 1, 2].map((system) => (
        <div key={system} className="relative">
          <div className="space-y-[6px]">
            {[0, 1, 2, 3, 4].map((line) => (
              <div key={line} className="h-px bg-ink-3 opacity-40" />
            ))}
          </div>
          {system === 0 && (
            <div className="absolute inset-y-0 left-0.5 flex items-center gap-2 text-ink-2">
              <GlyphIcon name="gClef" size={34} fit="em" />
              <GlyphIcon name="fClef" size={34} fit="em" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Etiqueta sobre la portada (nivel, formato). Abajo a la izquierda salvo que se diga otra cosa. */
export function CoverTag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`absolute bottom-2 left-2 rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide shadow-sm ${className || "bg-surface/90 text-ink-2 ring-1 ring-line backdrop-blur"}`}
    >
      {children}
    </span>
  );
}

/** Insignia redonda de una capacidad de la partitura (suena, tiene trazos, está compartida). */
export function CoverDot({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <span
      title={label}
      aria-label={label}
      className={`grid h-6 w-6 place-items-center rounded-full shadow-sm ${className || "bg-surface/90 text-ink-2 ring-1 ring-line backdrop-blur"}`}
    >
      {children}
    </span>
  );
}

/**
 * El texto de una tarjeta, debajo de la portada y fuera de ella: el título en
 * grande y una línea de contexto (autor, dueño, tamaño). Lo comparten las
 * tres cuadrículas para que se lean igual.
 */
export function TileText({ title, meta, sub }: { title: ReactNode; meta?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mt-2.5 space-y-0.5">
      <p className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight">{title}</p>
      {meta && <p className="line-clamp-1 text-xs text-ink-2">{meta}</p>}
      {sub && <p className="line-clamp-1 text-[11px] text-ink-3">{sub}</p>}
    </div>
  );
}
