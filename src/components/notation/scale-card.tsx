"use client";

import { useMemo, useState } from "react";
import { Score } from "./score";
import { PianoKeyboard } from "./piano-keyboard";
import { PlayButton } from "@/components/audio/play-button";
import { arpeggioFingering, scaleFingering } from "@/lib/music/fingering";
import { keyName, type KeyInfo } from "@/lib/music/keys";
import { noteName, toEasyScore, toMidi, type Pitch } from "@/lib/music/pitch";
import { SCALES, buildScale } from "@/lib/music/scales";
import { useSettings } from "@/lib/settings";

type Hands = "derecha" | "izquierda" | "separadas" | "juntas" | null | undefined;

/**
 * The scale of a key, ready to practise: one octave up and one down on a
 * grand staff with the standard fingering over every note, the keys lit on
 * a piano, and a button to hear it. Below, the arpeggio the same way.
 *
 * Fingering numbers go on the staff and note names on the keyboard: putting
 * both under the notes made the staff unreadable on a phone.
 */
export function ScaleCard({ keyInfo, hands }: { keyInfo: KeyInfo; hands?: Hands }) {
  const { settings } = useSettings();
  const [current, setCurrent] = useState(-1);
  const showRH = hands !== "izquierda";
  const showLH = hands !== "derecha";

  const scale = useMemo(() => {
    const type = SCALES.find((s) => s.id === (keyInfo.mode === "mayor" ? "mayor" : "menor-armonica"))!;
    const tonic = (octave: number): Pitch => ({ letter: keyInfo.tonic, accidental: keyInfo.tonicAccidental, octave });
    const octave = (from: number) => {
      const t = tonic(from);
      const up = [...buildScale(type, t), { ...t, octave: from + 1 }];
      const down = [...up].reverse();
      return { up, down };
    };
    const rh = octave(4);
    const lh = octave(3);
    const fingering = scaleFingering(keyInfo);
    const arpeggio = {
      rh: [rh.up[0], rh.up[2], rh.up[4], rh.up[7]],
      lh: [lh.up[0], lh.up[2], lh.up[4], lh.up[7]],
      fingering: arpeggioFingering(keyInfo),
    };
    return { type, rh, lh, fingering, arpeggio };
  }, [keyInfo]);

  const eighths = (notes: Pitch[]) => notes.map((n) => `${toEasyScore(n)}/8`).join(", ");
  const quarters = (notes: Pitch[]) => notes.map((n) => `${toEasyScore(n)}/q`).join(", ");
  const labels = (list: number[] | undefined, reverse = false) => list && (reverse ? [...list].reverse() : list).map(String);

  // one sequence: up (0-7) then down (8-15); each panel lights its own half
  const sequence = useMemo(() => {
    const rh = [...scale.rh.up, ...scale.rh.down];
    const lh = [...scale.lh.up, ...scale.lh.down];
    return rh.map((_, i) => ({
      midis: [showRH ? toMidi(rh[i]) : null, showLH ? toMidi(lh[i]) : null].filter((m): m is number => m !== null),
      beats: 0.5,
    }));
  }, [scale, showRH, showLH]);

  const allMidis = useMemo(() => Array.from(new Set(sequence.flatMap((e) => e.midis))), [sequence]);
  const lit = current >= 0 ? sequence[current].midis : allMidis;
  const upIndex = current >= 0 && current < 8 ? current : undefined;
  const downIndex = current >= 8 ? current - 8 : undefined;

  const title = `Escala de ${keyName(keyInfo, settings.naming)}${keyInfo.mode === "menor" ? " armónica" : ""}`;
  const noteList = scale.rh.up.slice(0, -1).map((n) => noteName(n, settings.naming)).join(" · ");

  /** A grand staff (or a single one when only one hand plays) for 8 notes. */
  const panel = (rh: Pitch[], lh: Pitch[], rhF: string[] | undefined, lhF: string[] | undefined, highlight: number | undefined, label: string) => (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1">{label}</p>
      {showRH && showLH ? (
        <Score
          measures={[eighths(rh)]}
          bassMeasures={[eighths(lh)]}
          labels={rhF}
          bassLabels={lhF}
          labelPosition="above"
          time="4/4"
          showTime={false}
          width={420}
          highlight={highlight}
          bassHighlight={highlight}
          highlightBand
          title={`${title}, ${label.toLowerCase()}`}
        />
      ) : (
        <Score
          clef={showRH ? "treble" : "bass"}
          measures={[eighths(showRH ? rh : lh)]}
          labels={showRH ? rhF : lhF}
          labelPosition="above"
          time="4/4"
          showTime={false}
          width={420}
          highlight={highlight}
          highlightBand
          title={`${title}, ${label.toLowerCase()}`}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="font-bold">{title}</h4>
        <p className="text-xs text-ink-2">{noteList}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {panel(scale.rh.up, scale.lh.up, labels(scale.fingering?.rh), labels(scale.fingering?.lh), upIndex, "Sube")}
        {panel(scale.rh.down, scale.lh.down, labels(scale.fingering?.rh, true), labels(scale.fingering?.lh, true), downIndex, "Baja")}
      </div>

      <PianoKeyboard from={Math.min(...allMidis) - 1} to={Math.max(...allMidis) + 1} highlight={lit} labels="all" />

      <div className="flex flex-wrap items-center gap-2">
        <PlayButton events={sequence} bpm={72} label="Escuchar la escala" onEvent={setCurrent} size="sm" />
        <p className="text-xs text-ink-2">
          Los números son la digitación habitual (1 = pulgar){showRH && showLH ? ": arriba, mano derecha; abajo, mano izquierda." : "."}
        </p>
      </div>

      <details className="group">
        <summary className="cursor-pointer text-sm font-medium list-none flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-surface-2 grid place-items-center text-ink-3 group-open:rotate-90 transition-transform">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-3 h-3" aria-hidden>
              <path d="m10 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Arpegio
        </summary>
        <div className="mt-3 max-w-sm">
          {showRH && showLH ? (
            <Score
              measures={[quarters(scale.arpeggio.rh)]}
              bassMeasures={[quarters(scale.arpeggio.lh)]}
              labels={labels(scale.arpeggio.fingering?.rh)}
              bassLabels={labels(scale.arpeggio.fingering?.lh)}
              labelPosition="above"
              time="4/4"
              showTime={false}
              width={300}
              title={`Arpegio de ${keyName(keyInfo, settings.naming)}`}
            />
          ) : (
            <Score
              clef={showRH ? "treble" : "bass"}
              measures={[quarters(showRH ? scale.arpeggio.rh : scale.arpeggio.lh)]}
              labels={labels(showRH ? scale.arpeggio.fingering?.rh : scale.arpeggio.fingering?.lh)}
              labelPosition="above"
              time="4/4"
              showTime={false}
              width={300}
              title={`Arpegio de ${keyName(keyInfo, settings.naming)}`}
            />
          )}
          {!scale.arpeggio.fingering && <p className="text-xs text-ink-3">En esta tonalidad la digitación del arpegio depende de qué teclas negras caen: pregúntale al profesor.</p>}
        </div>
      </details>
    </div>
  );
}
