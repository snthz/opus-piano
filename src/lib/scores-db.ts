"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/** Un trazo dibujado sobre una página, en coordenadas relativas (0–1) al tamaño de la página. */
export interface Stroke {
  color: string;
  /** Grosor relativo al ancho de la página */
  width: number;
  /** Trazo de subrayador: semitransparente y ancho */
  highlighter?: boolean;
  points: [number, number][];
}

/** Trazos por número de página (empezando en 1). */
export type Annotations = Record<number, Stroke[]>;

export type ScoreKind = "pdf" | "musicxml";

export interface ScoreRecord {
  id: string;
  name: string;
  /** PDF original, o el XML de MusicXML ya descomprimido */
  file: Blob;
  thumbnail: string; // data URL
  notes: string;
  addedAt: number;
  /** PDF: páginas. MusicXML: compases. */
  pageCount: number;
  /** Los registros anteriores a este campo son PDF. */
  kind?: ScoreKind;
  annotations?: Annotations;
  /** Solo PDF: MusicXML de la misma pieza, para poder escucharla y ver los nombres */
  linkedXml?: Blob;
  /** Última modificación local de nombre, notas o trazos (ms). */
  updatedAt?: number;
  /** Momento en que el servidor confirmó tener esta versión (metadatos y archivos). */
  syncedAt?: number;
  /** El MusicXML vinculado cambió después de la última sincronización. */
  xmlDirty?: boolean;
}

interface EtudeDB extends DBSchema {
  scores: {
    key: string;
    value: ScoreRecord;
    indexes: { addedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<EtudeDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<EtudeDB>("etude-scores", 1, {
      upgrade(db) {
        const store = db.createObjectStore("scores", { keyPath: "id" });
        store.createIndex("addedAt", "addedAt");
      },
    });
  }
  return dbPromise;
}

/* ---------- Avisos de cambio: la sincronización con la cuenta se engancha aquí ---------- */

export type ScoreChange = { type: "put"; id: string; source: "local" | "remote" } | { type: "delete"; id: string; source: "local" | "remote" } | { type: "clear" };
const listeners = new Set<(c: ScoreChange) => void>();

export function onScoresChange(listener: (c: ScoreChange) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const emit = (c: ScoreChange) => listeners.forEach((l) => l(c));

/* ---------- Escrituras locales (desde la interfaz) ---------- */

export async function addScore(record: Omit<ScoreRecord, "id" | "addedAt">): Promise<ScoreRecord> {
  const db = await getDB();
  const now = Date.now();
  const full: ScoreRecord = { ...record, id: crypto.randomUUID(), addedAt: now, updatedAt: now };
  await db.put("scores", full);
  emit({ type: "put", id: full.id, source: "local" });
  return full;
}

export async function listScores(): Promise<ScoreRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("scores", "addedAt");
  return all.reverse();
}

export async function getScore(id: string): Promise<ScoreRecord | undefined> {
  const db = await getDB();
  return db.get("scores", id);
}

async function patchLocal(id: string, changes: Partial<ScoreRecord>) {
  const db = await getDB();
  const rec = await db.get("scores", id);
  if (!rec) return;
  await db.put("scores", { ...rec, ...changes, updatedAt: Date.now() });
  emit({ type: "put", id, source: "local" });
}

export const updateScoreNotes = (id: string, notes: string) => patchLocal(id, { notes });
export const updateScoreAnnotations = (id: string, annotations: Annotations) => patchLocal(id, { annotations });
export const updateScoreName = (id: string, name: string) => patchLocal(id, { name });
export const updateScoreLinkedXml = (id: string, linkedXml: Blob | undefined) => patchLocal(id, { linkedXml, xmlDirty: true });

export async function deleteScore(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("scores", id);
  emit({ type: "delete", id, source: "local" });
}

export async function clearScores(): Promise<void> {
  const db = await getDB();
  await db.clear("scores");
  emit({ type: "clear" });
}

/* ---------- Escrituras que vienen del servidor (no disparan otra subida) ---------- */

export async function putFromServer(record: ScoreRecord): Promise<void> {
  const db = await getDB();
  await db.put("scores", record);
  emit({ type: "put", id: record.id, source: "remote" });
}

/** Marca la versión local como confirmada por el servidor, sin tocar `updatedAt`. */
export async function markSynced(id: string, patch: Partial<ScoreRecord> = {}): Promise<void> {
  const db = await getDB();
  const rec = await db.get("scores", id);
  if (rec) await db.put("scores", { ...rec, ...patch, syncedAt: Date.now(), xmlDirty: false });
}

export async function removeFromServer(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("scores", id);
  emit({ type: "delete", id, source: "remote" });
}

/** Espacio aproximado ocupado por la biblioteca, en bytes. */
export async function scoresSize(): Promise<{ count: number; bytes: number }> {
  const all = await listScores();
  const bytes = all.reduce((sum, s) => sum + s.file.size + s.thumbnail.length, 0);
  return { count: all.length, bytes };
}
