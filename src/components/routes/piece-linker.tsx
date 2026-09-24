"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ScoreUpload } from "@/components/scores/score-upload";
import { StatusLabel } from "@/components/scores/score-status";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Sheet } from "@/components/ui/sheet";
import { CATALOG, pieceById, type CatalogPiece } from "@/data/catalog";
import { saveCatalogPiece } from "@/lib/catalog-load";
import { scoreStatus } from "@/lib/score-status";
import type { ScoreRecord } from "@/lib/scores-db";
import type { RoutePiece } from "@/lib/study-route";

/**
 * "Vincular partitura": the sheet that ties a piece of the route to a score.
 * Three sources, in the order most likely to be right: the app's catalogue
 * if it has the piece (one tap saves it to the library), the library itself,
 * or a file from the device.
 */
export function PieceLinker({ open, piece, scores, onClose, onLink }: { open: boolean; piece: RoutePiece | null; scores: ScoreRecord[]; onClose: () => void; onLink: (scoreId: string) => void }) {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useMemo(() => (piece ? catalogMatches(piece) : []), [piece]);
  const owned = new Set(scores.map((s) => s.name));
  const filtered = scores.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const fromCatalog = async (cp: CatalogPiece) => {
    // already in the library under the catalogue's own title: link that one instead of a copy
    const existing = scores.find((s) => s.name === cp.title);
    if (existing) return onLink(existing.id);
    setSaving(cp.id);
    setError(null);
    try {
      const record = await saveCatalogPiece(cp);
      onLink(record.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido guardar la pieza.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Vincular partitura" subtitle={piece?.title}>
      <div className="space-y-5 pb-2">
        {suggestions.length > 0 && (
          <section>
            <Heading>En el catálogo de piezas libres</Heading>
            <ul className="space-y-2">
              {suggestions.map((cp) => (
                <li key={cp.id} className="card flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{cp.title}</p>
                    <p className="truncate text-xs text-ink-2">{cp.composer}</p>
                  </div>
                  <button type="button" onClick={() => void fromCatalog(cp)} disabled={!!saving} className="pill pill-active shrink-0 py-1.5 text-xs disabled:opacity-60">
                    {saving === cp.id ? <ProgressRing progress={null} className="h-3.5 w-3.5" /> : null}
                    {owned.has(cp.title) ? "Vincular" : "Guardar y vincular"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <Heading>De tu biblioteca</Heading>
          {scores.length === 0 ? (
            <p className="rounded-2xl bg-surface-2 p-3 text-sm text-ink-2">Tu biblioteca está vacía. Sube la partitura aquí abajo o búscala entre las piezas libres.</p>
          ) : (
            <>
              {scores.length > 6 && (
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en la biblioteca…" aria-label="Buscar en la biblioteca" className="field mb-2 h-11 text-sm" />
              )}
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {filtered.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => onLink(s.id)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left hover:bg-surface-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{s.name}</span>
                        <span className="block text-xs text-ink-2">
                          <StatusLabel status={scoreStatus(s)} /> · {s.kind === "musicxml" ? "MusicXML" : "PDF"}
                        </span>
                      </span>
                      <span aria-hidden className="text-ink-3">
                        →
                      </span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && <li className="px-3 py-2 text-sm text-ink-2">Sin resultados.</li>}
              </ul>
            </>
          )}
        </section>

        <section>
          <Heading>Desde un archivo</Heading>
          <ScoreUpload onAdded={(r) => onLink(r.id)} />
        </section>

        {error && <p className="px-1 text-sm text-bad">{error}</p>}

        <p className="px-1 text-xs text-ink-3">
          ¿No la tienes? Mira en las{" "}
          <Link href="/scores/catalog" className="font-semibold text-ink hover:underline">
            piezas libres
          </Link>{" "}
          o búscala en IMSLP, preferiblemente en edición Urtext.
        </p>
      </div>
    </Sheet>
  );
}

const Heading = ({ children }: { children: React.ReactNode }) => <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{children}</h3>;

/** Words half the repertoire shares: matching on them would suggest every Bach for every minuet. */
const STOP = new Set(["mayor", "menor", "para", "piano", "sonatina", "sonata", "minueto", "preludio", "arreglo", "facil", "bwv", "anh", "bach", "johann", "sebastian", "cuaderno", "album", "juventud"]);
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
const tokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t));

/**
 * Catalogue pieces that look like this one: the id the route names, or
 * enough words (or a catalogue number) in common between the titles. Loose
 * on purpose; the student confirms with a tap.
 */
export function catalogMatches(piece: RoutePiece): CatalogPiece[] {
  const named = piece.catalogId ? pieceById(piece.catalogId) : undefined;
  const mine = new Set(tokens(`${piece.title} ${piece.detail}`));
  const numbers = [...mine].filter((t) => /^\d+$/.test(t));
  const scored = CATALOG.filter((cp) => cp.id !== named?.id)
    .map((cp) => {
      const theirs = tokens(`${cp.title} ${cp.composer}`);
      const words = theirs.filter((t) => !/^\d+$/.test(t) && mine.has(t)).length;
      const nums = theirs.filter((t) => numbers.includes(t)).length;
      return { cp, score: words + nums * 2 };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.cp);
  return named ? [named, ...scored] : scored;
}
