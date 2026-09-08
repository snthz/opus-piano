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
  /** Barra de repetición que abre al principio del compás («|:») */
  repeatStart?: boolean;
  /** Barra de repetición que cierra al final del compás («:|») */
  repeatEnd?: boolean;
  /** Casilla de repetición en la que está el compás: 1 para «1.», 2 para «2.»… 0 o ausente si ninguna */
  ending?: number;
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
  // Casilla abierta: dura hasta la barra que la cierra, aunque abarque varios compases.
  let openEnding = 0;

  for (let mi = 0; mi < measureCount; mi++) {
    const staves: XmlEvent[][] = [];
    let number = String(mi + 1);
    let repeatStart = false;
    let repeatEnd = false;
    let ending = openEnding;

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
        } else if (child.tagName === "barline" && si === 0) {
          // Repeticiones y casillas: solo las lee el primer pentagrama, son de todo el compás.
          const direction = child.querySelector("repeat")?.getAttribute("direction");
          if (direction === "forward") repeatStart = true;
          if (direction === "backward") repeatEnd = true;
          const volta = child.querySelector("ending");
          if (volta) {
            const n = parseInt(volta.getAttribute("number") ?? "", 10);
            const type = volta.getAttribute("type");
            if (type === "start" && n > 0) {
              ending = n;
              openEnding = n;
            } else if (type === "stop" || type === "discontinue") {
              if (!ending && n > 0) ending = n;
              openEnding = 0;
            }
          }
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

    const m: XmlMeasure = { number, staves };
    if (repeatStart) m.repeatStart = true;
    if (repeatEnd) m.repeatEnd = true;
    if (ending) m.ending = ending;
    measures.push(m);
  }

  return { title, keyVex, time, tempo, clefs, measures };
}

/* ---------- Repeticiones ---------- */

/**
 * Orden en que se tocan los compases (índices en `measures`) una vez
 * desplegadas las repeticiones y las casillas. Sin repeticiones es la
 * identidad. Cada barra de cierre devuelve una sola vez al principio de su
 * sección (la última barra de apertura, o el inicio de la pieza si no la hay);
 * en la pasada n solo suenan los compases de la casilla n, y los que no están
 * en ninguna casilla suenan siempre.
 *
 * Con casillas «1.» y «2.» el resultado es A + 1.ª + A + 2.ª, que es lo que
 * quiere decir la partitura. Una casilla que no puede alcanzarse (su pasada
 * nunca llega porque no hay barra de cierre) se toca de corrido para no
 * perder música.
 */
export function expandRepeats(measures: Pick<XmlMeasure, "repeatStart" | "repeatEnd" | "ending">[]): number[] {
  const order: number[] = [];
  let start = 0;
  let pass = 1;
  const jumped = new Set<number>();
  const opened = new Set<number>();

  const reachable = (from: number, wanted: number) => {
    // ¿Hay una barra de cierre por delante, en esta misma sección, que nos traiga de vuelta hasta la pasada `wanted`?
    let passes = pass;
    for (let k = from; k < measures.length; k++) {
      if (k !== from && measures[k].repeatStart) return false;
      if (measures[k].repeatEnd && !jumped.has(k) && (!measures[k].ending || measures[k].ending === passes)) {
        passes++;
        if (passes >= wanted) return true;
      }
    }
    return false;
  };

  let i = 0;
  while (i < measures.length) {
    const m = measures[i];
    if (m.repeatStart && !opened.has(i)) {
      opened.add(i);
      start = i;
      pass = 1;
    }
    if (m.ending && m.ending !== pass && (m.ending < pass || reachable(i, m.ending))) {
      i++;
      continue;
    }
    order.push(i);
    if (m.repeatEnd && !jumped.has(i)) {
      jumped.add(i);
      pass++;
      i = start;
      continue;
    }
    if (m.repeatEnd) {
      // Sección terminada: lo que sigue empieza de cero.
      start = i + 1;
      pass = 1;
    }
    i++;
  }
  return order;
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
  const order = expandRepeats(score.measures);
  score.clefs.forEach((_, staff) => {
    // Índice global de la primera nota de cada compás impreso.
    const offsets: number[] = [];
    let n = 0;
    for (const m of score.measures) {
      offsets.push(n);
      n += (m.staves[staff] ?? []).length;
    }
    let t = 0;
    let open: ScoreTimelineNote | null = null;
    order.forEach((mi, step) => {
      // Al saltar atrás (o adelante) una ligadura abierta no continúa.
      if (step > 0 && order[step - 1] !== mi - 1) open = null;
      let index = offsets[mi];
      for (const ev of score.measures[mi].staves[staff] ?? []) {
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
    });
  });
  return out.sort((a, b) => a.start - b.start);
}
