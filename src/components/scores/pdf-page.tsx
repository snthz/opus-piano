"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getPageSize, releaseCanvas, renderPage } from "@/lib/pdf-thumbnail";
import type { Stroke } from "@/lib/scores-db";
import type { MeasureBox } from "@/lib/score-layout";
import { ScoreAnnotator, type Finger, type Tool } from "./score-annotator";

interface Props {
  file: Blob;
  page: number;
  /** Caja en la que debe caber la página entera (px CSS) */
  fit: { w: number; h: number };
  /** Multiplicador sobre el ajuste; 1 = cabe entera */
  zoom: number;
  strokes: Stroke[];
  onStrokes: (s: Stroke[]) => void;
  tool: Tool | null;
  color: string;
  highlightColor?: string;
  penWidth?: number;
  linerWidth?: number;
  finger?: Finger;
  fingerSize?: number;
  /** Compás que suena y fracción recorrida, para la guía */
  guide?: { box: MeasureBox; frac: number } | null;
}

const describe = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Una página del PDF ajustada a una caja, con la capa de anotaciones y la guía
 * de reproducción encima. Se dibuja con la densidad de la pantalla.
 */
export function PdfPage({ file, page, fit, zoom, strokes, onStrokes, tool, color, highlightColor, penWidth, linerWidth, finger, fingerSize, guide }: Props) {
  const [dims, setDims] = useState<{ page: number; width: number; height: number } | null>(null);
  const [holder, setHolder] = useState<HTMLDivElement | null>(null);
  // a failure says what went wrong on the page itself, instead of a gray box
  // forever; tied to its file and page so another page starts clean
  const [failure, setFailure] = useState<{ file: Blob; page: number; message: string } | null>(null);
  const error = failure && failure.file === file && failure.page === page ? failure.message : null;
  /** Lienzo pintado y la resolución (página y px de ancho) a la que se trazó */
  const drawn = useRef<{ canvas: HTMLCanvasElement; key: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPageSize(file, page)
      .then((d) => !cancelled && setDims({ page, ...d }))
      .catch((e) => !cancelled && setFailure({ file, page, message: describe(e) }));
    return () => {
      cancelled = true;
    };
  }, [file, page]);

  const ready = dims && dims.page === page && fit.w > 0 && fit.h > 0;
  const scale = ready ? Math.min(fit.w / dims.width, fit.h / dims.height) * zoom : 0;
  const cssW = ready ? Math.max(80, dims.width * scale) : 0;
  const cssH = ready ? Math.max(80, dims.height * scale) : 0;

  // El lienzo que ya hay se reescala al instante con CSS, antes de pintar: el
  // zoom se ve fluido mientras llega el trazado a la nueva resolución.
  useLayoutEffect(() => {
    const c = drawn.current?.canvas;
    if (!c) return;
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;
  }, [cssW, cssH]);

  // Trazar con pdf.js es caro: se espera a que la escala se asiente y no se
  // repite si el lienzo ya está a esa resolución.
  useEffect(() => {
    if (!ready || !holder) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const key = `${page}:${Math.round(cssW * dpr)}`;
    const cur = drawn.current;
    if (cur && cur.key === key && cur.canvas.parentNode === holder) return;
    // a render that's been overtaken by another scale is stopped, not left to
    // finish: at a high zoom each one is a canvas of tens of megabytes
    const abort = new AbortController();
    const draw = () =>
      renderPage(file, page, (cssW / dims.width) * dpr, abort.signal)
        .then((canvas) => {
          if (abort.signal.aborted) return releaseCanvas(canvas);
          canvas.style.width = `${cssW}px`;
          canvas.style.height = `${cssH}px`;
          const old = drawn.current?.canvas;
          holder.replaceChildren(canvas);
          if (old && old !== canvas) releaseCanvas(old);
          drawn.current = { canvas, key };
        })
        .catch((e) => !abort.signal.aborted && setFailure({ file, page, message: describe(e) }));
    const timer = setTimeout(draw, cur ? 160 : 0);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [ready, holder, file, page, cssW, cssH, dims]);

  // leaving the screen, the page gives its pixels back at once instead of whenever the GC gets to it
  useEffect(
    () => () => {
      if (drawn.current) releaseCanvas(drawn.current.canvas);
      drawn.current = null;
    },
    [],
  );

  if (error) {
    return (
      <div className="bg-surface rounded-2xl grid place-items-center p-6 text-center" style={{ width: fit.w, height: Math.min(fit.h, 240) }}>
        <div className="space-y-1">
          <p className="text-sm font-semibold">No se pudo mostrar esta página</p>
          <p className="text-xs text-ink-2 break-words">{error}</p>
        </div>
      </div>
    );
  }

  if (!ready) return <div className="bg-white/60 rounded" style={{ width: fit.w, height: fit.h }} />;

  return (
    <div data-page={page} className="relative shadow-lg bg-white" style={{ width: cssW, height: cssH }}>
      <div ref={setHolder} />
      {guide && (
        <>
          <div
            className="absolute rounded-sm pointer-events-none bg-ok/20 transition-[left,top,width,height] duration-150"
            style={{
              left: guide.box.x0 * cssW,
              top: guide.box.top * cssH,
              width: (guide.box.x1 - guide.box.x0) * cssW,
              height: (guide.box.bottom - guide.box.top) * cssH,
            }}
          />
          <div
            className="absolute w-0.5 pointer-events-none bg-ok"
            style={{
              left: (guide.box.x0 + guide.frac * (guide.box.x1 - guide.box.x0)) * cssW,
              top: guide.box.top * cssH,
              height: (guide.box.bottom - guide.box.top) * cssH,
            }}
          />
        </>
      )}
      <ScoreAnnotator
        width={cssW}
        height={cssH}
        strokes={strokes}
        onChange={onStrokes}
        tool={tool}
        color={color}
        highlightColor={highlightColor}
        penWidth={penWidth}
        linerWidth={linerWidth}
        finger={finger}
        fingerSize={fingerSize}
      />
    </div>
  );
}
