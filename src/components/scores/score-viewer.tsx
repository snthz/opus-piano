"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { renderPage } from "@/lib/pdf-thumbnail";
import { updateScoreNotes, type ScoreRecord } from "@/lib/scores-db";
import { ChevronIcon } from "@/components/ui/arrow-icon";

interface Props {
  record: ScoreRecord;
  onClose: () => void;
  onDelete: () => void;
  onNotesChange: (notes: string) => void;
}

export function ScoreViewer({ record, onClose, onDelete, onNotesChange }: Props) {
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [notes, setNotes] = useState(record.notes);
  const [showNotes, setShowNotes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draw = useCallback(async () => {
    const container = canvasRef.current;
    if (!container) return;
    container.innerHTML = "";
    const canvas = await renderPage(record.file, page, scale);
    canvas.className = "mx-auto shadow-lg";
    container.appendChild(canvas);
  }, [record.file, page, scale]);

  useEffect(() => { void draw(); }, [draw]);

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
          <p className="text-xs text-ink-2">{record.pageCount} {record.pageCount === 1 ? "página" : "páginas"}</p>
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
          <button type="button" onClick={() => setScale((s) => Math.max(0.5, s - 0.25))} className="btn-circle w-9 h-9 text-sm">−</button>
          <span className="text-xs text-ink-2 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => setScale((s) => Math.min(3, s + 0.25))} className="btn-circle w-9 h-9 text-sm">+</button>
        </div>
      </div>

      <div ref={canvasRef} className="overflow-auto rounded-2xl bg-surface-2 min-h-64 p-2" />
    </div>
  );
}
