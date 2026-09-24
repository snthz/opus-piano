"use client";

import { getDB } from "@/lib/scores-db";
import { forgetScore, type StudyRoute, type StudyRouteRecord } from "@/lib/study-route";

/**
 * Study routes on the device, in the same IndexedDB as the scores. Same
 * shape as `scores-db.ts`: local writes bump `updatedAt` and notify with
 * `source: "local"`; what comes down from the account is written as-is and
 * notified as `"remote"`, so the sync layer doesn't upload it again.
 */

export type RouteChange = { type: "put"; id: string; source: "local" | "remote" } | { type: "delete"; id: string; source: "local" | "remote" };
const listeners = new Set<(c: RouteChange) => void>();

export function onRoutesChange(listener: (c: RouteChange) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const emit = (c: RouteChange) => listeners.forEach((l) => l(c));

/** Newest first. */
export async function listRoutes(): Promise<StudyRouteRecord[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("routes", "createdAt");
  return all.reverse();
}

export async function getRoute(id: string): Promise<StudyRouteRecord | undefined> {
  const db = await getDB();
  return db.get("routes", id);
}

/** Saves a route made on this device (new or edited). */
export async function saveRoute(route: StudyRoute): Promise<StudyRouteRecord> {
  const db = await getDB();
  const previous = await db.get("routes", route.id);
  const rec: StudyRouteRecord = { ...route, updatedAt: Date.now(), syncedAt: previous?.syncedAt };
  await db.put("routes", rec);
  emit({ type: "put", id: rec.id, source: "local" });
  return rec;
}

export async function deleteRoute(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("routes", id);
  emit({ type: "delete", id, source: "local" });
}

/** A score was deleted: no piece may keep pointing at it. */
export async function unlinkScoreEverywhere(scoreId: string): Promise<void> {
  for (const r of await listRoutes()) {
    const next = forgetScore(r, scoreId);
    if (next !== r) await saveRoute(next);
  }
}

/* ---------- From the account ---------- */

export async function putRouteFromServer(route: StudyRoute): Promise<void> {
  const db = await getDB();
  await db.put("routes", { ...route, syncedAt: Date.now() });
  emit({ type: "put", id: route.id, source: "remote" });
}

export async function markRouteSynced(id: string): Promise<void> {
  const db = await getDB();
  const rec = await db.get("routes", id);
  if (rec) await db.put("routes", { ...rec, syncedAt: Date.now() });
}

export async function removeRouteFromServer(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("routes", id);
  emit({ type: "delete", id, source: "remote" });
}
