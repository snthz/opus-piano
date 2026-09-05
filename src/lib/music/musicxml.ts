import { unzipSync, strFromU8 } from "fflate";
import { keysWithFifths } from "./keys";
import { toMidi, noteName, type Letter, type NamingSystem, type Pitch } from "./pitch";
import type { ClefName } from "@/components/notation/score";

/**
 * Lector de MusicXML (partwise) reducido a lo que Opus Piano sabe dibujar y tocar:
 * dos pentagramas como máximo, una voz por pentagrama, acordes, silencios,
 * puntillos y ligaduras. Suficiente para lo que exporta MuseScore de una pieza
 * de piano; adornos, voces secundarias y notas de adorno se omiten.
 */

export interface XmlEvent {
  /** Vacío si es silencio */
  pitches: Pitch[];
  rest: boolean;
  /** Duración real en negras (ya con puntillos o tresillos) */
  beats: number;
  /** Figura notada: "q", "8", "h."… */
  vex: string;
  /** Alteraciones que van impresas, por nota: "#", "b", "n", "" */
  shown: string[];
  tieStart: boolean;
  tieStop: boolean;
}

export interface XmlMeasure {
  number: string;
  staves: XmlEvent[][];
}

export interface ParsedScore {
  title: string;
  /** Armadura en notación VexFlow ("G", "Bbm"…) */
  keyVex: string;
  time: { num: number; den: number };
  /** Negras por minuto; 0 si la partitura no lo indica */
  tempo: number;
  clefs: ClefName[];
  measures: XmlMeasure[];
}

const TYPE_TO_VEX: Record<string, string> = {
  breve: "w",
  whole: "w",
  half: "h",
  quarter: "q",
  eighth: "8",
  "16th": "16",
  "32nd": "32",
  "64th": "64",
};

const ACCIDENTAL_TO_VEX: Record<string, string> = {
  sharp: "#",
  flat: "b",
  natural: "n",
  "double-sharp": "##",
  "flat-flat": "bb",
};

function text(el: ParentNode | null | undefined, sel: string): string | undefined {
  return el?.querySelector(sel)?.textContent?.trim() || undefined;
}

/** .mxl es un zip con un container.xml que señala el archivo principal. */
export function unpackMxl(data: Uint8Array): string {
  const files = unzipSync(data);
  const container = files["META-INF/container.xml"];
  let root: string | undefined;
  if (container) {
    const doc = new DOMParser().parseFromString(strFromU8(container), "application/xml");
    root = doc.querySelector("rootfile")?.getAttribute("full-path") ?? undefined;
  }
  if (!root || !files[root]) {
    root = Object.keys(files).find((f) => !f.startsWith("META-INF/") && /\.(musicxml|xml)$/i.test(f));
  }
  if (!root) throw new Error("El archivo .mxl no contiene ninguna partitura MusicXML.");
  return strFromU8(files[root]);
}

/** Figura VexFlow a partir de la duración en negras, cuando el archivo no indica el tipo. */
function vexFromBeats(beats: number): string {
  const table: [number, string][] = [
    [4, "w"], [3, "h."], [2, "h"], [1.5, "q."], [1, "q"], [0.75, "8."], [0.5, "8"], [0.375, "16."], [0.25, "16"], [0.125, "32"],
  ];
  for (const [b, v] of table) if (beats >= b - 1e-6) return v;
  return "64";
}

export function parseMusicXml(xml: string): ParsedScore {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("El archivo no es un MusicXML válido.");
  if (doc.querySelector("score-timewise")) throw new Error("Solo se admite MusicXML en formato partwise.");
  const parts = [...doc.querySelectorAll("score-partwise > part")];
  if (!parts.length) throw new Error("La partitura no tiene ninguna parte.");

  const title =
    text(doc, "work > work-title") ?? text(doc, "movement-title") ?? text(doc, "credit > credit-words") ?? "";

  // Piano: una parte con dos pentagramas. Si cada mano viene como parte
  // independiente, se toman las dos primeras.
  const firstStaves = Number(text(parts[0], "attributes > staves") ?? "1");
  const sources: { part: Element; staff: number }[] =
    firstStaves >= 2
      ? [{ part: parts[0], staff: 1 }, { part: parts[0], staff: 2 }]
      : parts.slice(0, 2).map((part) => ({ part, staff: 1 }));

  const clefs: ClefName[] = sources.map((_, i) => (i === 0 ? "treble" : "bass"));
  let keyVex = "C";
  let time = { num: 4, den: 4 };
  let tempo = 0;

  // Estado de lectura por parte: divisiones y voz principal de cada pentagrama.
  const measureCount = Math.max(...sources.map((s) => s.part.querySelectorAll(":scope > measure").length));
  const measures: XmlMeasure[] = [];
  const divisionsByPart = new Map<Element, number>();
  const voiceByStaff = new Map<string, string>();

  for (let mi = 0; mi < measureCount; mi++) {
    const staves: XmlEvent[][] = [];
    let number = String(mi + 1);

    sources.forEach(({ part, staff }, si) => {
      const measure = part.querySelectorAll(":scope > measure")[mi];
      const events: XmlEvent[] = [];
      if (!measure) {
        staves.push(events);
        return;
      }
      number = measure.getAttribute("number") ?? number;

      for (const child of [...measure.children]) {
        if (child.tagName === "attributes") {
          const div = text(child, "divisions");
          if (div) divisionsByPart.set(part, Number(div));
          const fifths = text(child, "key > fifths");
          if (fifths !== undefined && si === 0) {
            const k = keysWithFifths(Number(fifths));
            keyVex = text(child, "key > mode") === "minor" ? k.minor.vex : k.major.vex;
          }
          const beats = text(child, "time > beats");
          const beatType = text(child, "time > beat-type");
          if (beats && beatType && si === 0) time = { num: Number(beats), den: Number(beatType) };
          for (const clef of child.querySelectorAll("clef")) {
            const n = Number(clef.getAttribute("number") ?? "1");
            if (n !== staff) continue;
            const sign = text(clef, "sign");
            clefs[si] = sign === "F" ? "bass" : sign === "C" ? "alto" : "treble";
          }
        } else if (child.tagName === "direction" || child.tagName === "sound") {
          const t = child.tagName === "sound" ? child.getAttribute("tempo") : child.querySelector("sound")?.getAttribute("tempo");
          if (t && !tempo) tempo = Math.round(Number(t));
        } else if (child.tagName === "note") {
          if (child.querySelector("grace") || child.querySelector("cue")) continue;
          const noteStaff = Number(text(child, "staff") ?? "1");
          if (noteStaff !== staff) continue;
          // Solo la primera voz que aparece en cada pentagrama.
          const voice = text(child, "voice") ?? "1";
          const key = `${si}`;
          if (!voiceByStaff.has(key)) voiceByStaff.set(key, voice);
          if (voiceByStaff.get(key) !== voice) continue;

          const divisions = divisionsByPart.get(part) ?? 1;
          const beats = Number(text(child, "duration") ?? "0") / divisions;
          const rest = !!child.querySelector("rest");
          const dots = child.querySelectorAll("dot").length;
          const type = text(child, "type");
          const vex = type && TYPE_TO_VEX[type] ? TYPE_TO_VEX[type] + ".".repeat(dots) : vexFromBeats(beats);
          const tieStart = !!child.querySelector('tie[type="start"], tied[type="start"]');
          const tieStop = !!child.querySelector('tie[type="stop"], tied[type="stop"]');

          let pitch: Pitch | undefined;
          if (!rest) {
            const step = text(child, "pitch > step") as Letter | undefined;
            const octave = Number(text(child, "pitch > octave") ?? "4");
            const alter = Number(text(child, "pitch > alter") ?? "0");
            if (step) pitch = { letter: step, accidental: alter, octave };
          }
          const acc = text(child, "accidental");
          const shown = acc ? (ACCIDENTAL_TO_VEX[acc] ?? "") : "";

          const isChord = !!child.querySelector("chord");
          const prev = events[events.length - 1];
          if (isChord && prev && pitch) {
            prev.pitches.push(pitch);
            prev.shown.push(shown);
            prev.tieStart ||= tieStart;
            prev.tieStop ||= tieStop;
          } else {
            events.push({ pitches: pitch ? [pitch] : [], rest, beats, vex, shown: [shown], tieStart, tieStop });
          }
        }
      }
      staves.push(events);
    });

    measures.push({ number, staves });
  }

  return { title, keyVex, time, tempo, clefs, measures };
}

/* ---------- De la partitura leída a lo que dibuja y suena Opus Piano ---------- */

/** Texto EasyScore de un evento; el silencio se coloca en el centro del pentagrama. */
export function eventToEasyScore(ev: XmlEvent, clef: ClefName): string {
  if (ev.rest || !ev.pitches.length) {
    const pos = clef === "bass" ? "D3" : clef === "alto" ? "C4" : "B4";
    return `${pos}/${ev.vex}/r`;
  }
  const keys = ev.pitches.map((p, i) => `${p.letter}${ev.shown[i] ?? ""}${p.octave}`);
  return keys.length === 1 ? `${keys[0]}/${ev.vex}` : `(${keys.join(" ")})/${ev.vex}`;
}

export function measureToEasyScore(events: XmlEvent[], clef: ClefName): string {
  return events.map((e) => eventToEasyScore(e, clef)).join(", ");
}

/** Etiqueta con los nombres de las notas (los acordes, de grave a agudo). */
export function eventLabel(ev: XmlEvent, system: NamingSystem): string {
  if (ev.rest || !ev.pitches.length) return "";
  return [...ev.pitches]
    .sort((a, b) => toMidi(a) - toMidi(b))
    .map((p) => noteName(p, system))
    .join(" ");
}

export interface ScoreTimelineNote {
  midis: number[];
  start: number;
  beats: number;
  /** Pentagrama y posición (entre todas las notas de ese pentagrama) de cada nota visual que suena */
  refs: { staff: number; index: number }[];
}

/**
 * Línea de tiempo para tocar la pieza: las notas ligadas se funden en una sola
 * para que no vuelvan a atacarse, pero recuerdan qué notas visuales cubren.
 */
export function buildTimeline(score: ParsedScore): ScoreTimelineNote[] {
  const out: ScoreTimelineNote[] = [];
  score.clefs.forEach((_, staff) => {
    let t = 0;
    let index = 0;
    let open: ScoreTimelineNote | null = null;
    for (const m of score.measures) {
      for (const ev of m.staves[staff] ?? []) {
        if (!ev.rest && ev.pitches.length) {
          const midis = ev.pitches.map(toMidi);
          const sameAsOpen = open && ev.tieStop && open.midis.length === midis.length && open.midis.every((x, i) => x === midis[i]);
          if (sameAsOpen && open) {
            open.beats += ev.beats;
            open.refs.push({ staff, index });
          } else {
            open = { midis, start: t, beats: ev.beats, refs: [{ staff, index }] };
            out.push(open);
          }
          if (!ev.tieStart) open = null;
        } else {
          open = null;
        }
        t += ev.beats;
        index++;
      }
    }
  });
  return out.sort((a, b) => a.start - b.start);
}
