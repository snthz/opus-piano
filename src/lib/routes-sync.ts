"use client";

import { getUser, onAuthChange } from "@/lib/auth";
import { listRoutes, markRouteSynced, onRoutesChange, putRouteFromServer, removeRouteFromServer } from "@/lib/routes-db";
import { routeDocument, studyRouteSchema, type StudyRoute } from "@/lib/study-route";

/**
 * Keeps the study routes in step with the account. Without an account it
 * does nothing. The rules are the ones the scores follow (`scores-sync.ts`),
 * minus the files: what's only here goes up, what's only there comes down,
 * and when both have it the newer `updatedAt` wins. A route deleted here is
 * deleted there on the next sync, and then on the other devices.
 */

interface ServerRoute {
  id: string;
  data: unknown;
  updatedAt: number;
}

const DELETES_KEY = "etude:routes-deletes";

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

/** What the server holds, if it still has the expected shape; a corrupted document is left alone. */
function parse(s: ServerRoute): StudyRoute | null {
  const parsed = studyRouteSchema.safeParse(s.data);
  return parsed.success ? parsed.data : null;
}

/**
 * Sends this device's version. The server keeps whichever is newer and
 * answers with what it holds, so if another device got there first that
 * version comes back and replaces the local one.
 */
async function upload(route: StudyRoute): Promise<void> {
  const res = await fetch("/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ id: route.id, data: route, updatedAt: route.updatedAt }),
  });
  if (!res.ok) throw new Error("No se pudo guardar la ruta");
  const server = (await res.json()) as ServerRoute;
  const theirs = server.updatedAt > route.updatedAt ? parse(server) : null;
  if (theirs) await putRouteFromServer(theirs);
  else await markRouteSynced(route.id);
}

let running: Promise<void> | null = null;
let again = false;

export function syncRoutes(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = run().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncRoutes();
    }
  });
  return running;
}

async function run(): Promise<void> {
  if (typeof window === "undefined" || !getUser() || !navigator.onLine) return;
  try {
    for (const id of pendingDeletes()) {
      const res = await fetch(`/api/routes/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 404) setPendingDeletes(pendingDeletes().filter((x) => x !== id));
    }

    const res = await fetch("/api/routes", { cache: "no-store" });
    if (!res.ok) return;
    const { routes } = (await res.json()) as { routes: ServerRoute[] };
    const remote = new Map(routes.map((r) => [r.id, r]));
    const local = await listRoutes();
    const localIds = new Set(local.map((r) => r.id));

    for (const rec of local) {
      const s = remote.get(rec.id);
      const doc = routeDocument(rec);
      if (!s) {
        await upload(doc);
      } else if (!rec.syncedAt || doc.updatedAt > s.updatedAt) {
        await upload(doc);
      } else if (s.updatedAt > doc.updatedAt) {
        const theirs = parse(s);
        if (theirs) await putRouteFromServer(theirs);
      }
    }

    const deleting = new Set(pendingDeletes());
    for (const s of routes) {
      if (localIds.has(s.id) || deleting.has(s.id)) continue;
      const theirs = parse(s);
      if (theirs) await putRouteFromServer(theirs);
    }
  } catch (e) {
    // Offline or a server hiccup: the next trigger tries again. Nothing to show the student.
    console.warn("routes-sync:", e instanceof Error ? e.message : e);
  }
}

/** Signing out: what the account already has leaves this device; what never went up stays. */
async function dropSyncedLocal(): Promise<void> {
  for (const rec of await listRoutes()) if (rec.syncedAt) await removeRouteFromServer(rec.id);
}

let timer: number | null = null;
function schedule() {
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncRoutes(), 1200);
}

if (typeof window !== "undefined") {
  onRoutesChange((c) => {
    if (c.source !== "local") return;
    if (c.type === "delete") setPendingDeletes([...new Set([...pendingDeletes(), c.id])]);
    schedule();
  });
  onAuthChange((user) => {
    if (user) void syncRoutes();
    else void dropSyncedLocal();
  });
  window.addEventListener("online", () => void syncRoutes());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncRoutes();
  });
}
