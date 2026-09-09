/**
 * Lo que saben por igual el navegador y el servidor sobre un
 * reconocimiento de partitura. Sin `"use client"` ni nada de Node a
 * propósito: lo importan los dos lados.
 */

/** Páginas por reconocimiento; cada una son varios minutos de CPU del servidor. */
export const MAX_OMR_PAGES = 4;

export const TRANSCRIPTION_STATUS = ["pending", "running", "done", "error"] as const;
export type TranscriptionStatus = (typeof TRANSCRIPTION_STATUS)[number];

/** Un encargo de reconocimiento, tal y como lo ve el navegador. */
export interface TranscriptionJob {
  id: string;
  /** Partitura del dispositivo a la que pertenece. */
  scoreId: string;
  scoreName: string;
  status: TranscriptionStatus;
  /** Páginas enviadas y páginas ya reconocidas. */
  pages: number;
  donePages: number;
  /** Primera página del PDF. */
  fromPage: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export const isFinished = (job: TranscriptionJob) => job.status === "done" || job.status === "error";

/** Cuánto se lleva hecho, de 0 a 1. La página en curso cuenta a medias: es lo que tarda. */
export function transcriptionProgress(job: TranscriptionJob): number {
  if (job.status === "done") return 1;
  const half = job.status === "running" ? 0.5 : 0;
  return Math.min(1, (job.donePages + half) / Math.max(1, job.pages));
}
