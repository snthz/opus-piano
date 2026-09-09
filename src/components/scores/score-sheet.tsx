"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Score, type MeasureRepeat, type Tie } from "@/components/notation/score";
import { eventLabel, measureToEasyScore, type ParsedScore } from "@/lib/music/musicxml";
import { tieIndexes, tupletGroups } from "@/lib/music/voices";
import { useSettings } from "@/lib/settings";
import type { ActiveNotes } from "./use-score-player";

interface Props {
  parsed: ParsedScore;
  active: ActiveNotes;
  showNames: boolean;
}

/** La partitura analizada dibujada por sistemas (líneas), con resaltado y nombres opcionales. */
export function ScoreSheet({ parsed, active, showNames }: Props) {
  const { settings } = useSettings();
  // En pantallas anchas caben más compases por sistema.
  const [perSystem] = useState(() => (window.matchMedia("(min-width: 768px)").matches ? 4 : 2));
  const systemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Índice global de la primera nota de cada compás, por pentagrama.
  const offsets = useMemo(
    () =>
      parsed.clefs.map((_, staff) => {
        const out: number[] = [];
        let n = 0;
        for (const m of parsed.measures) {
          out.push(n);
          n += (m.staves[staff] ?? []).length;
        }
        out.push(n);
        return out;
      }),
    [parsed],
  );

  const systems = useMemo(() => {
    const out: { from: number; to: number }[] = [];
    for (let i = 0; i < parsed.measures.length; i += perSystem) {
      out.push({ from: i, to: Math.min(i + perSystem, parsed.measures.length) });
    }
    return out;
  }, [parsed, perSystem]);

  // Al avanzar la reproducción, el sistema activo se mantiene a la vista.
  const activeSystem = useMemo(() => {
    const staff = active.findIndex((a) => a.length);
    if (staff < 0) return -1;
    const idx = active[staff][0];
    const mi = offsets[staff].findIndex((o, i) => idx >= o && idx < offsets[staff][i + 1]);
    return systems.findIndex((s) => mi >= s.from && mi < s.to);
  }, [active, offsets, systems]);
  useEffect(() => {
    if (activeSystem >= 0) systemRefs.current[activeSystem]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeSystem]);

  const grand = parsed.clefs.length > 1;

  return (
    <div className="card p-4 md:p-6 overflow-x-auto space-y-1">
      {systems.map((sys, si) => {
        const slice = parsed.measures.slice(sys.from, sys.to);
        // Barras de repetición y casillas; el corchete de una casilla puede seguir de un sistema al siguiente.
        const repeats: MeasureRepeat[] = slice.map((m, k) => {
          const rep: MeasureRepeat = { start: !!m.repeatStart, end: !!m.repeatEnd };
          if (m.ending) {
            const opens = (parsed.measures[sys.from + k - 1]?.ending ?? 0) !== m.ending;
            const closes = (parsed.measures[sys.from + k + 1]?.ending ?? 0) !== m.ending;
            rep.ending = { number: m.ending, bracket: opens && closes ? "both" : opens ? "begin" : closes ? "end" : "mid" };
          }
          return rep;
        });
        const perStaff = parsed.clefs.map((clef, staff) => {
          const events = slice.flatMap((m) => m.staves[staff] ?? []);
          const base = offsets[staff][sys.from];
          // a tie joins only the pitches that are actually held: a bass under changing chords
          const ties: Tie[] = [];
          events.forEach((ev, i) => {
            if (!ev.tieStart || i + 1 >= events.length) return;
            const { fromIdx, toIdx } = tieIndexes(ev, events[i + 1]);
            if (fromIdx.length) ties.push([i, i + 1, fromIdx, toIdx]);
          });
          return {
            measures: slice.map((m) => measureToEasyScore(m.staves[staff] ?? [], clef)),
            labels: showNames ? events.map((ev) => eventLabel(ev, settings.naming)) : undefined,
            ties,
            tuplets: tupletGroups(events),
            highlight: active[staff]?.filter((g) => g >= base && g < offsets[staff][sys.to]).map((g) => g - base) ?? [],
          };
        });
        return (
          <div key={si} ref={(el) => { systemRefs.current[si] = el; }} className="flex justify-center">
            <Score
              clef={parsed.clefs[0]}
              bassClef={parsed.clefs[1]}
              keySignature={parsed.keyVex}
              time={`${parsed.time.num}/${parsed.time.den}`}
              showTime={si === 0}
              measures={perStaff[0].measures}
              bassMeasures={grand ? perStaff[1].measures : undefined}
              labels={perStaff[0].labels}
              bassLabels={grand ? perStaff[1].labels : undefined}
              ties={perStaff[0].ties}
              bassTies={grand ? perStaff[1].ties : undefined}
              tuplets={perStaff[0].tuplets}
              bassTuplets={grand ? perStaff[1].tuplets : undefined}
              highlight={perStaff[0].highlight}
              bassHighlight={grand ? perStaff[1].highlight : undefined}
              highlightBand
              width={perSystem >= 4 ? 760 : 540}
              endBar={si === systems.length - 1 ? "end" : "single"}
              repeats={repeats}
            />
          </div>
        );
      })}
    </div>
  );
}
