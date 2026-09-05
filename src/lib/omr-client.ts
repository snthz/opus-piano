"use client";

import { parseMusicXml } from "@/lib/music/musicxml";

/**
 * Transcripción PDF → MusicXML con oemer, que corre en el servidor (servicio
 * `omr` del docker-compose). Se sube el PDF, se crea un trabajo y se consulta
 * su estado hasta que termina. El resultado es un borrador: oemer acierta
 * bastante en partituras impresas limpias y menos en escaneos.
 */

export interface OmrOptions {
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
}

interface JobStatus {
  id: string;
  status: "queued" | "running" | "done" | "error";
  message?: string;
  page?: number;
  pages?: number;
  xml?: string;
  error?: string;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Cancelado", "AbortError"));
    });
  });

export async function transcribePdf(file: Blob, opts: OmrOptions = {}): Promise<string> {
  const progress = opts.onProgress ?? (() => {});
  progress("Subiendo el PDF al servidor…");

  const form = new FormData();
  form.append("file", file, "partitura.pdf");
  const res = await fetch("/api/omr", { method: "POST", body: form, signal: opts.signal });
  const created = (await res.json().catch(() => ({}))) as Partial<JobStatus> & { error?: string };
  if (!res.ok) throw new Error(created.error ?? `No se pudo iniciar la transcripción (HTTP ${res.status}).`);
  if (!created.id) throw new Error("El servidor no devolvió un trabajo.");

  progress("En cola…");
  for (;;) {
    await sleep(3000, opts.signal);
    const r = await fetch(`/api/omr/${created.id}`, { cache: "no-store", signal: opts.signal });
    const job = (await r.json().catch(() => ({}))) as JobStatus & { error?: string };
    if (!r.ok) throw new Error(job.error ?? `El servidor respondió ${r.status}.`);

    if (job.status === "error") throw new Error(job.error ?? "La transcripción falló.");
    if (job.status === "done") {
      if (!job.xml) throw new Error("El servidor no devolvió MusicXML.");
      const parsed = parseMusicXml(job.xml);
      if (!parsed.measures.length) throw new Error("La transcripción no contiene compases.");
      progress(`Listo: ${parsed.measures.length} compases.`);
      return job.xml;
    }
    progress(
      job.message ??
        (job.page && job.pages ? `Transcribiendo la página ${job.page} de ${job.pages}… (varios minutos por página)` : "Procesando…"),
    );
  }
}
