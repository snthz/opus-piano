"use client";

import { useEffect, useState } from "react";
import { listScores, deleteScore, onScoresChange, updateScoreName, type ScoreRecord } from "@/lib/scores-db";
import { useScoresSync } from "@/lib/scores-sync";
import { useAuth } from "@/lib/auth";
import { openAuthModal } from "@/lib/auth-modal";
import { SignupNudge } from "@/components/account/signup-nudge";
import { ScoreUpload } from "./score-upload";
import { ScoreViewer } from "./score-viewer";
import { GlyphIcon } from "@/components/notation/glyph-icon";

export function ScoreLibrary() {
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<ScoreRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [added, setAdded] = useState(false);
  const sync = useScoresSync();
  const { user } = useAuth();

  const reload = () => listScores().then((s) => { setScores(s); setLoaded(true); });
  useEffect(() => { void reload(); }, []);
  // Lo que llega del servidor (otro dispositivo) aparece sin recargar la página.
  useEffect(() => onScoresChange((c) => { if (c.type !== "put" || c.source === "remote") void reload(); }), []);

  const onAdded = (r: ScoreRecord) => {
    setScores((prev) => [r, ...prev]);
    setAdded(true);
  };

  const onDelete = async (id: string) => {
    await deleteScore(id);
    setScores((prev) => prev.filter((s) => s.id !== id));
    if (viewing?.id === id) setViewing(null);
  };

  const patch = (id: string, changes: Partial<ScoreRecord>) => {
    setScores((prev) => prev.map((s) => (s.id === id ? { ...s, ...changes } : s)));
    if (viewing?.id === id) setViewing((v) => (v ? { ...v, ...changes } : v));
  };

  const rename = (id: string, name: string) => {
    patch(id, { name });
    void updateScoreName(id, name);
  };

  if (viewing) {
    return (
      <ScoreViewer
        record={viewing}
        // Al volver se relee la biblioteca: notas, trazos y vínculos guardados mientras se veía.
        onClose={() => { setViewing(null); void reload(); }}
        onDelete={() => void onDelete(viewing.id)}
        onNotesChange={(notes) => patch(viewing.id, { notes })}
        onRename={(name) => patch(viewing.id, { name })}
      />
    );
  }

  const filtered = scores.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <SignupNudge
        when={added}
        title="¿La guardamos en tu cuenta?"
        text="Con una cuenta, tus partituras, anotaciones y notas se guardan en el servidor y las abres desde cualquier dispositivo."
      />
      <ScoreUpload onAdded={onAdded} />

      {user ? (
        <p className="text-xs text-ink-3 px-1">
          {sync.busy
            ? "Sincronizando biblioteca…"
            : sync.error
              ? `Sin sincronizar: ${sync.error}`
              : sync.lastSync
                ? `Biblioteca sincronizada con tu cuenta${sync.quota ? ` · ${Math.round(sync.used / 1048576)} de ${Math.round(sync.quota / 1048576)} MB` : ""}`
                : "Biblioteca guardada en tu cuenta."}
        </p>
      ) : (
        <p className="text-xs text-ink-3 px-1">
          Tus partituras se guardan solo en este dispositivo.{" "}
          <button type="button" onClick={() => openAuthModal("register")} className="font-semibold text-ink hover:underline">
            Crea una cuenta
          </button>{" "}
          para tenerlas en todos.
        </p>
      )}

      {scores.length > 0 && (
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar partitura…"
            className="flex-1 rounded-2xl px-4 py-2 bg-surface border border-surface-3 text-sm focus:outline-none focus:border-accent"
          />
          <span className="text-xs text-ink-3 shrink-0">{scores.length} {scores.length === 1 ? "partitura" : "partituras"}</span>
        </div>
      )}

      {!loaded && <p className="text-sm text-ink-2 text-center">Cargando…</p>}

      {loaded && scores.length === 0 && (
        <p className="text-sm text-ink-2 text-center py-8">
          No tienes partituras guardadas. Añade arriba tu primer PDF o MusicXML.
        </p>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((s) => (
            <ScoreCard
              key={s.id}
              record={s}
              onOpen={() => setViewing(s)}
              onDelete={() => void onDelete(s.id)}
              onRename={(name) => rename(s.id, name)}
            />
          ))}
        </div>
      )}

      {search && filtered.length === 0 && (
        <p className="text-sm text-ink-2 text-center">Sin resultados para «{search}».</p>
      )}
    </div>
  );
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

function ScoreCard({
  record,
  onOpen,
  onDelete,
  onRename,
}: {
  record: ScoreRecord;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(record.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isXml = record.kind === "musicxml";
  const playable = isXml || !!record.linkedXml;
  const annotated = Object.values(record.annotations ?? {}).some((s) => s.length > 0);

  const commit = () => {
    const clean = draft.trim();
    setEditing(false);
    if (clean && clean !== record.name) onRename(clean);
    else setDraft(record.name);
  };

  return (
    <div className="card p-0 overflow-hidden group relative flex flex-col">
      <button type="button" onClick={onOpen} className="block text-left" aria-label={`Abrir ${record.name}`}>
        <div className="relative aspect-[3/4] bg-surface-2 overflow-hidden">
          {record.thumbnail ? (
            // La miniatura es un data URL generado en el dispositivo: next/image no puede optimizarla.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={record.thumbnail} alt="" className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            // MusicXML no tiene páginas que miniaturizar: una tarjeta con las dos claves.
            <div className="w-full h-full bg-lavender flex items-center justify-center gap-3 text-ink">
              <GlyphIcon name="gClef" size={44} fit="em" />
              <GlyphIcon name="fClef" size={44} fit="em" />
            </div>
          )}
          {/* Insignias: formato y capacidades */}
          <div className="absolute left-2 bottom-2 flex gap-1">
            <span className="rounded-full bg-ink/80 text-bg text-[10px] font-semibold px-2 py-0.5 backdrop-blur">{isXml ? "MusicXML" : "PDF"}</span>
            {playable && <span className="rounded-full bg-accent text-white text-[10px] font-semibold px-2 py-0.5" title="Se puede escuchar">▶</span>}
            {annotated && <span className="rounded-full bg-yellow text-ink text-[10px] font-semibold px-2 py-0.5" title="Con anotaciones">✎</span>}
          </div>
        </div>
      </button>

      <div className="p-3 flex-1 flex flex-col gap-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(record.name); setEditing(false); }
            }}
            className="w-full rounded-xl px-2 py-1 text-sm font-semibold bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Nombre de la partitura"
          />
        ) : (
          <p className="text-sm font-semibold leading-snug line-clamp-2">{record.name}</p>
        )}
        <p className="text-xs text-ink-2">
          {isXml
            ? `${record.pageCount} ${record.pageCount === 1 ? "compás" : "compases"}`
            : `${record.pageCount} ${record.pageCount === 1 ? "página" : "páginas"}`}
          <span className="text-ink-3"> · {formatDate(record.addedAt)}</span>
        </p>
      </div>

      {/* Menú ⋯ */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setMenu((v) => !v); setConfirmDelete(false); }}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-surface/90 text-ink shadow grid place-items-center text-lg leading-none backdrop-blur"
        aria-label="Opciones"
        aria-expanded={menu}
      >
        ⋯
      </button>
      {menu && (
        <div className="absolute top-11 right-2 z-10 card p-1.5 shadow-lg min-w-36 text-sm" onMouseLeave={() => setMenu(false)}>
          <button
            type="button"
            onClick={() => { setMenu(false); setDraft(record.name); setEditing(true); }}
            className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-surface-2"
          >
            Renombrar
          </button>
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} className="w-full text-left px-3 py-1.5 rounded-xl text-bad hover:bg-bad-soft">
              Eliminar
            </button>
          ) : (
            <div className="px-3 py-1.5 space-y-1.5">
              <p className="text-xs text-ink-2">¿Eliminar «{record.name}»?</p>
              <div className="flex gap-1.5">
                <button type="button" onClick={onDelete} className="pill text-xs py-1 px-3 bg-bad text-white">Sí, borrar</button>
                <button type="button" onClick={() => { setConfirmDelete(false); setMenu(false); }} className="pill text-xs py-1 px-3">No</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
