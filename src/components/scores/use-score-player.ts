"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { playTimeline, unlockAudio, type PlaybackHandle } from "@/lib/audio/synth";
import { buildTimeline, parseMusicXml, type ParsedScore } from "@/lib/music/musicxml";

/** Lee y analiza un MusicXML. El resultado se asocia al Blob: si cambia, vuelve a ser null. */
export function useParsedXml(file?: Blob): { parsed: ParsedScore | null; error: string | null } {
  const [state, setState] = useState<{ file?: Blob; parsed: ParsedScore | null; error: string | null }>({
    parsed: null,
    error: null,
  });

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    file
      .text()
      .then((xml) => !cancelled && setState({ file, parsed: parseMusicXml(xml), error: null }))
      .catch((e: unknown) => !cancelled && setState({ file, parsed: null, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!file || state.file !== file) return { parsed: null, error: null };
  return { parsed: state.parsed, error: state.error };
}

/** Notas que suenan ahora, por pentagrama, como índices globales dentro de cada uno. */
export type ActiveNotes = number[][];

/** Reproducción de una partitura analizada, con tempo y resaltado de las notas que suenan. */
export function useScorePlayer(parsed: ParsedScore | null) {
  // El tempo del archivo manda hasta que el usuario lo toca para esta misma partitura.
  const [override, setOverride] = useState<{ of: ParsedScore; tempo: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState<ActiveNotes>([]);
  const handle = useRef<PlaybackHandle | null>(null);

  const timeline = useMemo(() => (parsed ? buildTimeline(parsed) : []), [parsed]);
  const tempo = override && override.of === parsed ? override.tempo : parsed?.tempo || 90;

  useEffect(() => () => handle.current?.stop(), []);
  useEffect(() => {
    handle.current?.stop();
  }, [parsed]);

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
        const next: ActiveNotes = parsed.clefs.map(() => []);
        for (const n of timeline) {
          if (n.start !== start) continue;
          for (const r of n.refs) next[r.staff].push(r.index);
        }
        setActive(next);
      },
    });
  };

  return {
    playing,
    active,
    tempo,
    setTempo: (t: number) => parsed && setOverride({ of: parsed, tempo: t }),
    toggle,
    stop: () => handle.current?.stop(),
  };
}
