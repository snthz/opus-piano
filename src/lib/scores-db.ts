"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { PlanState } from "@/lib/study-plan";

/** A stroke drawn on a page, in coordinates relative (0-1) to the page size. */
export interface Stroke {
  color: string;
  /** Width relative to the page's own width. For a label, its font size. */
  width: number;
  /** Highlighter stroke: semi-transparent and wide. */
  highlighter?: boolean;
  /** Text (a fingering number) drawn at the single point instead of a line. */
  label?: string;
  points: [number, number][];
}

/** Strokes by page number (starting at 1). */
export type Annotations = Record<number, Stroke[]>;

export type ScoreKind = "pdf" | "musicxml";

/** Quién puede verla: solo yo, quien tenga el enlace, o cualquiera desde la lista de la comunidad. */
export type Visibility = "private" | "link" | "public";

export interface ScoreRecord {
  id: string;
  name: string;
  /** The original PDF, or MusicXML's XML already decompressed. */
  file: Blob;
  thumbnail: string; // data URL
  notes: string;
  addedAt: number;
  /** PDF: pages. MusicXML: measures. */
  pageCount: number;
  /** Records predating this field are PDF. */
  kind?: ScoreKind;
  annotations?: Annotations;
  /** PDF only: MusicXML of the same piece, so it can be played and note names shown. */
  linkedXml?: Blob;
  /** AI-generated study plan; syncs like the notes. */
  plan?: PlanState;
  /** Sharing: absent means private. Only the file, name, thumbnail and `description` are ever shared. */
  visibility?: Visibility;
  /** Public blurb shown next to a shared score. */
  description?: string;
  /** Last local edit to name, notes, or strokes (ms). */
  updatedAt?: number;
  /** When the server confirmed it has this version (metadata and files). */
  syncedAt?: number;
  /** The linked MusicXML changed since the last sync. */
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

/* ---------- Change notifications: account sync hooks in here ---------- */

export type ScoreChange = { type: "put"; id: string; source: "local" | "remote" } | { type: "delete"; id: string; source: "local" | "remote" } | { type: "clear" };
const listeners = new Set<(c: ScoreChange) => void>();

export function onScoresChange(listener: (c: ScoreChange) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const emit = (c: ScoreChange) => listeners.forEach((l) => l(c));

/* ---------- Local writes (from the UI) ---------- */

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
export const updateScorePlan = (id: string, plan: PlanState | undefined) => patchLocal(id, { plan });
export const updateScoreLinkedXml = (id: string, linkedXml: Blob | undefined) => patchLocal(id, { linkedXml, xmlDirty: true });
/** Syncs like the name: the server is what makes a share real, so this only takes effect with an account. */
export const updateScoreSharing = (id: string, sharing: { visibility: Visibility; description: string }) => patchLocal(id, sharing);

/**
 * Ticks (or unticks) a day as studied in a score's schedule.
 *
 * The score is re-read before writing: between painting the agenda and pressing
 * the tick the plan may have changed — account sync, another tab, the reader.
 */
export async function toggleStudyDay(scoreId: string, day: string): Promise<void> {
  const rec = await getScore(scoreId);
  const state = rec?.plan;
  if (!state?.schedule) return;
  const done = { ...state.schedule.done };
  if (done[day]) delete done[day];
  else done[day] = true;
  await updateScorePlan(scoreId, { ...state, schedule: { ...state.schedule, done } });
}

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

/* ---------- Writes coming from the server (don't trigger another upload) ---------- */

export async function putFromServer(record: ScoreRecord): Promise<void> {
  const db = await getDB();
  await db.put("scores", record);
  emit({ type: "put", id: record.id, source: "remote" });
}

/** Marks the local version as confirmed by the server, without touching `updatedAt`. */
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

/** Approximate space used by the library, in bytes. */
export async function scoresSize(): Promise<{ count: number; bytes: number }> {
  const all = await listScores();
  const bytes = all.reduce((sum, s) => sum + s.file.size + s.thumbnail.length, 0);
  return { count: all.length, bytes };
}
