"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowIcon, ChevronIcon } from "@/components/ui/arrow-icon";
import { ScoreCover } from "@/components/scores/score-cover";
import { StatusLabel } from "@/components/scores/score-status";
import { useScoreCover } from "@/components/scores/use-score-cover";
import { listRoutes, onRoutesChange } from "@/lib/routes-db";
import { listScores, onScoresChange, type ScoreRecord } from "@/lib/scores-db";
import { scoreStatus, sortByStatus } from "@/lib/score-status";
import { currentPiece, routeProgress, type StudyRouteRecord } from "@/lib/study-route";

/** More than this and it's a library, not a shortcut row. */
const MAX_SCORES = 8;

/**
 * The quick start at the top of the home page: the scores marked "en
 * estudio", covers in a row you can flick through with a thumb, and the
 * active route with its piece in hand. Everything comes from IndexedDB,
 * nothing is stored here. With nothing in hand it renders nothing — the
 * home page then reads as it did before.
 */
export function ContinueStudying() {
  const [scores, setScores] = useState<ScoreRecord[] | null>(null);
  const [routes, setRoutes] = useState<StudyRouteRecord[]>([]);

  useEffect(() => {
    let alive = true;
    const loadScores = () => listScores().then((all) => alive && setScores(all));
    const loadRoutes = () => listRoutes().then((all) => alive && setRoutes(all));
    void loadScores();
    void loadRoutes();
    const offScores = onScoresChange(() => void loadScores());
    const offRoutes = onRoutesChange(() => void loadRoutes());
    return () => {
      alive = false;
      offScores();
      offRoutes();
    };
  }, []);

  if (!scores) return null;
  const studying = sortByStatus(scores)
    .filter((s) => scoreStatus(s) === "studying")
    .slice(0, MAX_SCORES);
  const route = routes.find((r) => !r.archived) ?? null;
  if (studying.length === 0 && !route) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <h2 className="text-xl font-semibold tracking-tight">Sigue practicando</h2>
        <Link href="/scores" className="pill shrink-0 py-1.5 text-sm">
          Partituras
          <ChevronIcon dir="right" className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="space-y-3">
        {route && <RouteCard route={route} />}
        {/* A list, not a grid of covers: one line per score reads faster and
            the whole row is the button, which a thumb never misses. */}
        {/* px-3 on the list plus px-3 on each row: the card's 28 px corners
            need that much air or the first thumbnail looks crammed into the curve. */}
        {studying.length > 0 && (
          <ul className="card divide-y divide-line px-3">
            {studying.map((s) => (
              <ScoreRow key={s.id} record={s} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function RouteCard({ route }: { route: StudyRouteRecord }) {
  const piece = currentPiece(route);
  const { done, total } = routeProgress(route);
  return (
    <Link href={`/routes?route=${encodeURIComponent(route.id)}`} className="card-pastel bg-yellow group flex items-center gap-4 p-4">
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-2">Tu ruta · {done} de {total} piezas</span>
        <span className="mt-0.5 block truncate text-base font-semibold leading-tight tracking-tight">{route.name}</span>
        {piece ? (
          <span className="mt-1 block truncate text-sm text-ink-2">
            Ahora: <span className="font-medium text-ink">{piece.title}</span>
          </span>
        ) : (
          <span className="mt-1 block text-sm text-ink-2">Ruta completa.</span>
        )}
      </span>
      <span className="btn-circle h-10 w-10 shrink-0 group-hover:-translate-y-0.5">
        <ArrowIcon className="h-4 w-4" />
      </span>
    </Link>
  );
}

function ScoreRow({ record }: { record: ScoreRecord }) {
  const cover = useScoreCover(record);
  const isXml = record.kind === "musicxml";
  const count = isXml ? `${record.pageCount} ${record.pageCount === 1 ? "compás" : "compases"}` : `${record.pageCount} ${record.pageCount === 1 ? "página" : "páginas"}`;
  return (
    <li>
      <Link href={`/scores?score=${encodeURIComponent(record.id)}`} className="group flex items-center gap-3.5 px-3 py-3.5 focus:outline-none" aria-label={`Abrir ${record.name}`}>
        <ScoreCover src={cover} className="w-11 shrink-0 rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium leading-tight">{record.name}</span>
          <span className="mt-0.5 block truncate text-xs text-ink-2">
            <StatusLabel status="studying" /> · {isXml ? "MusicXML" : "PDF"} · {count}
          </span>
        </span>
        <ArrowIcon className="mr-1 h-5 w-5 shrink-0 text-ink-3 transition-colors group-hover:text-ink" />
      </Link>
    </li>
  );
}
