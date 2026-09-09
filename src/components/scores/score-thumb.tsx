"use client";

import { useMemo } from "react";
import { Score, type Tie } from "@/components/notation/score";
import { measureToEasyScore, type ParsedScore } from "@/lib/music/musicxml";
import { tieIndexes, tupletGroups } from "@/lib/music/voices";

/**
 * Los primeros compases de una partitura dibujados pequeños, como portada:
 * lo que en un PDF es la miniatura de la primera página. Dos sistemas de dos
 * compases; lo que no cabe en la caja se recorta por abajo, como una hoja.
 */
export function ScoreThumb({
  parsed,
  perSystem = 2,
  systems = 2,
  width = 340,
}: {
  parsed: ParsedScore;
  perSystem?: number;
  systems?: number;
  width?: number;
}) {
  const rows = useMemo(() => {
    const out: { measures: string[]; ties: Tie[]; tuplets: [number, number, number][] }[][] = [];
    for (let s = 0; s < systems; s++) {
      const from = s * perSystem;
      if (from >= parsed.measures.length) break;
      const slice = parsed.measures.slice(from, from + perSystem);
      out.push(
        parsed.clefs.map((clef, staff) => {
          const events = slice.flatMap((m) => m.staves[staff] ?? []);
          const ties: Tie[] = [];
          events.forEach((ev, i) => {
            if (!ev.tieStart || i + 1 >= events.length) return;
            const { fromIdx, toIdx } = tieIndexes(ev, events[i + 1]);
            if (fromIdx.length) ties.push([i, i + 1, fromIdx, toIdx]);
          });
          return { measures: slice.map((m) => measureToEasyScore(m.staves[staff] ?? [], clef)), ties, tuplets: tupletGroups(events) };
        }),
      );
    }
    return out;
  }, [parsed, perSystem, systems]);

  const grand = parsed.clefs.length > 1;

  return (
    // los sistemas se acercan más que en la partitura de verdad: VexFlow deja aire arriba y abajo de cada uno
    <div className="pointer-events-none flex flex-col px-2 pt-2 [&>*+*]:-mt-8" aria-hidden>
      {rows.map((staves, i) => (
        <Score
          key={i}
          clef={parsed.clefs[0]}
          bassClef={parsed.clefs[1]}
          keySignature={parsed.keyVex}
          time={`${parsed.time.num}/${parsed.time.den}`}
          showTime={i === 0}
          measures={staves[0].measures}
          bassMeasures={grand ? staves[1].measures : undefined}
          ties={staves[0].ties}
          bassTies={grand ? staves[1].ties : undefined}
          tuplets={staves[0].tuplets}
          bassTuplets={grand ? staves[1].tuplets : undefined}
          width={width}
          endBar="none"
        />
      ))}
    </div>
  );
}
