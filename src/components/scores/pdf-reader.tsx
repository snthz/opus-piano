"use client";

import { useEffect, useRef, useState } from "react";
import { getPageSize, renderPage } from "@/lib/pdf-thumbnail";
import { parseMusicXml, unpackMxl } from "@/lib/music/musicxml";
import {
  updateScoreAnnotations,
  updateScoreLinkedXml,
  updateScoreNotes,
  type Annotations,
  type ScoreRecord,
  type Stroke,
} from "@/lib/scores-db";
import { useSettings } from "@/lib/settings";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { PEN_COLORS, ScoreAnnotator, type Tool } from "./score-annotator";
import { ScoreSheet } from "./score-sheet";
import { useParsedXml, useScorePlayer } from "./use-score-player";

interface Props {
  record: ScoreRecord;
  onClose: () => void;
  onDelete: () => void;
  onNotesChange: (notes: string) => void;
}

const EyeOff = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-5 h-5">
    <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 8.5 4 9.7 7a13 13 0 0 1-2.5 3.6M6.3 6.3C4.2 7.7 2.9 9.6 2.3 12c1.2 3 4.7 7 9.7 7 1.6 0 3-.4 4.3-1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Eye = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="w-5 h-5">
    <path d="M2.3 12C3.5 9 7 5 12 5s8.5 4 9.7 7c-1.2 3-4.7 7-9.7 7s-8.5-4-9.7-7z" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * Lector a pantalla completa: la página ocupa todo, ajustada al ancho, y los
 * controles flotan encima. Se pueden ocultar para leer sin nada delante.
 */
export function PdfReader({ record, onClose, onDelete, onNotesChange }: Props) {
  const { settings } = useSettings();
  const [page, setPage] = useState(1);
  /** 1 = la página cabe justo en el ancho */
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<Tool | null>(null);
  const [color, setColor] = useState(PEN_COLORS[0].value);
  const [annotations, setAnnotations] = useState<Annotations>(record.annotations ?? {});
  const [chrome, setChrome] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(record.notes);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkedXml, setLinkedXml] = useState<Blob | undefined>(record.linkedXml);
  const [askXml, setAskXml] = useState(false);
  const [xmlIssue, setXmlIssue] = useState<string | null>(null);
  const [view, setView] = useState<"pdf" | "xml">("pdf");
  const [showNames, setShowNames] = useState(true);
  const [pageDims, setPageDims] = useState<{ page: number; width: number; height: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [css, setCss] = useState<{ w: number; h: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xmlInput = useRef<HTMLInputElement>(null);

  const { parsed, error: xmlError } = useParsedXml(linkedXml);
  const player = useScorePlayer(parsed);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Ancho disponible para ajustar la página; cambia al girar el teléfono.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    getPageSize(record.file, page).then((d) => !cancelled && setPageDims({ page, ...d }));
    return () => {
      cancelled = true;
    };
  }, [record.file, page]);

  // Se dibuja a la escala que hace que la página mida exactamente el ancho por el zoom,
  // y con la densidad de píxeles de la pantalla para que no se vea borrosa.
  useEffect(() => {
    // Al volver de la vista MusicXML el contenedor es nuevo pero el ancho no cambia:
    // sin `view` en las dependencias, la página quedaría en blanco.
    if (view !== "pdf" || !pageDims || pageDims.page !== page || !containerWidth) return;
    // En pantallas grandes, el 100 % es un ancho de lectura cómodo, no todo el monitor.
    const cssW = Math.max(160, Math.min(containerWidth - 24, 900) * zoom);
    const cssH = (cssW * pageDims.height) / pageDims.width;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let cancelled = false;
    renderPage(record.file, page, (cssW / pageDims.width) * dpr).then((canvas) => {
      if (cancelled || !pageRef.current) return;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      pageRef.current.replaceChildren(canvas);
      setCss({ w: cssW, h: cssH });
    });
    return () => {
      cancelled = true;
    };
  }, [record.file, page, zoom, pageDims, containerWidth, view]);

  const strokes = annotations[page] ?? [];
  const setStrokes = (next: Stroke[]) => {
    const all = { ...annotations, [page]: next };
    setAnnotations(all);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void updateScoreAnnotations(record.id, all), 600);
  };

  const saveNotes = (v: string) => {
    setNotes(v);
    onNotesChange(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void updateScoreNotes(record.id, v), 800);
  };

  const linkXml = async (file: File) => {
    try {
      const xml = /\.mxl$/i.test(file.name) ? unpackMxl(new Uint8Array(await file.arrayBuffer())) : await file.text();
      parseMusicXml(xml); // valida antes de guardar
      const blob = new Blob([xml], { type: "application/vnd.recordare.musicxml+xml" });
      await updateScoreLinkedXml(record.id, blob);
      setLinkedXml(blob);
      setXmlIssue(null);
      setAskXml(false);
      setView("xml");
    } catch (e) {
      setXmlIssue(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  };

  const unlinkXml = async () => {
    player.stop();
    await updateScoreLinkedXml(record.id, undefined);
    setLinkedXml(undefined);
    setView("pdf");
  };

  const onPlay = () => {
    if (!linkedXml) {
      setAskXml(true);
      return;
    }
    void player.toggle();
  };

  const circle = "btn-circle w-10 h-10 shadow-md";
  const toolButton = (t: Tool, label: string) => (
    <button
      type="button"
      onClick={() => setTool((cur) => (cur === t ? null : t))}
      aria-pressed={tool === t}
      className={`pill text-xs py-1.5 ${tool === t ? "pill-active" : ""}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-surface-2 flex flex-col" role="dialog" aria-label={record.name}>
      {/* ---- Contenido ---- */}
      {view === "pdf" ? (
        <div ref={scrollRef} className={`flex-1 overflow-auto px-3 ${chrome ? "pt-16 pb-36" : "py-3"}`}>
          <div className="relative mx-auto w-fit shadow-lg bg-white" style={css ? { width: css.w, height: css.h } : undefined}>
            <div ref={pageRef} />
            {css && <ScoreAnnotator width={css.w} height={css.h} strokes={strokes} onChange={setStrokes} tool={tool} color={color} />}
          </div>
        </div>
      ) : (
        <div className={`flex-1 overflow-auto px-3 ${chrome ? "pt-16 pb-36" : "py-3"}`}>
          <div className="max-w-4xl mx-auto">
            {xmlError && <p className="text-sm text-bad">{xmlError}</p>}
            {parsed ? <ScoreSheet parsed={parsed} active={player.active} showNames={showNames} /> : <p className="text-sm text-ink-2">Leyendo…</p>}
          </div>
        </div>
      )}

      {/* ---- Mostrar controles cuando están ocultos ---- */}
      {!chrome && (
        <button type="button" onClick={() => setChrome(true)} className={`${circle} fixed top-3 right-3`} aria-label="Mostrar controles">
          {Eye}
        </button>
      )}

      {chrome && (
        <>
          {/* ---- Barra superior ---- */}
          <div className="fixed top-3 left-3 right-3 flex items-center gap-2">
            <button type="button" onClick={onClose} className={circle} aria-label="Volver">
              <ChevronIcon dir="left" className="w-5 h-5" />
            </button>
            <div className="card flex-1 min-w-0 px-4 py-2 shadow-md">
              <p className="font-semibold text-sm truncate">{record.name}</p>
              <p className="text-[11px] text-ink-2 truncate">
                {view === "pdf" ? `Página ${page} de ${record.pageCount}` : "Partitura MusicXML vinculada"}
                {linkedXml && parsed && view === "pdf" ? " · se puede escuchar" : ""}
              </p>
            </div>
            <button type="button" onClick={() => setNotesOpen((v) => !v)} className={`${circle} ${notesOpen ? "" : "!bg-surface !text-ink"}`} aria-label="Notas y opciones">
              <span className="text-base leading-none">✎</span>
            </button>
            <button type="button" onClick={() => { setChrome(false); setNotesOpen(false); }} className={`${circle} !bg-surface !text-ink`} aria-label="Ocultar controles">
              {EyeOff}
            </button>
          </div>

          {/* ---- Panel de notas y opciones ---- */}
          {notesOpen && (
            <div className="fixed top-16 left-3 right-3 card p-3 shadow-md space-y-3 max-w-lg ml-auto">
              <textarea
                value={notes}
                onChange={(e) => saveNotes(e.target.value)}
                placeholder="Notas personales sobre esta partitura…"
                rows={3}
                className="w-full rounded-2xl px-3 py-2 text-sm bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {linkedXml ? (
                  <button type="button" onClick={() => void unlinkXml()} className="pill py-1">Quitar MusicXML vinculado</button>
                ) : (
                  <button type="button" onClick={() => { setAskXml(true); setNotesOpen(false); }} className="pill py-1">Vincular MusicXML</button>
                )}
                <span className="ml-auto">
                  {!confirmDelete ? (
                    <button type="button" onClick={() => setConfirmDelete(true)} className="text-bad hover:underline">Eliminar partitura</button>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="text-bad font-semibold">¿Seguro?</span>
                      <button type="button" onClick={onDelete} className="text-bad underline">Sí</button>
                      <button type="button" onClick={() => setConfirmDelete(false)} className="text-ink-2 underline">No</button>
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* ---- Barra inferior ---- */}
          <div className="fixed bottom-3 inset-x-3 flex justify-center pointer-events-none">
            <div className="pointer-events-auto card shadow-md p-2 flex flex-wrap items-center justify-center gap-1.5 max-w-2xl">
              {view === "pdf" && (
                <>
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-circle w-9 h-9 disabled:opacity-40" aria-label="Página anterior">
                    <ChevronIcon dir="left" className="w-4 h-4" />
                  </button>
                  <span className="text-xs tabular-nums px-1">{page}/{record.pageCount}</span>
                  <button type="button" onClick={() => setPage((p) => Math.min(record.pageCount, p + 1))} disabled={page === record.pageCount} className="btn-circle w-9 h-9 disabled:opacity-40" aria-label="Página siguiente">
                    <ChevronIcon dir="right" className="w-4 h-4" />
                  </button>
                  <span className="w-px h-6 bg-surface-3 mx-1" />
                  <button type="button" onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))} className="btn-circle w-9 h-9 text-sm" aria-label="Reducir">−</button>
                  <button type="button" onClick={() => setZoom(1)} className="text-xs tabular-nums w-10 text-center" title="Ajustar al ancho">{Math.round(zoom * 100)}%</button>
                  <button type="button" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="btn-circle w-9 h-9 text-sm" aria-label="Ampliar">+</button>
                  <span className="w-px h-6 bg-surface-3 mx-1" />
                  {toolButton("pen", "✎")}
                  {toolButton("highlighter", "Sub.")}
                  {toolButton("eraser", "Borr.")}
                  {tool === "pen" &&
                    PEN_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setColor(c.value)}
                        aria-label={c.label}
                        aria-pressed={color === c.value}
                        className={`w-6 h-6 rounded-full border-2 ${color === c.value ? "border-accent scale-110" : "border-transparent"}`}
                        style={{ background: c.value }}
                      />
                    ))}
                  <button type="button" onClick={() => setStrokes(strokes.slice(0, -1))} disabled={!strokes.length} className="pill text-xs py-1.5 disabled:opacity-40" aria-label="Deshacer">↶</button>
                  <span className="w-px h-6 bg-surface-3 mx-1" />
                </>
              )}

              <button
                type="button"
                onClick={onPlay}
                disabled={!settings.sound || (!!linkedXml && !parsed)}
                title={settings.sound ? undefined : "El sonido está desactivado en Ajustes"}
                className={`pill text-xs py-1.5 ${player.playing ? "pill-active" : "bg-accent text-white"} disabled:opacity-50`}
              >
                {player.playing ? "■ Detener" : "▶ Escuchar"}
              </button>
              {linkedXml && (
                <>
                  <button type="button" onClick={() => setView((v) => (v === "pdf" ? "xml" : "pdf"))} className="pill text-xs py-1.5">
                    {view === "pdf" ? "Ver con nombres" : "Ver PDF"}
                  </button>
                  {view === "xml" && (
                    <button type="button" onClick={() => setShowNames((v) => !v)} className={`pill text-xs py-1.5 ${showNames ? "pill-active" : ""}`}>
                      Nombres
                    </button>
                  )}
                  <label className="flex items-center gap-1.5 text-[11px] text-ink-2 px-1">
                    ♩={player.tempo}
                    <input type="range" min={40} max={200} value={player.tempo} onChange={(e) => player.setTempo(Number(e.target.value))} disabled={player.playing} className="accent-(--accent) w-20" aria-label="Tempo" />
                  </label>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ---- Cómo conseguir la reproducción ---- */}
      {askXml && (
        <div className="fixed inset-0 z-10 bg-ink/40 flex items-end sm:items-center justify-center p-3" onClick={() => setAskXml(false)}>
          <div className="card p-5 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold">Escuchar esta partitura</h2>
            <p className="text-sm text-ink-2">
              Un PDF es solo una imagen: Etude no puede leer las notas de él. Para tocar la pieza y mostrarte el nombre
              de cada nota necesita el <strong>MusicXML</strong> de esa misma partitura, que se vincula a este PDF.
            </p>
            <ul className="text-xs text-ink-2 list-disc pl-4 space-y-1">
              <li>En MuseScore: abre la pieza y usa «Archivo → Exportar → MusicXML».</li>
              <li>En musescore.com y otras webs de partituras suele haber descarga en MusicXML (.mxl).</li>
            </ul>
            <input
              ref={xmlInput}
              type="file"
              accept=".musicxml,.mxl,.xml"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && void linkXml(e.target.files[0])}
            />
            {xmlIssue && <p className="text-xs text-bad">{xmlIssue}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAskXml(false)} className="pill text-xs py-1.5">Ahora no</button>
              <button type="button" onClick={() => xmlInput.current?.click()} className="pill pill-active text-xs py-1.5">Elegir MusicXML</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
