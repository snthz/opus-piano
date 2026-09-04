"use client";

import { useRef, useState } from "react";
import { renderThumbnail } from "@/lib/pdf-thumbnail";
import { parseMusicXml, unpackMxl } from "@/lib/music/musicxml";
import { addScore, type ScoreRecord } from "@/lib/scores-db";

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
      <div
        className={`border-2 border-dashed rounded-3xl p-8 text-center transition-colors cursor-pointer ${
          drag ? "border-accent bg-lavender/30" : "border-surface-3 hover:border-accent/50"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        {loading ? (
          <p className="text-ink-2 text-sm">Procesando…</p>
        ) : (
          <>
            <p className="text-2xl mb-2" aria-hidden>📄</p>
            <p className="font-semibold text-sm">Añadir partitura</p>
            <p className="text-xs text-ink-2 mt-1">Toca para seleccionar o arrastra aquí un PDF o un MusicXML (.musicxml, .mxl)</p>
            <p className="text-xs text-ink-3 mt-2">
              Con MusicXML, Etude puede tocar la pieza y mostrarte el nombre de cada nota. MuseScore lo exporta desde
              «Archivo → Exportar».
            </p>
          </>
        )}
      </div>
      {error && <p className="text-xs text-bad px-2">{error}</p>}
    </div>
  );
}
