"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface ScoreRecord {
  id: string;
  name: string;
  file: Blob;
  thumbnail: string; // data URL
  notes: string;
  addedAt: number;
  pageCount: number;
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
