"use client";

import { useRef, useState } from "react";
import { renderThumbnail } from "@/lib/pdf-thumbnail";
import { parseMusicXml, unpackMxl } from "@/lib/music/musicxml";
import { addScore, type ScoreRecord } from "@/lib/scores-db";
import { ProgressRing } from "@/components/ui/progress-ring";
import { AddScoreIcon } from "./library-icons";

interface Props {
  onAdded: (record: ScoreRecord) => void;
}

const ACCEPT = ".pdf,application/pdf,.musicxml,.mxl,.xml,application/vnd.recordare.musicxml,application/vnd.recordare.musicxml+xml";

export function ScoreUpload({ onAdded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const process = async (file: File) => {
    const isPdf = file.type.includes("pdf") || /\.pdf$/i.test(file.name);
    const isMxl = /\.mxl$/i.test(file.name);
    const isXml = isMxl || /\.(musicxml|xml)$/i.test(file.name);
    if (!isPdf && !isXml) {
      setError(`«${file.name}» no es un PDF ni un MusicXML.`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const baseName = file.name.replace(/\.(pdf|musicxml|mxl|xml)$/i, "").replace(/[-_]/g, " ");
      if (isPdf) {
        const { thumbnail, pageCount } = await renderThumbnail(file, 320);
        onAdded(await addScore({ name: baseName, file, thumbnail, notes: "", pageCount, kind: "pdf" }));
      } else {
        const xml = isMxl ? unpackMxl(new Uint8Array(await file.arrayBuffer())) : await file.text();
        const parsed = parseMusicXml(xml);
        // Se guarda el XML ya descomprimido: al abrirlo no hace falta volver a leer el zip.
        const blob = new Blob([xml], { type: "application/vnd.recordare.musicxml+xml" });
        onAdded(
          await addScore({
            name: parsed.title || baseName,
            file: blob,
            thumbnail: "",
            notes: "",
            pageCount: parsed.measures.length,
            kind: "musicxml",
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setLoading(false);
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => void process(f));
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={loading}
        className={`w-full rounded-3xl border border-dashed p-3 text-left transition-colors sm:p-4 ${
          drag ? "border-ink bg-surface-2" : "border-surface-3 bg-surface hover:border-ink-3 hover:bg-surface-2"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        <div className="flex items-center gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-line bg-surface-2 text-ink">
            {loading ? <ProgressRing progress={null} className="h-5 w-5" /> : <AddScoreIcon className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            {loading ? (
              <>
                <p className="text-sm font-semibold">Procesando…</p>
                <p className="mt-0.5 text-xs text-ink-2">Leyendo el archivo y preparando la miniatura.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">Añadir partitura</p>
                <p className="mt-0.5 text-xs text-ink-2">Arrastra un PDF o un MusicXML (.musicxml, .mxl), o toca para elegirlo.</p>
              </>
            )}
          </div>
        </div>
      </button>
      {error && <p className="px-2 text-xs text-bad">{error}</p>}
    </div>
  );
}
