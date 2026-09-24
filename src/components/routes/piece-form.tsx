"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { newPiece, PIECE_KIND_LABELS, PIECE_KINDS, type PieceKind, type RoutePiece } from "@/lib/study-route";

/** Adds or edits a piece of the route. Only the title is required. */
export function PieceForm({ open, piece, kind, onClose, onSave }: { open: boolean; piece?: RoutePiece | null; kind?: PieceKind; onClose: () => void; onSave: (p: RoutePiece) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={piece ? "Editar la pieza" : "Añadir una pieza"} subtitle={piece ? piece.title : "Solo el nombre es obligatorio"}>
      {/* keyed on the piece so reopening the sheet starts from its current values */}
      {open && <Fields key={piece?.id ?? "new"} piece={piece ?? null} kind={kind ?? "core"} onClose={onClose} onSave={onSave} />}
    </Sheet>
  );
}

function Fields({ piece, kind, onClose, onSave }: { piece: RoutePiece | null; kind: PieceKind; onClose: () => void; onSave: (p: RoutePiece) => void }) {
  const [title, setTitle] = useState(piece?.title ?? "");
  const [detail, setDetail] = useState(piece?.detail ?? "");
  const [why, setWhy] = useState(piece?.why ?? "");
  const [estimate, setEstimate] = useState(piece?.estimate ?? "");
  const [tag, setTag] = useState(piece?.tag ?? "");
  const [pieceKind, setPieceKind] = useState<PieceKind>(piece?.kind ?? kind);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    onSave(newPiece({ ...piece, title: clean, detail: detail.trim(), why: why.trim(), estimate: estimate.trim(), tag: tag.trim().toLowerCase(), kind: pieceKind }));
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-3 pb-2">
      <Field label="Pieza" htmlFor="piece-title">
        <input id="piece-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Minueto en sol mayor" className="field h-12 text-sm" required maxLength={300} />
      </Field>
      <Field label="Detalle" htmlFor="piece-detail" hint="Catálogo, colección, compositor">
        <input id="piece-detail" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="BWV Anh. 114 · Cuaderno de A. M. Bach" className="field h-12 text-sm" maxLength={300} />
      </Field>
      <Field label="Qué desarrolla" htmlFor="piece-why">
        <textarea id="piece-why" value={why} onChange={(e) => setWhy(e.target.value)} rows={2} placeholder="Independencia de voces, legato sin pedal…" className="field h-auto resize-y py-3 text-sm" maxLength={6000} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tiempo estimado" htmlFor="piece-estimate">
          <input id="piece-estimate" value={estimate} onChange={(e) => setEstimate(e.target.value)} placeholder="3–4 sem." className="field h-12 text-sm" maxLength={300} />
        </Field>
        <Field label="Etiqueta" htmlFor="piece-tag" hint="entrada, reto, meta…">
          <input id="piece-tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="reto" className="field h-12 text-sm" maxLength={30} />
        </Field>
      </div>
      <div role="radiogroup" aria-label="Tipo de pieza" className="flex gap-2">
        {PIECE_KINDS.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={pieceKind === k} onClick={() => setPieceKind(k)} className={`pill flex-1 justify-center py-2 text-sm ${pieceKind === k ? "pill-active" : ""}`}>
            {PIECE_KIND_LABELS[k]}
          </button>
        ))}
      </div>
      <p className="px-1 text-xs text-ink-3">Las obligatorias van en orden, una detrás de otra. Las de gusto se trabajan en paralelo y no cuentan para el avance.</p>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={!title.trim()} className="btn-primary flex-1 text-sm disabled:opacity-50">
          {piece ? "Guardar" : "Añadir"}
        </button>
        <button type="button" onClick={onClose} className="btn-secondary text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">{label}</span>
        {hint && <span className="text-[11px] text-ink-3">{hint}</span>}
      </label>
      {children}
    </div>
  );
}
