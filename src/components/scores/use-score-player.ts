"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getAudioContext, playNote, playTimeline, unlockAudio, type PlaybackHandle } from "@/lib/audio/synth";
import {
  buildTimeline,
  measureOffsets,
  parseMusicXml,
  type ParsedScore,
  type ScoreTimelineNote,
} from "@/lib/music/musicxml";

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

/**
 * Cómo se ensaya una pieza, que no es como se escucha: un trozo corto, una
 * mano cada vez, en bucle y subiendo de velocidad cuando sale.
 */
export interface PracticeOptions {
  /** Compases que se repiten, contando desde 1; null = la pieza entera. */
  range: { from: number; to: number } | null;
  /** Pentagramas que se ven y se siguen, pero no suenan (0 = el de arriba). */
  silentStaves: number[];
  /** Pulsos de cuenta atrás antes de la primera nota. */
  countIn: number;
  /** Volver a empezar al llegar al final. */
  loop: boolean;
  /** Negras por minuto que se suman en cada vuelta; 0 = siempre al mismo tempo. */
  tempoStep: number;
  /** Velocidad a la que se deja de subir. */
  tempoMax: number;
  /**
   * La partitura espera a que toques. No corre ningún reloj: se avanza al
   * acorde siguiente cuando llegan por MIDI las notas de este.
   */
  follow: boolean;
}

export const DEFAULT_PRACTICE: PracticeOptions = {
  range: null,
  silentStaves: [],
  countIn: 0,
  loop: false,
  tempoStep: 0,
  tempoMax: 160,
  follow: false,
};

/** Lo que hay que tocar a la vez, y lo que suena con ello. */
export interface FollowStep {
  start: number;
  /** Notas que se esperan del alumno. */
  expected: number[];
  /** Lo que toca la app a la vez (la otra mano, si se ha callado una). */
  accompaniment: number[];
  notes: ScoreTimelineNote[];
}

/**
 * Los acordes de la pieza, en orden: todo lo que ataca en el mismo instante.
 *
 * Con una mano callada, esa es la que toca el alumno —callada quiere decir
 * que no la pone la app— y la otra suena de acompañamiento. Sin ninguna
 * callada se espera todo lo que hay escrito.
 */
export function followSteps(timeline: ScoreTimelineNote[], silentStaves: number[]): FollowStep[] {
  const byStart = new Map<number, ScoreTimelineNote[]>();
  for (const note of timeline) {
    const group = byStart.get(note.start);
    if (group) group.push(note);
    else byStart.set(note.start, [note]);
  }
  const studentPlays = (note: ScoreTimelineNote) => (silentStaves.length ? !!note.silent : true);

  return [...byStart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, notes]) => ({
      start,
      expected: [...new Set(notes.filter(studentPlays).flatMap((n) => n.midis))].sort((a, b) => a - b),
      accompaniment: [...new Set(notes.filter((n) => !studentPlays(n)).flatMap((n) => n.midis))],
      notes,
    }))
    // Un acorde sin nada que tocar (todo acompañamiento) no es un paso: sonaría
    // solo y la partitura se quedaría esperando a nadie.
    .filter((step) => step.expected.length > 0);
}

/**
 * Reproducción de una partitura analizada, con tempo y resaltado de las notas
 * que suenan, y con lo que hace falta para ensayarla: repetir unos compases,
 * callar una mano, contar antes de empezar y subir el tempo vuelta a vuelta.
 */
export function useScorePlayer(parsed: ParsedScore | null) {
  // El tempo del archivo manda hasta que el usuario lo toca para esta misma partitura.
  const [override, setOverride] = useState<{ of: ParsedScore; tempo: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState<ActiveNotes>([]);
  const [practice, setPracticeState] = useState<PracticeOptions>(DEFAULT_PRACTICE);
  /** Vueltas dadas en el bucle actual, para contarlas y para subir el tempo. */
  const [pass, setPass] = useState(0);
  /** Modo espera: por qué acorde va y cuántas notas se han equivocado. */
  const [step, setStep] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const done = useRef(new Set<number>());
  const handle = useRef<PlaybackHandle | null>(null);
  /** Tempo de la vuelta que suena ahora: con el tempo progresivo no es el del control. */
  const passTempo = useRef(0);
  /** Lo ha parado el usuario: entonces no se encadena otra vuelta. */
  const cancelled = useRef(false);

  const { range, silentStaves } = practice;
  const rangeKey = range ? `${range.from}-${range.to}` : "";
  const silentKey = silentStaves.join(",");
  const timeline = useMemo(
    () => (parsed ? buildTimeline(parsed, { range: range ?? undefined, silentStaves }) : []),
    // las claves evitan rehacer la línea de tiempo por un objeto nuevo con el mismo contenido
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed, rangeKey, silentKey],
  );
  const tempo = override && override.of === parsed ? override.tempo : parsed?.tempo || 90;
  const steps = useMemo(() => (practice.follow ? followSteps(timeline, silentStaves) : []), [timeline, practice.follow, silentStaves]);

  /**
   * Negras a las que empieza el trozo dentro de la partitura impresa. El
   * grabado cuenta el tiempo desde el principio de la pieza, así que sin esto
   * un bucle del compás 9 encendería las notas del 1.
   */
  const offset = useMemo(() => {
    if (!parsed || !range) return 0;
    return measureOffsets(parsed)[Math.max(0, Math.min(range.from - 1, parsed.measures.length - 1))] ?? 0;
  }, [parsed, range]);

  // Al desmontar o al cambiar de partitura se corta, y sin encadenar otra
  // vuelta: el bucle vive en la promesa de la vuelta anterior.
  useEffect(
    () => () => {
      cancelled.current = true;
      handle.current?.stop();
    },
    [],
  );
  useEffect(() => {
    cancelled.current = true;
    handle.current?.stop();
  }, [parsed]);

  const setPractice = (patch: Partial<PracticeOptions>) => {
    // Cambiar el trozo o las manos a mitad de vuelta dejaría sonando lo anterior.
    stop();
    setPracticeState((p) => ({ ...p, ...patch }));
  };

  /** Negras transcurridas dentro del trozo que suena; null si no suena. */
  const elapsed = () => {
    const h = handle.current;
    if (!playing || !h || !passTempo.current) return null;
    return Math.max(0, (getAudioContext().currentTime - h.startTime) * (passTempo.current / 60));
  };

  /** Lo mismo, pero medido sobre la partitura entera: es lo que sigue el grabado. */
  const position = () => {
    // En modo espera no hay reloj: la posición es el acorde por el que se va.
    if (practice.follow) return playing ? (steps[step]?.start ?? 0) + offset : null;
    const at = elapsed();
    return at === null ? null : at + offset;
  };

  const startPass = (at: number, count: number) => {
    passTempo.current = at;
    const h = playTimeline(timeline, at, { countIn: count });
    handle.current = h;
    void h.done.then(() => {
      if (cancelled.current) return;
      if (practice.loop) {
        setPass((n) => n + 1);
        // Sube un escalón por vuelta hasta el tope: así se llega al tempo real
        // por donde se llega de verdad, poco a poco.
        const next = practice.tempoStep ? Math.min(practice.tempoMax, at + practice.tempoStep) : at;
        startPass(next, practice.countIn);
      } else {
        setActive([]);
        setPlaying(false);
      }
    });
  };

  const stop = () => {
    cancelled.current = true;
    handle.current?.stop();
    handle.current = null;
    done.current.clear();
    setActive([]);
    setPlaying(false);
  };

  /**
   * Una nota tocada por el alumno, en modo espera. Cuando están todas las del
   * acorde, suena el acompañamiento y la partitura avanza; lo que no toca se
   * cuenta, pero no para nada: equivocarse no puede cortar la lectura.
   */
  const played = (midi: number) => {
    if (!playing || !practice.follow) return;
    const current = steps[step];
    if (!current) return;
    if (!current.expected.includes(midi)) {
      setMistakes((n) => n + 1);
      return;
    }
    done.current.add(midi);
    if (!current.expected.every((m) => done.current.has(m))) return;

    done.current.clear();
    for (const midi of current.accompaniment) playNote(midi, { duration: 0.9, velocity: 0.5 });
    if (step + 1 < steps.length) {
      setStep(step + 1);
      return;
    }
    if (practice.loop) {
      setPass((n) => n + 1);
      setStep(0);
    } else {
      stop();
    }
  };

  const toggle = async () => {
    if (playing) {
      stop();
      return;
    }
    if (!parsed || !timeline.length) return;
    await unlockAudio();
    cancelled.current = false;
    setPass(0);
    setMistakes(0);
    setPlaying(true);
    if (practice.follow) {
      setStep(0);
      done.current.clear();
      return;
    }
    // El resaltado no se agenda nota a nota (con setTimeout se desincroniza si el
    // hilo principal se atasca); en su lugar sigue el reloj de audio cada frame,
    // igual que la guía sobre el PDF, así ambos se ven siempre en el mismo punto.
    startPass(tempo, practice.countIn);
  };

  // En modo espera el resaltado no lo mueve ningún reloj, sino el acorde por
  // el que se va: no hay nada que guardar, se deduce.
  const followActive = useMemo<ActiveNotes>(() => {
    if (!practice.follow || !parsed || !playing) return [];
    const next: ActiveNotes = parsed.clefs.map(() => []);
    for (const note of steps[step]?.notes ?? []) for (const ref of note.refs) next[ref.staff].push(ref.index);
    return next;
  }, [practice.follow, parsed, playing, steps, step]);

  useEffect(() => {
    if (!playing || practice.follow || !parsed || !timeline.length) return;
    let raf = 0;
    const tick = () => {
      const pos = elapsed();
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
  }, [playing, practice.follow, parsed, timeline]);

  return {
    playing,
    active: practice.follow ? followActive : active,
    tempo,
    /** El de la vuelta que suena, que con el tempo progresivo va por delante. */
    currentTempo: playing && passTempo.current ? passTempo.current : tempo,
    pass,
    setTempo: (t: number) => parsed && setOverride({ of: parsed, tempo: t }),
    practice,
    setPractice,
    toggle,
    stop,
    position,
    /* Modo espera */
    steps,
    step,
    /** Lo que hay que tocar ahora mismo. */
    expected: steps[step]?.expected ?? [],
    /** Notas que ya se han tocado de este acorde. */
    holding: [...done.current],
    mistakes,
    played,
  };
}
