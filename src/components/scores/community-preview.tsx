"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getShared, saveShared, sharedFile, sharedXml, type SharedScore } from "@/lib/community";
import { getPageSize, renderPage } from "@/lib/pdf-thumbnail";
import { listScores, onScoresChange } from "@/lib/scores-db";
import { UserError } from "@/lib/user-error";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { ProgressRing } from "@/components/ui/progress-ring";
import { MusicXmlViewer } from "./musicxml-viewer";

/**
 * Una partitura compartida, vista desde fuera: se lee entera y, si suena,
 * se escucha, antes de decidir guardarla. Un MusicXML se dibuja como en la
 * biblioteca; un PDF se muestra página a página, sin herramientas de
 * anotación —para eso está guardarla—.
 */
export function CommunityPreview({ id }: { id: string }) {
  const [meta, setMeta] = useState<SharedScore | null>(null);
  const [file, setFile] = useState<Blob | null>(null);
  const [xml, setXml] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await getShared(id);
        if (cancelled) return;
        setMeta(m);
        const [f, x] = await Promise.all([sharedFile(m), sharedXml(m)]);
        if (cancelled) return;
        setFile(f);
        setXml(x ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof UserError ? e.message : "No se ha podido abrir la partitura.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Si ya la guardaste, el botón lleva a tu copia en vez de crear otra.
  useEffect(() => {
    if (!meta) return;
    const check = () => listScores().then((all) => setSavedId((prev) => prev ?? all.find((s) => s.notes.startsWith(`Compartida por ${meta.owner}`) && s.name === meta.name)?.id ?? null));
    void check();
    return onScoresChange(() => void check());
  }, [meta]);

  const save = async () => {
    if (!meta || !file || saving) return;
    setSaving(true);
    setError(null);
    try {
      const rec = await saveShared(meta, file, xml ?? undefined);
      setSavedId(rec.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (error && !meta) return <p className="px-1 text-sm text-bad">{error}</p>;
  if (!meta) return <p className="px-1 text-sm text-ink-2">Cargando…</p>;

  const playableXml = meta.kind === "musicxml" ? file : xml;

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <p className="text-xs text-ink-2">
          Compartida por <span className="font-semibold text-ink">{meta.owner}</span> · {meta.kind === "musicxml" ? `${meta.pageCount} compases` : `${meta.pageCount} páginas`}
          {meta.playable ? " · se puede escuchar" : ""}
        </p>
        {meta.description && <p className="mt-2 max-w-prose whitespace-pre-wrap text-sm leading-relaxed">{meta.description}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {savedId ? (
            <Link href={`/scores?score=${encodeURIComponent(savedId)}`} className="pill pill-active">
              Abrir en mi biblioteca
              <ArrowIcon className="h-4 w-4" />
            </Link>
          ) : (
            <button type="button" onClick={() => void save()} disabled={!file || saving} className="pill pill-active disabled:opacity-60">
              {saving ? <ProgressRing progress={null} className="h-4 w-4" /> : null}
              {saving ? "Guardando…" : "Guardar en mi biblioteca"}
            </button>
          )}
          <span className="text-xs text-ink-2">
            {savedId ? "Es tu copia: anótala, analízala, lo que quieras." : "Se guarda una copia tuya, privada. Puedes mirarla entera antes."}
          </span>
        </div>
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      </section>

      {!file && <p className="px-1 text-sm text-ink-2">Descargando la partitura…</p>}
      {file && meta.kind === "pdf" && <PdfPages file={file} pageCount={meta.pageCount} />}
      {playableXml && (
        <div className="space-y-2">
          {meta.kind === "pdf" && <h2 className="px-1 text-sm font-semibold">Para escucharla (MusicXML vinculado)</h2>}
          <MusicXmlViewer file={playableXml} />
        </div>
      )}
    </div>
  );
}

/** Cuántas páginas se dibujan de golpe: más es esperar mucho para ver algo. */
const PAGE_LIMIT = 24;
const PAGE_WIDTH = 760;

/** Las páginas del PDF una debajo de otra, dibujadas al ancho de la columna. */
function PdfPages({ file, pageCount }: { file: Blob; pageCount: number }) {
  const [pages, setPages] = useState<string[]>([]);
  const total = Math.min(pageCount || 1, PAGE_LIMIT);

  // El archivo no cambia mientras el componente vive (la página es de una partitura), así que no hay nada que reponer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let n = 1; n <= total; n++) {
        try {
          const { width } = await getPageSize(file, n);
          const canvas = await renderPage(file, n, PAGE_WIDTH / width);
          if (cancelled) return;
          setPages((prev) => [...prev, canvas.toDataURL("image/png")]);
        } catch {
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, total]);

  return (
    <div className="space-y-3">
      {pages.map((src, i) => (
        // Dibujada aquí mismo desde el PDF: no hay nada que next/image pueda optimizar.
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt={`Página ${i + 1}`} className="w-full rounded-2xl bg-white shadow-[var(--shadow)]" />
      ))}
      {pages.length < total && <p className="px-1 text-xs text-ink-3">Dibujando la página {pages.length + 1} de {total}…</p>}
      {pageCount > PAGE_LIMIT && pages.length >= total && (
        <p className="px-1 text-xs text-ink-3">Se muestran las primeras {PAGE_LIMIT} páginas; guárdala para verla entera.</p>
      )}
    </div>
  );
}
