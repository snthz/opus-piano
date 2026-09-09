"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CatalogPiece } from "@/data/catalog";
import { loadCatalogXml, MUSICXML_MIME, saveCatalogPiece } from "@/lib/catalog-load";
import { UserError } from "@/lib/user-error";
import { ArrowIcon } from "@/components/ui/arrow-icon";
import { ProgressRing } from "@/components/ui/progress-ring";
import { MusicXmlViewer } from "./musicxml-viewer";
import { LEVEL_COLOR, LEVEL_HEADING, useOwnedPieces } from "./score-catalog";

/**
 * La vista previa de una pieza del catálogo: la partitura entera, que suena
 * y muestra los nombres, el análisis de cómo abordarla y el botón de
 * guardarla. Nada se escribe en la biblioteca hasta que se pulsa; se puede
 * mirar y escuchar todo lo que se quiera antes.
 */
export function CatalogPreview({ piece }: { piece: CatalogPiece }) {
  const owned = useOwnedPieces();
  const [xml, setXml] = useState<string | null>(null);
  const [file, setFile] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCatalogXml(piece).then(
      (text) => {
        if (cancelled) return;
        setXml(text);
        setFile(new Blob([text], { type: MUSICXML_MIME }));
      },
      (e: unknown) => !cancelled && setError(e instanceof UserError ? e.message : "No se ha podido abrir la partitura."),
    );
    return () => {
      cancelled = true;
    };
  }, [piece]);

  const scoreId = savedId ?? owned.get(piece.id) ?? null;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const record = await saveCatalogPiece(piece, xml ?? undefined);
      setSavedId(record.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido guardar la pieza.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className={`card-pastel ${LEVEL_COLOR[piece.level] ?? "bg-ash"} p-5`}>
        <p className="text-xs text-ink-2">
          {LEVEL_HEADING[piece.level] ?? piece.level} · {piece.measures} compases · {piece.source.kind === "file" ? "partitura original" : "arreglo sencillo"}
        </p>
        <p className="mt-2 max-w-prose text-sm leading-relaxed">{piece.about}</p>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {piece.skills.map((s) => (
            <li key={s} className="pill py-1 text-xs">
              {s}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {scoreId ? (
            <Link href={`/scores?score=${encodeURIComponent(scoreId)}`} className="pill pill-active">
              Abrir en mi biblioteca
              <ArrowIcon className="h-4 w-4" />
            </Link>
          ) : (
            <button type="button" onClick={() => void save()} disabled={saving || !xml} className="pill pill-active disabled:opacity-60">
              {saving ? <ProgressRing progress={null} className="h-4 w-4" /> : <HeartIcon />}
              {saving ? "Guardando…" : "Guardar en mi biblioteca"}
            </button>
          )}
          <span className="text-xs text-ink-2">
            {scoreId ? "Ya la tienes: con tus notas, tus trazos y tu análisis." : "Mírala y escúchala entera antes; no se guarda nada hasta que pulses."}
          </span>
        </div>
      </section>

      {error && <p className="px-1 text-sm text-bad">{error}</p>}
      {!file && !error && <p className="px-1 text-sm text-ink-2">Abriendo la partitura…</p>}
      {file && <MusicXmlViewer file={file} />}

      <section className="card p-5 md:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Cómo abordarla</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-2">{piece.analysis.summary}</p>
        <h3 className="mt-5 text-sm font-semibold">Por dónde empezar</h3>
        <ol className="mt-2 space-y-2">
          {piece.analysis.approach.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-bg">{i + 1}</span>
              <span className="max-w-prose">{step}</span>
            </li>
          ))}
        </ol>
        <h3 className="mt-5 text-sm font-semibold">Dónde se atasca la gente</h3>
        <ul className="mt-2 space-y-1.5">
          {piece.analysis.watchOut.map((w, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-2">
              <span aria-hidden>–</span>
              <span className="max-w-prose">{w}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs leading-relaxed text-ink-3">
          {piece.composer} · {piece.year}. Obra de dominio público.{" "}
          {piece.source.kind === "file" ? (
            <>
              Transcripción de{" "}
              <a href={piece.source.origin.url} target="_blank" rel="noreferrer" className="underline decoration-ink-3 underline-offset-2 hover:text-ink">
                {piece.source.origin.name}
              </a>
              .
            </>
          ) : (
            "Arreglo sencillo escrito para Opus Piano."
          )}{" "}
          Al guardarla puedes pedirle a la app un análisis completo con objetivos por compases.
        </p>
      </section>
    </div>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z" />
    </svg>
  );
}
