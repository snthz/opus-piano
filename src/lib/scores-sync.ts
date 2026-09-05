"use client";

import { useSyncExternalStore } from "react";
import { getUser, onAuthChange } from "@/lib/auth";
import {
  listScores,
  markSynced,
  onScoresChange,
  putFromServer,
  removeFromServer,
  type Annotations,
  type ScoreRecord,
} from "@/lib/scores-db";

/**
 * Sincroniza la biblioteca (IndexedDB) con la cuenta. Sin cuenta no hace nada.
 *
 * - Lo local que el servidor no tiene se sube (metadatos + archivo + MusicXML).
 * - Lo del servidor que no está aquí se descarga.
 * - Si los dos tienen la partitura, gana la versión con `updatedAt` más reciente
 *   (nombre, notas, trazos); los archivos no cambian nunca una vez subidos.
 * - Borrar en un dispositivo borra en el servidor y, al sincronizar, en los demás.
 */
interface ServerScore {
  id: string;
  name: string;
  kind: "pdf" | "musicxml";
  notes: string;
  pageCount: number;
  thumbnail: string;
  annotations?: Annotations;
  size: number;
  uploaded: boolean;
  hasXml: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ScoresSyncState {
  busy: boolean;
  error: string | null;
  lastSync: string | null;
  /** Bytes usados y cuota, según el servidor */
  used: number;
  quota: number;
}

const DELETES_KEY = "etude:scores-deletes";
const SYNC_KEY = "etude:scores-sync";

let state: ScoresSyncState = { busy: false, error: null, lastSync: null, used: 0, quota: 0 };
const listeners = new Set<() => void>();
const SERVER_STATE = state;

function setState(patch: Partial<ScoresSyncState>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ lastSync: state.lastSync }));
  } catch {
    /* sin almacenamiento */
  }
  listeners.forEach((l) => l());
}

export function useScoresSync(): ScoresSyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => state,
    () => SERVER_STATE,
  );
}

function pendingDeletes(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DELETES_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function setPendingDeletes(ids: string[]) {
  try {
    localStorage.setItem(DELETES_KEY, JSON.stringify(ids));
  } catch {
    /* sin almacenamiento */
  }
}

const json = (path: string, method: string, body: unknown) =>
  fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });

/* ---------- Subida ---------- */

async function upload(rec: ScoreRecord): Promise<void> {
  const meta = await json("/api/scores", "POST", {
    id: rec.id,
    name: rec.name,
    kind: rec.kind ?? "pdf",
    notes: rec.notes,
    pageCount: rec.pageCount,
    thumbnail: rec.thumbnail,
    annotations: rec.annotations,
    createdAt: rec.addedAt,
    updatedAt: rec.updatedAt ?? rec.addedAt,
  });
  if (!meta.ok) throw new Error(await errorOf(meta, "No se pudo guardar la partitura"));
  const server = (await meta.json()) as ServerScore;

  if (!server.uploaded || server.size !== rec.file.size) {
    const res = await fetch(`/api/scores/${rec.id}/file`, {
      method: "PUT",
      headers: { "Content-Type": rec.file.type || "application/octet-stream", "Content-Length": String(rec.file.size) },
      body: rec.file,
    });
    if (!res.ok) throw new Error(await errorOf(res, "No se pudo subir el archivo"));
  }
  await syncXml(rec, server);
  await markSynced(rec.id);
}

async function syncXml(rec: ScoreRecord, server: ServerScore): Promise<void> {
  if (rec.linkedXml && (rec.xmlDirty || !server.hasXml)) {
    const res = await fetch(`/api/scores/${rec.id}/xml`, { method: "PUT", body: rec.linkedXml });
    if (!res.ok) throw new Error(await errorOf(res, "No se pudo subir el MusicXML"));
  } else if (!rec.linkedXml && server.hasXml && rec.xmlDirty) {
    await fetch(`/api/scores/${rec.id}/xml`, { method: "DELETE" });
  }
}

async function pushMeta(rec: ScoreRecord, server: ServerScore): Promise<void> {
  const res = await json(`/api/scores/${rec.id}`, "PATCH", {
    name: rec.name,
    notes: rec.notes,
    annotations: rec.annotations ?? null,
    updatedAt: rec.updatedAt ?? rec.addedAt,
  });
  if (!res.ok) throw new Error(await errorOf(res, "No se pudo guardar"));
  await syncXml(rec, server);
  await markSynced(rec.id);
}

/* ---------- Descarga ---------- */

async function download(s: ServerScore, local?: ScoreRecord): Promise<void> {
  let file = local?.file;
  if (!file) {
    const res = await fetch(`/api/scores/${s.id}/file`, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo descargar la partitura");
    file = await res.blob();
  }
  let linkedXml = local?.linkedXml;
  if (s.hasXml && !linkedXml) {
    const res = await fetch(`/api/scores/${s.id}/xml`, { cache: "no-store" });
    if (res.ok) linkedXml = await res.blob();
  } else if (!s.hasXml) {
    linkedXml = undefined;
  }
  await putFromServer({
    id: s.id,
    name: s.name,
    kind: s.kind,
    file,
    thumbnail: s.thumbnail,
    notes: s.notes,
    pageCount: s.pageCount,
    annotations: s.annotations,
    linkedXml,
    addedAt: s.createdAt,
    updatedAt: s.updatedAt,
    syncedAt: Date.now(),
    xmlDirty: false,
  });
}

async function errorOf(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

/* ---------- Ciclo completo ---------- */

let running: Promise<void> | null = null;
let again = false;

export function syncScores(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = run().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncScores();
    }
  });
  return running;
}

async function run(): Promise<void> {
  if (typeof window === "undefined" || !getUser()) return;
  if (!navigator.onLine) return;
  setState({ busy: true, error: null });
  try {
    // 1. Borrados pendientes
    for (const id of pendingDeletes()) {
      const res = await fetch(`/api/scores/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 404) setPendingDeletes(pendingDeletes().filter((x) => x !== id));
    }

    // 2. Estado del servidor
    const res = await fetch("/api/scores", { cache: "no-store" });
    if (res.status === 401) {
      setState({ busy: false });
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { scores, used, quota } = (await res.json()) as { scores: ServerScore[]; used: number; quota: number };
    setState({ used, quota });
    const remote = new Map(scores.map((s) => [s.id, s]));
    const local = await listScores();
    const localIds = new Set(local.map((l) => l.id));

    // 3. Local → servidor
    for (const rec of local) {
      const s = remote.get(rec.id);
      if (!s || !s.uploaded) {
        await upload(rec);
        continue;
      }
      const localAt = rec.updatedAt ?? rec.addedAt;
      if (!rec.syncedAt || localAt > s.updatedAt || rec.xmlDirty) await pushMeta(rec, s);
      else if (s.updatedAt > localAt) await download(s, rec);
      else if (s.hasXml && !rec.linkedXml) await download(s, rec);
    }

    // 4. Servidor → local (lo que no teníamos y no está pendiente de borrar)
    const deleting = new Set(pendingDeletes());
    for (const s of scores) {
      if (!localIds.has(s.id) && s.uploaded && !deleting.has(s.id)) await download(s);
    }

    setState({ busy: false, error: null, lastSync: new Date().toISOString() });
  } catch (e) {
    setState({ busy: false, error: e instanceof Error ? e.message : "No se pudo sincronizar" });
  }
}

/** Al cerrar sesión: fuera de este dispositivo lo que ya está en la cuenta; lo no subido se queda. */
async function dropSyncedLocal(): Promise<void> {
  for (const rec of await listScores()) if (rec.syncedAt) await removeFromServer(rec.id);
  setState({ lastSync: null, used: 0, quota: 0, error: null });
}

let timer: number | null = null;
function schedule() {
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncScores(), 1200);
}

if (typeof window !== "undefined") {
  try {
    const saved = JSON.parse(localStorage.getItem(SYNC_KEY) ?? "{}") as { lastSync?: string | null };
    state = { ...state, lastSync: saved.lastSync ?? null };
  } catch {
    /* nada guardado */
  }
  onScoresChange((c) => {
    if (c.type === "clear") {
      if (getUser()) {
        // Borrar toda la biblioteca: también en la cuenta.
        void fetch("/api/scores", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : { scores: [] }))
          .then(({ scores }: { scores: ServerScore[] }) => {
            setPendingDeletes([...new Set([...pendingDeletes(), ...scores.map((s) => s.id)])]);
            schedule();
          })
          .catch(() => {});
      }
      return;
    }
    if (c.source !== "local") return;
    if (c.type === "delete") setPendingDeletes([...new Set([...pendingDeletes(), c.id])]);
    schedule();
  });
  onAuthChange((user) => {
    if (user) void syncScores();
    else void dropSyncedLocal();
  });
  window.addEventListener("online", () => void syncScores());
}
