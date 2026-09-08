import { FLAT_ORDER, SHARP_ORDER, keyByVex } from "./keys";
import { parsePitch, type Letter, type Pitch } from "./pitch";
import type { ParsedScore, XmlEvent, XmlMeasure } from "./musicxml";
import type { ClefName } from "@/components/notation/score";

/**
 * Counterpart to `musicxml.ts` (the reader): writes MusicXML instead of
 * reading it. Also the codec for Opus Piano's compact text notation
 * ("C4/q", "(G4 B4)/h~", "r/8"), used both ways: to tell the model what's in
 * a MusicXML (`summarizeScore`) and for the model to report what it sees in
 * an image (`transcribe.ts`). One vocabulary, one place that understands it.
 */

/* ---------- Compact notation ---------- */

/** English name with scientific octave and real accidental (not the printed one): "F#4", "Bb3". */
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

/** Duration in quarter notes of a figure with dots: "h." = 3, "q.." = 1.75. */
export function beatsOfVex(vex: string): number {
  const m = /^(w|h|q|8|16|32|64)(\.{0,3})$/.exec(vex);
  if (!m) throw new Error(`Figura desconocida: «${vex}».`);
  const base = FIGURE_BEATS[m[1]];
  // each dot adds half of what the previous one added
  let total = 0;
  for (let i = 0; i <= m[2].length; i++) total += base / 2 ** i;
  return total;
}

/** One event: "C4/q", "(C4 E4 G4)/h", "r/8", "F#4/h~". Inverse of `eventCode`. */
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

// a chord has spaces inside parens, so a plain space-split won't work
const TOKEN = /\([^()]*\)\/\S+|\S+/g;

/** One staff line: "C4/q (G4 B4)/h~ r/q". "-" or empty = that measure has no notes. */
export function parseStaffCode(line: string): XmlEvent[] {
  const t = line.trim();
  if (!t || t === "-") return [];
  return (t.match(TOKEN) ?? []).map(parseEventCode);
}

/**
 * "~" only marks where a tie starts; the end is the next note on the same
 * staff, possibly in the next measure. Marked here once measures are complete.
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

/* ---------- Duration checking ---------- */

/** Quarter notes in a num/den measure. */
export const measureBeats = (time: { num: number; den: number }) => (time.num * 4) / time.den;

export interface DurationIssue {
  measure: string;
  /** 0 = top staff. */
  staff: number;
  beats: number;
}

/**
 * Measures whose figures don't add up to what the time signature asks for.
 * The check that matters when a score was read by a model — rhythm is where
 * it errs most, and one mismatched measure throws off playback from there on.
 * The pickup and last measure can legitimately be short, so they're only
 * flagged if they run over.
 */
export function checkDurations(score: ParsedScore): DurationIssue[] {
  const expected = measureBeats(score.time);
  const out: DurationIssue[] = [];
  score.measures.forEach((m, i) => {
    const edge = i === 0 || i === score.measures.length - 1;
    m.staves.forEach((events, staff) => {
      if (!events.length) return; // silent staff: nothing to check
      const total = events.reduce((sum, e) => sum + e.beats, 0);
      const off = total - expected;
      if (Math.abs(off) > 1e-6 && !(edge && off < 0)) out.push({ measure: m.number, staff, beats: total });
    });
  });
  return out;
}

/**
 * Same mismatched measures, as user-facing sentences. Used by both
 * transcription paths (vision model and OMR), so they show the same warnings.
 */
export function durationWarnings(score: ParsedScore): string[] {
  const expected = measureBeats(score.time);
  return checkDurations(score).map(
    (issue) => `Compás ${issue.measure}, pentagrama ${issue.staff + 1}: dura ${round(issue.beats)} en vez de ${round(expected)} negras`,
  );
}

const round = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/* ---------- MusicXML writing ---------- */

/** Quarter note = 48: fits dots, 64th notes and eighth-note triplets without decimals. */
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

/** Accidental the key signature imposes on each letter. */
function keyAlters(fifths: number): Partial<Record<Letter, number>> {
  const out: Partial<Record<Letter, number>> = {};
  const order = fifths > 0 ? SHARP_ORDER : FLAT_ORDER;
  for (let i = 0; i < Math.abs(fifths); i++) out[order[i]] = fifths > 0 ? 1 : -1;
  return out;
}

/**
 * The accidental to print before this note, if any: whatever doesn't match
 * what's already active in the measure (from the key signature or an earlier
 * accidental). `state` is that measure's memory for this staff.
 */
function accidentalOf(state: Map<string, number>, key: Partial<Record<Letter, number>>, p: Pitch): string | null {
  const id = `${p.letter}${p.octave}`;
  const current = state.get(id) ?? key[p.letter] ?? 0;
  if (current === p.accidental) return null;
  state.set(id, p.accidental);
  return ACCIDENTAL_OF_ALTER[p.accidental] ?? null;
}

/** The DTD fixes the order of `<note>`'s children; following it is what lets MuseScore open the file. */
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

/**
 * Repeat barlines and measure endings. An ending opens on the left barline
 * of its first measure and closes on the right barline of its last; nothing
 * repeats in between. `prev` and `next` are the neighboring measures.
 */
function barlinesXml(m: XmlMeasure, prev: XmlMeasure | undefined, next: XmlMeasure | undefined): { left: string; right: string } {
  const ending = m.ending ?? 0;
  const opens = ending > 0 && (prev?.ending ?? 0) !== ending;
  const closes = ending > 0 && (next?.ending ?? 0) !== ending;
  let left = "";
  if (m.repeatStart || opens) {
    left =
      '<barline location="left">' +
      (m.repeatStart ? "<bar-style>heavy-light</bar-style>" : "") +
      (opens ? `<ending number="${ending}" type="start"/>` : "") +
      (m.repeatStart ? '<repeat direction="forward"/>' : "") +
      "</barline>";
  }
  let right = "";
  if (m.repeatEnd || closes) {
    // the last ending (no repeat back) draws open on the right
    const type = m.repeatEnd ? "stop" : "discontinue";
    right =
      '<barline location="right">' +
      (m.repeatEnd ? "<bar-style>light-heavy</bar-style>" : "") +
      (closes ? `<ending number="${ending}" type="${type}"/>` : "") +
      (m.repeatEnd ? '<repeat direction="backward"/>' : "") +
      "</barline>";
  }
  return { left, right };
}

function measureXml(m: XmlMeasure, score: ParsedScore, fifths: number, head: string, prev?: XmlMeasure, next?: XmlMeasure): string {
  const key = keyAlters(fifths);
  const bars = barlinesXml(m, prev, next);
  const parts: string[] = [head, bars.left];
  score.clefs.forEach((_, si) => {
    const events = m.staves[si] ?? [];
    if (si > 0) {
      // back up to the start of the measure to write the left hand at the same beat
      const previous = (m.staves[si - 1] ?? []).reduce((sum, e) => sum + e.beats, 0);
      if (previous > 0) parts.push(`<backup><duration>${Math.round(previous * DIVISIONS)}</duration></backup>`);
    }
    const state = new Map<string, number>();
    for (const ev of events) parts.push(noteXml(ev, si + 1, si + 1, state, key));
  });
  parts.push(bars.right);
  return `<measure number="${esc(m.number)}">${parts.join("")}</measure>`;
}

export interface BuildOptions {
  composer?: string;
  /** Recorded in the file so its origin is known. */
  software?: string;
}

/**
 * MusicXML 4.0 partwise from an already-parsed score: a piano part with one
 * or two staves, one voice per staff. Whatever comes out of here is what
 * `parseMusicXml` reads back without losing anything.
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
  const measures = score.measures.map((m, i, all) => measureXml(m, score, key.fifths, i === 0 ? attributes + tempo : "", all[i - 1], all[i + 1]));
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
