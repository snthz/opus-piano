import { FLAT_ORDER, SHARP_ORDER, keyByVex } from "./keys";
import { parsePitch, type Letter, type Pitch } from "./pitch";
import type { ParsedScore, XmlEvent, XmlMeasure } from "./musicxml";
import type { ClefName } from "@/components/notation/score";

/**
 * Contrapartida de `musicxml.ts` (el lector): aquí se escribe MusicXML, no se
 * lee. Y con él, el códec de la notación compacta con la que Opus Piano
 * describe una partitura en texto —«C4/q», «(G4 B4)/h~», «r/8»—, que se usa en
 * las dos direcciones: para contarle al modelo lo que hay en un MusicXML
 * (`summarizeScore`) y para que el modelo devuelva lo que ve en una imagen
 * (`transcribe.ts`). Un solo vocabulario, un solo sitio donde entenderlo.
 */

/* ---------- Notación compacta ---------- */

/** Nombre anglosajón con octava científica y alteración real (no la impresa): «F#4», «Bb3». */
export function pitchCode(p: Pitch): string {
  const acc = p.accidental === 0 ? "" : p.accidental > 0 ? "#".repeat(p.accidental) : "b".repeat(-p.accidental);
  return `${p.letter}${acc}${p.octave}`;
}

export function eventCode(ev: XmlEvent): string {
  if (ev.rest || !ev.pitches.length) return `r/${ev.vex}`;
  const notes = ev.pitches.map(pitchCode);
  const body = notes.length === 1 ? notes[0] : `(${notes.join(" ")})`;
  return `${body}/${ev.vex}${ev.tieStart ? "~" : ""}`;
}

const FIGURE_BEATS: Record<string, number> = { w: 4, h: 2, q: 1, "8": 0.5, "16": 0.25, "32": 0.125, "64": 0.0625 };

/** Duración en negras de una figura con sus puntillos: «h.» = 3, «q..» = 1,75. */
export function beatsOfVex(vex: string): number {
  const m = /^(w|h|q|8|16|32|64)(\.{0,3})$/.exec(vex);
  if (!m) throw new Error(`Figura desconocida: «${vex}».`);
  const base = FIGURE_BEATS[m[1]];
  // Cada puntillo añade la mitad de lo que añadió el anterior.
  let total = 0;
  for (let i = 0; i <= m[2].length; i++) total += base / 2 ** i;
  return total;
}

/** Un evento: «C4/q», «(C4 E4 G4)/h», «r/8», «F#4/h~». Inverso de `eventCode`. */
export function parseEventCode(code: string): XmlEvent {
  const m = /^(?:\(([^()]*)\)|([^/()\s]+))\/(w|h|q|8|16|32|64)(\.{0,3})(~?)$/.exec(code.trim());
  if (!m) throw new Error(`No se entiende «${code}».`);
  const [, chord, single, figure, dots, tie] = m;
  const vex = figure + dots;
  const beats = beatsOfVex(vex);
  if (chord === undefined && /^r$/i.test(single)) {
    return { pitches: [], rest: true, beats, vex, shown: [""], tieStart: false, tieStop: false };
  }
  const names = chord !== undefined ? chord.trim().split(/\s+/).filter(Boolean) : [single];
  if (!names.length) throw new Error(`Acorde vacío en «${code}».`);
  const pitches = names.map(parsePitch);
  return { pitches, rest: false, beats, vex, shown: pitches.map(() => ""), tieStart: tie === "~", tieStop: false };
}

// Un acorde lleva espacios dentro de los paréntesis, así que no vale partir por espacios a secas.
const TOKEN = /\([^()]*\)\/\S+|\S+/g;

/** Una línea de pentagrama: «C4/q (G4 B4)/h~ r/q». «-» o vacío = ese compás no tiene notas. */
export function parseStaffCode(line: string): XmlEvent[] {
  const t = line.trim();
  if (!t || t === "-") return [];
  return (t.match(TOKEN) ?? []).map(parseEventCode);
}

/**
 * El «~» solo dice dónde empieza una ligadura de unión; el final es la nota
 * siguiente del mismo pentagrama, que puede estar en el compás de al lado. Se
 * marca aquí, con los compases ya completos.
 */
export function linkTies(measures: XmlMeasure[], staffCount: number): void {
  for (let staff = 0; staff < staffCount; staff++) {
    let open = false;
    for (const m of measures) {
      for (const ev of m.staves[staff] ?? []) {
        ev.tieStop = open && !ev.rest && !!ev.pitches.length;
        open = ev.tieStart && !ev.rest && !!ev.pitches.length;
      }
    }
  }
}

/* ---------- Comprobación de duraciones ---------- */

/** Negras que dura un compás de num/den. */
export const measureBeats = (time: { num: number; den: number }) => (time.num * 4) / time.den;

export interface DurationIssue {
  measure: string;
  /** 0 = pentagrama superior */
  staff: number;
  beats: number;
}

/**
 * Compases cuyas figuras no suman lo que pide el compás. Es la comprobación que
 * importa cuando la partitura la ha leído un modelo: el ritmo es donde más se
 * equivoca, y un compás que no cuadra descoloca la reproducción a partir de ahí.
 *
 * La anacrusa y el último compás pueden ser legítimamente cortos, así que solo
 * se señalan si se pasan.
 */
export function checkDurations(score: ParsedScore): DurationIssue[] {
  const expected = measureBeats(score.time);
  const out: DurationIssue[] = [];
  score.measures.forEach((m, i) => {
    const edge = i === 0 || i === score.measures.length - 1;
    m.staves.forEach((events, staff) => {
      if (!events.length) return; // pentagrama en silencio: no hay nada que juzgar
      const total = events.reduce((sum, e) => sum + e.beats, 0);
      const off = total - expected;
      if (Math.abs(off) > 1e-6 && !(edge && off < 0)) out.push({ measure: m.number, staff, beats: total });
    });
  });
  return out;
}

/* ---------- Escritura de MusicXML ---------- */

/** Negra = 48: entran puntillos, semifusas y tresillos de corchea sin decimales. */
const DIVISIONS = 48;

const TYPE_OF_FIGURE: Record<string, string> = {
  w: "whole", h: "half", q: "quarter", "8": "eighth", "16": "16th", "32": "32nd", "64": "64th",
};

const ACCIDENTAL_OF_ALTER: Record<number, string> = {
  2: "double-sharp", 1: "sharp", 0: "natural", "-1": "flat", "-2": "flat-flat",
};

const CLEF_SIGN: Record<ClefName, { sign: string; line: number }> = {
  treble: { sign: "G", line: 2 },
  bass: { sign: "F", line: 4 },
  alto: { sign: "C", line: 3 },
  tenor: { sign: "C", line: 4 },
  percussion: { sign: "percussion", line: 3 },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Alteración que la armadura impone a cada letra. */
function keyAlters(fifths: number): Partial<Record<Letter, number>> {
  const out: Partial<Record<Letter, number>> = {};
  const order = fifths > 0 ? SHARP_ORDER : FLAT_ORDER;
  for (let i = 0; i < Math.abs(fifths); i++) out[order[i]] = fifths > 0 ? 1 : -1;
  return out;
}

/**
 * Qué alteración hay que imprimir ante esta nota, si es que hay alguna: la que
 * no coincide con lo que ya está vigente en el compás, sea por la armadura o
 * por una alteración accidental anterior. `state` es la memoria de ese compás
 * en ese pentagrama.
 */
function accidentalOf(state: Map<string, number>, key: Partial<Record<Letter, number>>, p: Pitch): string | null {
  const id = `${p.letter}${p.octave}`;
  const current = state.get(id) ?? key[p.letter] ?? 0;
  if (current === p.accidental) return null;
  state.set(id, p.accidental);
  return ACCIDENTAL_OF_ALTER[p.accidental] ?? null;
}

/** El orden de los hijos de `<note>` lo fija el DTD; respetarlo es lo que hace que MuseScore lo abra. */
function noteXml(ev: XmlEvent, staff: number, voice: number, state: Map<string, number>, key: Partial<Record<Letter, number>>): string {
  const duration = Math.round(ev.beats * DIVISIONS);
  const figure = ev.vex.replace(/\./g, "");
  const type = `<type>${TYPE_OF_FIGURE[figure] ?? "quarter"}</type>${"<dot/>".repeat(ev.vex.length - figure.length)}`;
  const tail = `<voice>${voice}</voice>${type}`;
  if (ev.rest || !ev.pitches.length) {
    return `<note><rest/><duration>${duration}</duration>${tail}<staff>${staff}</staff></note>`;
  }
  return ev.pitches
    .map((p, i) => {
      const alter = p.accidental ? `<alter>${p.accidental}</alter>` : "";
      const pitch = `<pitch><step>${p.letter}</step>${alter}<octave>${p.octave}</octave></pitch>`;
      const ties = (ev.tieStop ? '<tie type="stop"/>' : "") + (ev.tieStart ? '<tie type="start"/>' : "");
      const tied = (ev.tieStop ? '<tied type="stop"/>' : "") + (ev.tieStart ? '<tied type="start"/>' : "");
      const acc = accidentalOf(state, key, p);
      return (
        `<note>${i ? "<chord/>" : ""}${pitch}<duration>${duration}</duration>${ties}${tail}` +
        `${acc ? `<accidental>${acc}</accidental>` : ""}<staff>${staff}</staff>` +
        `${tied ? `<notations>${tied}</notations>` : ""}</note>`
      );
    })
    .join("");
}

function measureXml(m: XmlMeasure, score: ParsedScore, fifths: number, head: string): string {
  const key = keyAlters(fifths);
  const parts: string[] = [head];
  score.clefs.forEach((_, si) => {
    const events = m.staves[si] ?? [];
    if (si > 0) {
      // Volver al principio del compás para escribir la mano izquierda encima del mismo tiempo.
      const previous = (m.staves[si - 1] ?? []).reduce((sum, e) => sum + e.beats, 0);
      if (previous > 0) parts.push(`<backup><duration>${Math.round(previous * DIVISIONS)}</duration></backup>`);
    }
    const state = new Map<string, number>();
    for (const ev of events) parts.push(noteXml(ev, si + 1, si + 1, state, key));
  });
  return `<measure number="${esc(m.number)}">${parts.join("")}</measure>`;
}

export interface BuildOptions {
  composer?: string;
  /** Se anota en el archivo para que se sepa de dónde salió */
  software?: string;
}

/**
 * MusicXML 4.0 partwise a partir de una partitura ya leída: una parte de piano
 * con uno o dos pentagramas, una voz por pentagrama. Es lo que Opus Piano sabe
 * dibujar y tocar, así que lo que sale de aquí lo vuelve a leer `parseMusicXml`
 * sin perder nada.
 */
export function buildMusicXml(score: ParsedScore, options: BuildOptions = {}): string {
  const key = keyByVex(score.keyVex);
  const clefs = score.clefs
    .map((c, i) => {
      const { sign, line } = CLEF_SIGN[c];
      return `<clef number="${i + 1}"><sign>${sign}</sign><line>${line}</line></clef>`;
    })
    .join("");
  const attributes =
    `<attributes><divisions>${DIVISIONS}</divisions>` +
    `<key><fifths>${key.fifths}</fifths><mode>${key.mode === "menor" ? "minor" : "major"}</mode></key>` +
    `<time><beats>${score.time.num}</beats><beat-type>${score.time.den}</beat-type></time>` +
    `<staves>${score.clefs.length}</staves>${clefs}</attributes>`;
  const tempo = score.tempo
    ? `<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${score.tempo}</per-minute></metronome></direction-type><sound tempo="${score.tempo}"/></direction>`
    : "";
  const measures = score.measures.map((m, i) => measureXml(m, score, key.fifths, i === 0 ? attributes + tempo : ""));
  const composer = options.composer?.trim() ? `<creator type="composer">${esc(options.composer.trim())}</creator>` : "";

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    `<work><work-title>${esc(score.title)}</work-title></work>`,
    `<identification>${composer}<encoding><software>${esc(options.software ?? "Opus Piano")}</software><encoding-date>${new Date().toISOString().slice(0, 10)}</encoding-date></encoding></identification>`,
    '<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>',
    `<part id="P1">${measures.join("")}</part>`,
    "</score-partwise>",
  ].join("\n");
}
