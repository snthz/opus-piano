"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { deleteRoute, listRoutes, onRoutesChange, saveRoute } from "@/lib/routes-db";
import { syncRoutes } from "@/lib/routes-sync";
import { getScore, listScores, onScoresChange, updateScoreStatus, type ScoreRecord } from "@/lib/scores-db";
import { scoreStatus } from "@/lib/score-status";
import { currentPiece, type StudyRoute, type StudyRouteRecord } from "@/lib/study-route";
import { RouteDetail } from "./route-detail";
import { RouteList } from "./route-list";

const ROUTES_PATH = "/routes";
const routePath = (id: string) => `${ROUTES_PATH}?route=${encodeURIComponent(id)}`;

/**
 * Loads the routes (and the library, which the pieces link to) and shows
 * either the list or the route in the URL. Every edit goes through `commit`,
 * which saves to IndexedDB — the sync layer takes it from there — and, when
 * a piece changes hands, moves its score's status along with it: the piece
 * in hand is "en estudio", a finished one is "dominada".
 */
export function StudyRoutes() {
  const router = useRouter();
  const params = useSearchParams();
  const [routes, setRoutes] = useState<StudyRouteRecord[] | null>(null);
  const [scores, setScores] = useState<ScoreRecord[]>([]);

  const reload = () => listRoutes().then(setRoutes);
  useEffect(() => {
    void reload();
    void syncRoutes();
    const loadScores = () => listScores().then(setScores);
    void loadScores();
    const offRoutes = onRoutesChange((c) => {
      if (c.source === "remote") void reload();
    });
    const offScores = onScoresChange(() => void loadScores());
    return () => {
      offRoutes();
      offScores();
    };
  }, []);

  const openId = params.get("route");
  const open = openId && routes ? (routes.find((r) => r.id === openId) ?? null) : null;

  // An id that no longer exists (deleted here or elsewhere) goes back to the list.
  useEffect(() => {
    if (routes && openId && !routes.some((r) => r.id === openId)) router.replace(ROUTES_PATH, { scroll: false });
  }, [routes, openId, router]);

  const commit = async (next: StudyRoute) => {
    const before = routes?.find((r) => r.id === next.id);
    const saved = await saveRoute(next);
    setRoutes((prev) => (prev ?? []).map((r) => (r.id === saved.id ? saved : r)));
    if (before) void followStatuses(before, saved);
  };

  const create = async (route: StudyRoute) => {
    const saved = await saveRoute(route);
    setRoutes((prev) => [saved, ...(prev ?? [])]);
    router.push(routePath(saved.id), { scroll: false });
  };

  const remove = async (id: string) => {
    await deleteRoute(id);
    setRoutes((prev) => (prev ?? []).filter((r) => r.id !== id));
    router.replace(ROUTES_PATH, { scroll: false });
  };

  if (!routes) return <p className="text-center text-sm text-ink-2">Cargando…</p>;

  if (open) {
    return (
      <RouteDetail
        key={open.id}
        route={open}
        scores={scores}
        onChange={(next) => void commit(next)}
        onClose={() => router.push(ROUTES_PATH, { scroll: false })}
        onDelete={() => void remove(open.id)}
      />
    );
  }

  return <RouteList routes={routes} onCreate={(r) => void create(r)} onOpen={(id) => router.push(routePath(id), { scroll: false })} />;
}

/**
 * Keeps the scores' statuses in step with the route: a piece ticked done
 * makes its score "dominada"; un-ticking it, or a piece becoming the one in
 * hand, makes it "en estudio". Only the scores involved in the change are
 * touched, so a status set by hand elsewhere survives. Each score is read
 * from the database at that moment: one just saved from the catalogue isn't
 * in any list yet.
 */
async function followStatuses(before: StudyRoute, after: StudyRoute) {
  const status = async (id: string) => {
    const s = await getScore(id);
    return s ? scoreStatus(s) : null;
  };
  for (const piece of after.pieces) {
    if (!piece.scoreId) continue;
    const was = before.pieces.find((p) => p.id === piece.id);
    if (piece.done && !was?.done) await updateScoreStatus(piece.scoreId, "learned");
    else if (!piece.done && was?.done && (await status(piece.scoreId)) === "learned") await updateScoreStatus(piece.scoreId, "studying");
  }
  const now = currentPiece(after);
  const wasNow = currentPiece(before);
  const newlyLinked = now?.scoreId && now.scoreId !== before.pieces.find((p) => p.id === now.id)?.scoreId;
  if (now?.scoreId && (now.id !== wasNow?.id || newlyLinked) && (await status(now.scoreId)) === "pending") {
    await updateScoreStatus(now.scoreId, "studying");
  }
}
