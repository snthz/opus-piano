"use client";

import { useEffect, useState } from "react";
import { engraveCover } from "@/lib/music/engrave";
import { updateScoreThumbnail, type ScoreRecord } from "@/lib/scores-db";

/**
 * La portada de una partitura de la biblioteca.
 *
 * Un PDF trae la suya desde que se sube (la primera página). Un MusicXML no
 * tiene páginas que fotografiar, así que se graba la primera con Verovio la
 * primera vez que hace falta y se guarda en la partitura: así se hace una
 * sola vez por partitura y viaja con ella al servidor, como la de un PDF.
 */
export function useScoreCover(record: ScoreRecord): string {
  // La recién grabada se guarda con su id: así, al pasar a otra partitura,
  // no se ve un instante la portada de la anterior.
  const [made, setMade] = useState<{ id: string; cover: string } | null>(null);

  useEffect(() => {
    if (record.thumbnail || record.kind !== "musicxml") return;
    let cancelled = false;
    void (async () => {
      const jpeg = await engraveCover(await record.file.text());
      if (!jpeg || cancelled) return;
      setMade({ id: record.id, cover: jpeg });
      await updateScoreThumbnail(record.id, jpeg);
    })();
    return () => {
      cancelled = true;
    };
  }, [record.id, record.thumbnail, record.kind, record.file]);

  return record.thumbnail || (made?.id === record.id ? made.cover : "");
}
