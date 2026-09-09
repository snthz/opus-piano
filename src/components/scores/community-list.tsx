"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listShared, type SharedScore } from "@/lib/community";
import { UserError } from "@/lib/user-error";
import { PlayIcon } from "./reader-icons";
import { CoverDot, CoverTag, ScoreCover, TileText } from "./score-cover";

/** Las partituras que otras personas han puesto en público, de la más reciente a la más antigua. */
export function CommunityList() {
  const [scores, setScores] = useState<SharedScore[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listShared().then(setScores, (e: unknown) => setError(e instanceof UserError ? e.message : "No se ha podido cargar la lista."));
  }, []);

  if (error) return <p className="px-1 text-sm text-bad">{error}</p>;
  if (!scores) return <p className="px-1 text-sm text-ink-2">Cargando…</p>;
  if (!scores.length) {
    return (
      <div className="rounded-3xl border border-line bg-surface px-6 py-10 text-center">
        <p className="text-sm font-semibold">Todavía no hay partituras compartidas</p>
        <p className="mt-1 text-xs text-ink-2">Desde el menú ⋯ de cualquiera de las tuyas puedes ser quien empiece.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
      {scores.map((s) => (
        <SharedCard key={s.id} score={s} />
      ))}
    </div>
  );
}

function SharedCard({ score }: { score: SharedScore }) {
  return (
    <Link href={`/scores/community/${encodeURIComponent(score.id)}`} className="group block focus:outline-none">
      <ScoreCover src={score.thumbnail}>
          <CoverTag>{score.kind === "musicxml" ? "MusicXML" : "PDF"}</CoverTag>
          {score.playable && (
            <span className="absolute bottom-2 right-2">
              <CoverDot label="Se puede escuchar">
                <PlayIcon className="h-2.5 w-2.5" />
              </CoverDot>
            </span>
          )}
      </ScoreCover>
      <TileText title={score.name} meta={score.description || undefined} sub={`${score.owner} · ${score.kind === "musicxml" ? `${score.pageCount} compases` : `${score.pageCount} páginas`}`} />
    </Link>
  );
}
