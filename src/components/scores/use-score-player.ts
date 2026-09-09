"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getAudioContext, playTimeline, unlockAudio, type PlaybackHandle } from "@/lib/audio/synth";
import { buildTimeline, parseMusicXml, type ParsedScore } from "@/lib/music/musicxml";

/**
 * Lee y analiza un MusicXML. Devuelve también el texto tal cual, que es lo
 * que necesita el grabado (`engrave.ts`) para dibujar la partitura original
 * sin volver a leer el Blob. El resultado se asocia al Blob: si cambia,
 * vuelve a ser null.
 */
export function useParsedXml(file?: Blob): { parsed: ParsedScore | null; xml: string | null; error: string | null } {
  const [state, setState] = useState<{ file?: Blob; parsed: ParsedScore | null; xml: string | null; error: string | null }>({
    parsed: null,
    xml: null,
    error: null,
  });

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    file
      .text()
      .then((xml) => !cancelled && setState({ file, parsed: parseMusicXml(xml), xml, error: null }))
      .catch((e: unknown) => !cancelled && setState({ file, parsed: null, xml: null, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!file || state.file !== file) return { parsed: null, xml: null, error: null };
  return { parsed: state.parsed, xml: state.xml, error: state.error };
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

  /** Negras transcurridas desde el inicio, según el reloj de audio; null si no suena. */
  const position = () => {
    const h = handle.current;
    if (!playing || !h) return null;
    return Math.max(0, (getAudioContext().currentTime - h.startTime) * (tempo / 60));
  };

  const toggle = async () => {
    if (playing) {
      handle.current?.stop();
      return;
    }
    if (!parsed) return;
    await unlockAudio();
    setPlaying(true);
    // El resaltado no se agenda nota a nota (con setTimeout se desincroniza si el
    // hilo principal se atasca); en su lugar sigue el reloj de audio cada frame,
    // igual que la guía sobre el PDF, así ambos se ven siempre en el mismo punto.
    handle.current = playTimeline(timeline, tempo, {
      onNote: (i) => {
        if (i < 0) {
          setActive([]);
          setPlaying(false);
        }
      },
    });
  };

  useEffect(() => {
    if (!playing || !parsed || !timeline.length) return;
    let raf = 0;
    const tick = () => {
      const pos = position();
      if (pos !== null) {
        // Último evento cuyo inicio ya pasó (búsqueda binaria: timeline está ordenado por start).
        let lo = 0;
        let hi = timeline.length - 1;
        let idx = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (timeline[mid].start <= pos) {
            idx = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        const next: ActiveNotes = parsed.clefs.map(() => []);
        if (idx >= 0) {
          // Todo lo que empieza en el mismo instante (las dos manos) se resalta a la vez.
          const start = timeline[idx].start;
          let k = idx;
          while (k > 0 && timeline[k - 1].start === start) k--;
          for (; k <= idx; k++) for (const r of timeline[k].refs) next[r.staff].push(r.index);
        }
        setActive(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, parsed, timeline]);

  return {
    playing,
    active,
    tempo,
    setTempo: (t: number) => parsed && setOverride({ of: parsed, tempo: t }),
    toggle,
    stop: () => handle.current?.stop(),
    position,
  };
}
