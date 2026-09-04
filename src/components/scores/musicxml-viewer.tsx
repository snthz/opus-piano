"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Score } from "@/components/notation/score";
import { playTimeline, unlockAudio, type PlaybackHandle } from "@/lib/audio/synth";
import { keyByVex, keyName } from "@/lib/music/keys";
import { buildTimeline, eventLabel, measureToEasyScore, parseMusicXml, type ParsedScore } from "@/lib/music/musicxml";
import type { ScoreRecord } from "@/lib/scores-db";
import { useSettings } from "@/lib/settings";

interface Props {
  record: ScoreRecord;
}

/** Notas resaltadas por pentagrama, como índices globales dentro de cada uno. */
type Active = number[][];

export function MusicXmlViewer({ record }: Props) {
  const { settings } = useSettings();
  const [parsed, setParsed] = useState<ParsedScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNames, setShowNames] = useState(false);
  const [tempo, setTempo] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState<Active>([]);
  // En pantallas anchas caben más compases por línea (sistema).
  const [perSystem] = useState(() => (window.matchMedia("(min-width: 768px)").matches ? 4 : 2));
  const handle = useRef<PlaybackHandle | null>(null);
  const systemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    record.file
      .text()
      .then((xml) => {
        if (cancelled) return;
        const p = parseMusicXml(xml);
        setParsed(p);
        setTempo(p.tempo || 90);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      handle.current?.stop();
    };
  }, [record.file]);

  const timeline = useMemo(() => (parsed ? buildTimeline(parsed) : []), [parsed]);

  // Índice global de la primera nota de cada compás, por pentagrama.
  const offsets = useMemo(() => {
    if (!parsed) return [];
    return parsed.clefs.map((_, staff) => {
      const out: number[] = [];
      let n = 0;
      for (const m of parsed.measures) {
        out.push(n);
        n += (m.staves[staff] ?? []).length;
      }
      out.push(n);
      return out;
    });
  }, [parsed]);

  const systems = useMemo(() => {
    if (!parsed) return [];
    const out: { from: number; to: number }[] = [];
    for (let i = 0; i < parsed.measures.length; i += perSystem) {
      out.push({ from: i, to: Math.min(i + perSystem, parsed.measures.length) });
    }
    return out;
  }, [parsed, perSystem]);

  // Al avanzar la reproducción, el sistema activo se mantiene a la vista.
  const activeSystem = useMemo(() => {
    if (!parsed || !active.some((a) => a.length)) return -1;
    const staff = active.findIndex((a) => a.length);
    const idx = active[staff][0];
    const mi = offsets[staff].findIndex((o, i) => idx >= o && idx < offsets[staff][i + 1]);
    return systems.findIndex((s) => mi >= s.from && mi < s.to);
  }, [active, offsets, systems, parsed]);
  useEffect(() => {
    if (activeSystem >= 0) systemRefs.current[activeSystem]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeSystem]);

  const toggle = async () => {
    if (playing) {
      handle.current?.stop();
      return;
    }
    if (!parsed) return;
    await unlockAudio();
    setPlaying(true);
    handle.current = playTimeline(timeline, tempo, {
      onNote: (i) => {
        if (i < 0) {
          setActive([]);
          setPlaying(false);
          return;
        }
        // Todo lo que empieza en el mismo instante (las dos manos) se resalta a la vez.
        const start = timeline[i].start;
        const next: Active = parsed.clefs.map(() => []);
        for (const n of timeline) {
          if (n.start !== start) continue;
          for (const r of n.refs) next[r.staff].push(r.index);
        }
        setActive(next);
      },
    });
  };

  if (error) return <p className="text-sm text-bad">{error}</p>;
  if (!parsed) return <p className="text-sm text-ink-2">Leyendo la partitura…</p>;

  const key = keyByVex(parsed.keyVex);
  const grand = parsed.clefs.length > 1;

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-2">
        {parsed.measures.length} compases · {keyName(key, settings.naming)} · {parsed.time.num}/{parsed.time.den}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={!settings.sound}
          className={`pill py-1.5 text-sm ${playing ? "pill-active" : "bg-accent text-white"} disabled:opacity-50`}
        >
          {playing ? "■ Detener" : "▶ Escuchar"}
        </button>
        <button type="button" onClick={() => setShowNames((v) => !v)} className={`pill py-1.5 text-xs ${showNames ? "pill-active" : ""}`}>
          {showNames ? "Ocultar nombres" : "Mostrar nombres"}
        </button>
        <label className="flex items-center gap-2 text-xs text-ink-2 ml-auto">
          ♩ = {tempo}
          <input
            type="range"
            min={40}
            max={200}
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
            disabled={playing}
            className="accent-(--accent) w-28"
            aria-label="Tempo"
          />
        </label>
      </div>
      {!settings.sound && <p className="text-xs text-bad">Activa el sonido en Ajustes para escuchar la partitura.</p>}

      <div className="space-y-2">
        {systems.map((sys, si) => {
          const slice = parsed.measures.slice(sys.from, sys.to);
          const perStaff = parsed.clefs.map((clef, staff) => {
            const events = slice.flatMap((m) => m.staves[staff] ?? []);
            const base = offsets[staff][sys.from];
            const ties: [number, number][] = [];
            events.forEach((ev, i) => {
              if (ev.tieStart && i + 1 < events.length) ties.push([i, i + 1]);
            });
            return {
              measures: slice.map((m) => measureToEasyScore(m.staves[staff] ?? [], clef)),
              labels: showNames ? events.map((ev) => eventLabel(ev, settings.naming)) : undefined,
              ties,
              highlight: active[staff]?.filter((g) => g >= base && g < offsets[staff][sys.to]).map((g) => g - base) ?? [],
            };
          });
          return (
            <div key={si} ref={(el) => { systemRefs.current[si] = el; }} className="card p-3 overflow-x-auto">
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
                highlight={perStaff[0].highlight}
                bassHighlight={grand ? perStaff[1].highlight : undefined}
                width={perSystem >= 4 ? 760 : 540}
                endBar={si === systems.length - 1 ? "end" : "single"}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
