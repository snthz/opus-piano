"use client";

import { useEffect, useState } from "react";
import { listScores, deleteScore, type ScoreRecord } from "@/lib/scores-db";
import { ScoreUpload } from "./score-upload";
import { ScoreViewer } from "./score-viewer";
import { GlyphIcon } from "@/components/notation/glyph-icon";

export function ScoreLibrary() {
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<ScoreRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = () => listScores().then((s) => { setScores(s); setLoaded(true); });
  useEffect(() => { void reload(); }, []);

  const onAdded = (r: ScoreRecord) => setScores((prev) => [r, ...prev]);

  const onDelete = async (id: string) => {
    await deleteScore(id);
    setScores((prev) => prev.filter((s) => s.id !== id));
    if (viewing?.id === id) setViewing(null);
  };

  const onNotesChange = (id: string, notes: string) => {
    setScores((prev) => prev.map((s) => (s.id === id ? { ...s, notes } : s)));
    if (viewing?.id === id) setViewing((v) => (v ? { ...v, notes } : v));
  };

  if (viewing) {
    return (
      <ScoreViewer
        record={viewing}
        // Al volver se relee la biblioteca: notas y trazos guardados mientras se veía la partitura.
        onClose={() => { setViewing(null); void reload(); }}
        onDelete={() => void onDelete(viewing.id)}
        onNotesChange={(notes) => onNotesChange(viewing.id, notes)}
      />
    );
  }

  const filtered = scores.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <ScoreUpload onAdded={onAdded} />

      {scores.length > 0 && (
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar partitura…"
          className="w-full rounded-2xl px-4 py-2 bg-surface border border-surface-3 text-sm focus:outline-none focus:border-accent"
        />
      )}

      {!loaded && <p className="text-sm text-ink-2 text-center">Cargando…</p>}

      {loaded && scores.length === 0 && (
        <p className="text-sm text-ink-2 text-center py-8">
          No tienes partituras guardadas. Añade arriba tu primer PDF o MusicXML.
        </p>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <ScoreCard key={s.id} record={s} onOpen={() => setViewing(s)} onDelete={() => void onDelete(s.id)} />
          ))}
        </div>
      )}

      {search && filtered.length === 0 && (
        <p className="text-sm text-ink-2 text-center">Sin resultados para «{search}».</p>
      )}
    </div>
  );
}

function ScoreCard({ record, onOpen, onDelete }: { record: ScoreRecord; onOpen: () => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="card p-0 overflow-hidden group cursor-pointer" onClick={onOpen}>
      <div className="relative bg-surface-2 aspect-[3/4]">
        {record.thumbnail ? (
          // La miniatura es un data URL generado en el dispositivo: next/image no puede optimizarla.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={record.thumbnail} alt={record.name} className="w-full h-full object-cover" />
        ) : (
          // MusicXML no tiene páginas que miniaturizar: una tarjeta con las dos claves.
          <div className="w-full h-full bg-lavender flex items-center justify-center gap-3 text-ink">
            <GlyphIcon name="gClef" size={44} fit="em" />
            <GlyphIcon name="fClef" size={44} fit="em" />
          </div>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
          className="absolute top-2 right-2 btn-circle w-7 h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Eliminar"
        >
          ✕
        </button>
        {confirmDelete && (
          <div
            className="absolute inset-0 bg-ink/70 flex flex-col items-center justify-center gap-2 p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-bg text-xs font-semibold text-center">¿Eliminar esta partitura?</p>
            <div className="flex gap-2">
              <button type="button" onClick={onDelete} className="pill pill-active text-xs py-1 px-3 !bg-bad">Sí, borrar</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="pill text-xs py-1 px-3 bg-surface text-ink">Cancelar</button>
            </div>
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs font-semibold truncate">{record.name}</p>
        <p className="text-xs text-ink-2">
          {record.kind === "musicxml"
            ? `${record.pageCount} ${record.pageCount === 1 ? "compás" : "compases"} · se puede escuchar`
            : `${record.pageCount} ${record.pageCount === 1 ? "página" : "páginas"}`}
        </p>
      </div>
    </div>
  );
}
