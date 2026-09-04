"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { renderPage } from "@/lib/pdf-thumbnail";
import { updateScoreAnnotations, updateScoreNotes, type Annotations, type ScoreRecord, type Stroke } from "@/lib/scores-db";
import { ChevronIcon } from "@/components/ui/arrow-icon";
import { MusicXmlViewer } from "./musicxml-viewer";
import { PEN_COLORS, ScoreAnnotator, type Tool } from "./score-annotator";

interface Props {
  record: ScoreRecord;
  onClose: () => void;
  onDelete: () => void;
  onNotesChange: (notes: string) => void;
}

export function ScoreViewer({ record, onClose, onDelete, onNotesChange }: Props) {
  const [notes, setNotes] = useState(record.notes);
  const [showNotes, setShowNotes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isXml = record.kind === "musicxml";

  const saveNotes = (v: string) => {
    setNotes(v);
    onNotesChange(v);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void updateScoreNotes(record.id, v), 800);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onClose} className="btn-circle w-10 h-10" aria-label="Volver">
          <ChevronIcon dir="left" className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold truncate">{record.name}</h1>
          {!isXml && (
            <p className="text-xs text-ink-2">{record.pageCount} {record.pageCount === 1 ? "página" : "páginas"}</p>
          )}
        </div>
        <button type="button" onClick={() => setShowNotes((v) => !v)} className={`pill text-xs py-1.5 ${showNotes ? "pill-active" : ""}`}>
          Notas
        </button>
        {!confirmDelete ? (
          <button type="button" onClick={() => setConfirmDelete(true)} className="text-xs text-bad hover:underline">Eliminar</button>
        ) : (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-bad font-semibold">¿Seguro?</span>
            <button type="button" onClick={onDelete} className="text-bad underline">Sí</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-ink-2 underline">No</button>
          </span>
        )}
      </div>

      {showNotes && (
        <textarea
          value={notes}
          onChange={(e) => saveNotes(e.target.value)}
          placeholder="Escribe aquí tus notas personales sobre esta partitura…"
          rows={4}
          className="w-full rounded-2xl px-4 py-3 text-sm bg-surface border border-surface-3 focus:outline-none focus:border-accent resize-none"
        />
      )}

      {isXml ? <MusicXmlViewer record={record} /> : <PdfViewer record={record} />}
    </div>
  );
}

/** Páginas del PDF con zoom y una capa para dibujar encima. */
function PdfViewer({ record }: { record: ScoreRecord }) {
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [tool, setTool] = useState<Tool | null>(null);
  const [color, setColor] = useState(PEN_COLORS[0].value);
  const [annotations, setAnnotations] = useState<Annotations>(record.annotations ?? {});
  const pageRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draw = useCallback(async () => {
    const holder = pageRef.current;
    if (!holder) return;
    const canvas = await renderPage(record.file, page, scale);
    if (!pageRef.current) return;
    holder.replaceChildren(canvas);
    setSize({ w: canvas.width, h: canvas.height });
  }, [record.file, page, scale]);

  useEffect(() => {
    void draw();
  }, [draw]);

  const strokes = annotations[page] ?? [];
  const setStrokes = (next: Stroke[]) => {
    const all = { ...annotations, [page]: next };
    setAnnotations(all);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void updateScoreAnnotations(record.id, all), 600);
  };

  const toolButton = (t: Tool, label: string) => (
    <button
      type="button"
      onClick={() => setTool((cur) => (cur === t ? null : t))}
      className={`pill text-xs py-1.5 ${tool === t ? "pill-active" : ""}`}
      aria-pressed={tool === t}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-circle w-9 h-9 disabled:opacity-40"
            aria-label="Página anterior"
          >
            <ChevronIcon dir="left" className="w-4 h-4" />
          </button>
          <span className="text-sm tabular-nums">{page} / {record.pageCount}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(record.pageCount, p + 1))}
            disabled={page === record.pageCount}
            className="btn-circle w-9 h-9 disabled:opacity-40"
            aria-label="Página siguiente"
          >
            <ChevronIcon dir="right" className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setScale((s) => Math.max(0.5, s - 0.25))} className="btn-circle w-9 h-9 text-sm" aria-label="Reducir">−</button>
          <span className="text-xs text-ink-2 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => setScale((s) => Math.min(3, s + 0.25))} className="btn-circle w-9 h-9 text-sm" aria-label="Ampliar">+</button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {toolButton("pen", "✎ Lápiz")}
        {toolButton("highlighter", "Subrayador")}
        {toolButton("eraser", "Borrador")}
        {tool === "pen" && (
          <span className="flex items-center gap-1.5 ml-1">
            {PEN_COLORS.map((c) => (
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
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStrokes(strokes.slice(0, -1))}
            disabled={!strokes.length}
            className="pill text-xs py-1.5 disabled:opacity-40"
          >
            Deshacer
          </button>
          <button
            type="button"
            onClick={() => setStrokes([])}
            disabled={!strokes.length}
            className="pill text-xs py-1.5 disabled:opacity-40"
          >
            Limpiar página
          </button>
        </span>
      </div>
      {tool && <p className="text-xs text-ink-3">Dibuja sobre la página. Vuelve a pulsar la herramienta para desactivarla y poder desplazarte.</p>}

      <div className="overflow-auto rounded-2xl bg-surface-2 min-h-64 p-2">
        <div className="relative mx-auto w-fit shadow-lg" style={size ? { width: size.w, height: size.h } : undefined}>
          <div ref={pageRef} />
          {size && (
            <ScoreAnnotator width={size.w} height={size.h} strokes={strokes} onChange={setStrokes} tool={tool} color={color} />
          )}
        </div>
      </div>
    </div>
  );
}
