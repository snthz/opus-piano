"use client";

import { useEffect, useState } from "react";
import { getPageSize, renderPage } from "@/lib/pdf-thumbnail";
import type { Stroke } from "@/lib/scores-db";
import type { MeasureBox } from "@/lib/score-layout";
import { ScoreAnnotator, type Tool } from "./score-annotator";

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
  /** Compás que suena y fracción recorrida, para la guía */
  guide?: { box: MeasureBox; frac: number } | null;
}

/**
 * Una página del PDF ajustada a una caja, con la capa de anotaciones y la guía
 * de reproducción encima. Se dibuja con la densidad de la pantalla.
 */
export function PdfPage({ file, page, fit, zoom, strokes, onStrokes, tool, color, guide }: Props) {
  const [dims, setDims] = useState<{ page: number; width: number; height: number } | null>(null);
  const [holder, setHolder] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPageSize(file, page).then((d) => !cancelled && setDims({ page, ...d }));
    return () => {
      cancelled = true;
    };
  }, [file, page]);

  const ready = dims && dims.page === page && fit.w > 0 && fit.h > 0;
  const scale = ready ? Math.min(fit.w / dims.width, fit.h / dims.height) * zoom : 0;
  const cssW = ready ? Math.max(80, dims.width * scale) : 0;
  const cssH = ready ? Math.max(80, dims.height * scale) : 0;

  useEffect(() => {
    if (!ready || !holder) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let cancelled = false;
    renderPage(file, page, (cssW / dims.width) * dpr).then((canvas) => {
      if (cancelled) return;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      holder.replaceChildren(canvas);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, holder, file, page, cssW, cssH, dims]);

  if (!ready) return <div className="bg-white/60 rounded" style={{ width: fit.w, height: fit.h }} />;

  return (
    <div className="relative shadow-lg bg-white" style={{ width: cssW, height: cssH }}>
      <div ref={setHolder} />
      {guide && (
        <>
          <div
            className="absolute rounded-sm pointer-events-none bg-accent/15 transition-[left,top,width,height] duration-150"
            style={{
              left: guide.box.x0 * cssW,
              top: guide.box.top * cssH,
              width: (guide.box.x1 - guide.box.x0) * cssW,
              height: (guide.box.bottom - guide.box.top) * cssH,
            }}
          />
          <div
            className="absolute w-0.5 pointer-events-none bg-accent"
            style={{
              left: (guide.box.x0 + guide.frac * (guide.box.x1 - guide.box.x0)) * cssW,
              top: guide.box.top * cssH,
              height: (guide.box.bottom - guide.box.top) * cssH,
            }}
          />
        </>
      )}
      <ScoreAnnotator width={cssW} height={cssH} strokes={strokes} onChange={onStrokes} tool={tool} color={color} />
    </div>
  );
}
