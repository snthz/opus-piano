"use client";

import { useRef, useState } from "react";
import { renderThumbnail } from "@/lib/pdf-thumbnail";
import { addScore, type ScoreRecord } from "@/lib/scores-db";

interface Props {
  onAdded: (record: ScoreRecord) => void;
}

export function ScoreUpload({ onAdded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);

  const process = async (file: File) => {
    if (!file.type.includes("pdf")) return;
    setLoading(true);
    try {
      const { thumbnail, pageCount } = await renderThumbnail(file, 320);
      const name = file.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");
      const record = await addScore({ name, file: file, thumbnail, notes: "", pageCount });
      onAdded(record);
    } finally {
      setLoading(false);
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => void process(f));
  };

  return (
    <div
      className={`border-2 border-dashed rounded-3xl p-8 text-center transition-colors cursor-pointer ${
        drag ? "border-accent bg-lavender/30" : "border-surface-3 hover:border-accent/50"
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      {loading ? (
        <p className="text-ink-2 text-sm">Procesando PDF…</p>
      ) : (
        <>
          <p className="text-2xl mb-2">📄</p>
          <p className="font-semibold text-sm">Añadir partitura</p>
          <p className="text-xs text-ink-2 mt-1">Toca para seleccionar o arrastra un PDF aquí</p>
        </>
      )}
    </div>
  );
}
