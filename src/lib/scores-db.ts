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

export async function addScore(record: Omit<ScoreRecord, "id" | "addedAt">): Promise<ScoreRecord> {
  const db = await getDB();
  const full: ScoreRecord = { ...record, id: crypto.randomUUID(), addedAt: Date.now() };
  await db.put("scores", full);
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

export async function updateScoreNotes(id: string, notes: string): Promise<void> {
  const db = await getDB();
  const rec = await db.get("scores", id);
  if (rec) await db.put("scores", { ...rec, notes });
}

export async function updateScoreAnnotations(id: string, annotations: Annotations): Promise<void> {
  const db = await getDB();
  const rec = await db.get("scores", id);
  if (rec) await db.put("scores", { ...rec, annotations });
}

export async function updateScoreLinkedXml(id: string, linkedXml: Blob | undefined): Promise<void> {
  const db = await getDB();
  const rec = await db.get("scores", id);
  if (rec) await db.put("scores", { ...rec, linkedXml });
}

export async function deleteScore(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("scores", id);
}

export async function clearScores(): Promise<void> {
  const db = await getDB();
  await db.clear("scores");
}

/** Espacio aproximado ocupado por la biblioteca, en bytes. */
export async function scoresSize(): Promise<{ count: number; bytes: number }> {
  const all = await listScores();
  const bytes = all.reduce((sum, s) => sum + s.file.size + s.thumbnail.length, 0);
  return { count: all.length, bytes };
}
