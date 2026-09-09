import { unzipSync, strFromU8 } from "fflate";
import { easyScorePiece } from "./easyscore";
import { keysWithFifths } from "./keys";
import { toMidi, noteName, type Letter, type NamingSystem, type Pitch } from "./pitch";
import { heldFromBefore, heldIntoNext, mergeVoices, vexFromBeats, type RawNote, type Tuplet } from "./voices";
import type { ClefName } from "@/components/notation/score";

/**
 * MusicXML (partwise) reader, reduced to what Opus Piano can draw and play:
 * at most two staves, chords, rests, dots, ties and tuplets. Several voices
 * on a staff are folded into one line (see `voices.ts`); grace notes and
 * ornaments are dropped.
 */

export interface XmlEvent {
  /** Empty if it's a rest. */
  pitches: Pitch[];
  rest: boolean;
  /** Real duration in quarter notes (dots/triplets already applied). */
  beats: number;
  /** Notated figure: "q", "8", "h."… */
  vex: string;
  /** Printed accidental per note: "#", "b", "n", "". */
  shown: string[];
  /** Some pitch is held into the next event / over from the previous one. */
  tieStart: boolean;
  tieStop: boolean;
  /**
   * The same, per pitch, when the event came from several voices and only
   * part of the chord is held (a bass note under changing chords). Absent
   * when the chord-level flags tell the whole story.
   */
  tieStartAt?: boolean[];
  tieStopAt?: boolean[];
  /** Written as part of a tuplet: 3 in the time of 2, and so on. */
  tuplet?: Tuplet;
}

export interface XmlMeasure {
  number: string;
  staves: XmlEvent[][];
  /** Repeat barline opening at the start of the measure ("|:"). */
  repeatStart?: boolean;
  /** Repeat barline closing at the end of the measure (":|"). */
  repeatEnd?: boolean;
  /** Ending this measure is in: 1 for "1.", 2 for "2."… 0 or absent for none. */
  ending?: number;
}

export interface ParsedScore {
  title: string;
  /** Key signature in VexFlow notation ("G", "Bbm"…). */
  keyVex: string;
  time: { num: number; den: number };
  /** Quarter notes per minute; 0 if the score doesn't say. */
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

/** .mxl is a zip with a container.xml that points to the main file. */
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

export function parseMusicXml(xml: string): ParsedScore {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("El archivo no es un MusicXML válido.");
  if (doc.querySelector("score-timewise")) throw new Error("Solo se admite MusicXML en formato partwise.");
  const parts = [...doc.querySelectorAll("score-partwise > part")];
  if (!parts.length) throw new Error("La partitura no tiene ninguna parte.");

  const title =
    text(doc, "work > work-title") ?? text(doc, "movement-title") ?? text(doc, "credit > credit-words") ?? "";

  // piano: one part with two staves; if each hand is its own part, take the first two
  const firstStaves = Number(text(parts[0], "attributes > staves") ?? "1");
  const sources: { part: Element; staff: number }[] =
    firstStaves >= 2
      ? [{ part: parts[0], staff: 1 }, { part: parts[0], staff: 2 }]
      : parts.slice(0, 2).map((part) => ({ part, staff: 1 }));
  const usedParts = [...new Set(sources.map((s) => s.part))];
  const staffIndex = (part: Element, staff: number) => sources.findIndex((s) => s.part === part && s.staff === staff);

  const clefs: ClefName[] = sources.map((_, i) => (i === 0 ? "treble" : "bass"));
  // Opus Piano draws one clef per staff for the whole piece, so a staff that
  // changes clef (a left hand that climbs into the treble for a page) is drawn
  // in the clef it spends most measures in, not the one it happens to end in.
  const clefUse: Map<ClefName, number>[] = sources.map(() => new Map());
  const currentClef: ClefName[] = [...clefs];
  const clefGiven = sources.map(() => false);
  let keyVex = "C";
  let fifths = 0;
  let modeGiven = false;
  let time = { num: 4, den: 4 };
  let tempo = 0;

  const measureCount = Math.max(...usedParts.map((p) => p.querySelectorAll(":scope > measure").length));
  const measures: XmlMeasure[] = [];
  const divisionsByPart = new Map<Element, number>();
  // open ending: lasts until its closing barline, even across several measures
  let openEnding = 0;

  for (let mi = 0; mi < measureCount; mi++) {
    const raw: RawNote[][] = sources.map(() => []);
    let number = String(mi + 1);
    let repeatStart = false;
    let repeatEnd = false;
    let ending = openEnding;

    usedParts.forEach((part, pi) => {
      const measure = part.querySelectorAll(":scope > measure")[mi];
      if (!measure) return;
      if (pi === 0) number = measure.getAttribute("number") ?? number;

      // the part's clock inside the measure, in divisions: notes advance it,
      // <backup> rewinds it for the next voice or staff, <forward> skips ahead
      let cursor = 0;
      let lastOnset = 0;

      for (const child of [...measure.children]) {
        if (child.tagName === "attributes") {
          const div = text(child, "divisions");
          if (div) divisionsByPart.set(part, Number(div));
          const f = text(child, "key > fifths");
          if (f !== undefined && pi === 0) {
            fifths = Number(f);
            const mode = text(child, "key > mode");
            modeGiven ||= mode === "major" || mode === "minor";
            keyVex = mode === "minor" ? keysWithFifths(fifths).minor.vex : keysWithFifths(fifths).major.vex;
          }
          const beats = text(child, "time > beats");
          const beatType = text(child, "time > beat-type");
          if (beats && beatType && pi === 0) time = { num: Number(beats), den: Number(beatType) };
          for (const clef of child.querySelectorAll("clef")) {
            const si = staffIndex(part, Number(clef.getAttribute("number") ?? "1"));
            if (si < 0) continue;
            const sign = text(clef, "sign");
            currentClef[si] = sign === "F" ? "bass" : sign === "C" ? "alto" : "treble";
            clefGiven[si] = true;
          }
        } else if (child.tagName === "direction" || child.tagName === "sound") {
          const t = child.tagName === "sound" ? child.getAttribute("tempo") : child.querySelector("sound")?.getAttribute("tempo");
          if (t && !tempo) tempo = Math.round(Number(t));
        } else if (child.tagName === "barline" && pi === 0) {
          // repeats and endings apply to the whole measure; the first part reads them
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
        } else if (child.tagName === "backup") {
          cursor -= Number(text(child, "duration") ?? "0");
        } else if (child.tagName === "forward") {
          cursor += Number(text(child, "duration") ?? "0");
        } else if (child.tagName === "note") {
          // grace notes take no time and cue notes aren't played: both are left out
          if (child.querySelector("grace") || child.querySelector("cue")) continue;
          const duration = Number(text(child, "duration") ?? "0");
          const isChord = !!child.querySelector("chord");
          const onset = isChord ? lastOnset : cursor;
          if (!isChord) {
            lastOnset = cursor;
            cursor += duration;
          }
          const si = staffIndex(part, Number(text(child, "staff") ?? "1"));
          if (si < 0) continue;

          const divisions = divisionsByPart.get(part) ?? 1;
          const rest = !!child.querySelector("rest");
          const dots = child.querySelectorAll("dot").length;
          const type = text(child, "type");
          const vex = type && TYPE_TO_VEX[type] ? TYPE_TO_VEX[type] + ".".repeat(dots) : vexFromBeats(duration / divisions);
          const actual = Number(text(child, "time-modification > actual-notes") ?? "0");
          const normal = Number(text(child, "time-modification > normal-notes") ?? "0");

          let pitch: Pitch | null = null;
          if (!rest) {
            const step = text(child, "pitch > step") as Letter | undefined;
            const octave = Number(text(child, "pitch > octave") ?? "4");
            const alter = Number(text(child, "pitch > alter") ?? "0");
            if (step) pitch = { letter: step, accidental: alter, octave };
          }
          const acc = text(child, "accidental");

          raw[si].push({
            onset,
            duration,
            pitch,
            vex,
            shown: acc ? (ACCIDENTAL_TO_VEX[acc] ?? "") : "",
            tieStart: !!child.querySelector('tie[type="start"], tied[type="start"]'),
            tieStop: !!child.querySelector('tie[type="stop"], tied[type="stop"]'),
            tuplet: actual > 1 && normal > 0 ? { actual, normal } : undefined,
          });
        }
      }
    });

    currentClef.forEach((clef, si) => clefUse[si].set(clef, (clefUse[si].get(clef) ?? 0) + 1));

    const staves = sources.map(({ part }, si) => mergeVoices(raw[si], divisionsByPart.get(part) ?? 1));
    const m: XmlMeasure = { number, staves };
    if (repeatStart) m.repeatStart = true;
    if (repeatEnd) m.repeatEnd = true;
    if (ending) m.ending = ending;
    measures.push(m);
  }

  clefUse.forEach((use, si) => {
    if (!clefGiven[si]) return;
    const [best, count] = [...use.entries()].sort((a, b) => b[1] - a[1])[0];
    // the usual piano clefs win a close call: a right hand that dips into the
    // bass for half the piece still reads better in the treble
    if (count > (use.get(clefs[si]) ?? 0) * 1.25) clefs[si] = best;
  });

  // MuseScore often exports a key signature without its mode, and "no sharps"
  // then reads as C major even for a piece in A minor. The last bass note is a
  // fair witness: if the piece ends on the relative minor's tonic, it's minor.
  if (!modeGiven && endsOnMinorTonic(measures, fifths)) keyVex = keysWithFifths(fifths).minor.vex;

  return { title, keyVex, time, tempo, clefs, measures };
}

/**
 * Whether the bass of the piece's final measure is the tonic of the relative
 * minor (see `parseMusicXml`). The lowest note of the whole last measure, not
 * just its last event: a final chord is often arpeggiated (la–mi–do), and the
 * root comes first.
 */
export function endsOnMinorTonic(measures: XmlMeasure[], fifths: number): boolean {
  const minor = keysWithFifths(fifths).minor;
  const tonic = toMidi({ letter: minor.tonic, accidental: minor.tonicAccidental, octave: 0 }) % 12;
  for (let mi = measures.length - 1; mi >= 0; mi--) {
    // the lowest staff first, so the bass decides when both hands play
    for (const events of [...measures[mi].staves].reverse()) {
      const midis = events.flatMap((e) => (e.rest ? [] : e.pitches.map(toMidi)));
      if (midis.length) return Math.min(...midis) % 12 === tonic;
    }
  }
  return false;
}

/* ---------- Repeats ---------- */

/**
 * Order in which measures are played (indices into `measures`) once repeats
 * and endings are expanded. Identity if there are no repeats. Each closing
 * barline jumps back once to the start of its section (the last opening
 * barline, or the piece's start if there's none); on pass n only measures in
 * ending n play, and measures in no ending always play.
 *
 * With a "1." and "2." ending the result is A + 1st + A + 2nd, as the score
 * intends. An unreachable ending (its pass never arrives because there's no
 * closing barline) plays straight through so no music is lost.
 */
export function expandRepeats(measures: Pick<XmlMeasure, "repeatStart" | "repeatEnd" | "ending">[]): number[] {
  const order: number[] = [];
  let start = 0;
  let pass = 1;
  const jumped = new Set<number>();
  const opened = new Set<number>();

  const reachable = (from: number, wanted: number) => {
    // is there a closing barline ahead, in this same section, that brings us back to pass `wanted`?
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
      // section done: what follows starts fresh
      start = i + 1;
      pass = 1;
    }
    i++;
  }
  return order;
}

/* ---------- From the parsed score to what Opus Piano draws and plays ---------- */

/** EasyScore text for an event; a rest is placed at the staff's center. */
export function eventToEasyScore(ev: XmlEvent, clef: ClefName): string {
  if (ev.rest || !ev.pitches.length) {
    const pos = clef === "bass" ? "D3" : clef === "alto" ? "C4" : "B4";
    return easyScorePiece(pos, ev.vex, true);
  }
  const keys = ev.pitches.map((p, i) => `${p.letter}${ev.shown[i] ?? ""}${p.octave}`);
  return easyScorePiece(keys.length === 1 ? keys[0] : `(${keys.join(" ")})`, ev.vex);
}

export function measureToEasyScore(events: XmlEvent[], clef: ClefName): string {
  return events.map((e) => eventToEasyScore(e, clef)).join(", ");
}

/** Label with note names (chords low to high). */
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
  /** Staff and position (among that staff's notes) of each visual note it covers. */
  refs: { staff: number; index: number }[];
}

const beatsOf = (events: XmlEvent[]) => events.reduce((sum, e) => sum + e.beats, 0);

/**
 * Timeline for playing the piece: tied notes merge into one so they don't
 * re-attack, but remember which visual notes they cover. Ties are followed
 * pitch by pitch, so a bass held under changing chords sounds once.
 *
 * Every printed measure starts at the same time on all staves, and the clock
 * resets on each barline. That's what the score says, and it also stops a
 * misread measure — from an automatic transcription, say — from throwing off
 * the whole piece: if the left hand is missing a beat in measure 3, it shows
 * up in measure 3 only, not compounding into everything after. A measure's
 * length is its longest staff's, so a pickup or short final measure still counts.
 */
export function buildTimeline(score: ParsedScore): ScoreTimelineNote[] {
  const out: ScoreTimelineNote[] = [];
  const order = expandRepeats(score.measures);

  const nominal = (score.time.num * 4) / score.time.den;
  const lengths = score.measures.map((m) => {
    const longest = m.staves.reduce((max, events) => Math.max(max, beatsOf(events)), 0);
    return longest > 0 ? longest : nominal;
  });
  const starts: number[] = [];
  let clock = 0;
  for (const mi of order) {
    starts.push(clock);
    clock += lengths[mi];
  }

  score.clefs.forEach((_, staff) => {
    // global index of the first note of each printed measure
    const offsets: number[] = [];
    let n = 0;
    for (const m of score.measures) {
      offsets.push(n);
      n += (m.staves[staff] ?? []).length;
    }
    // notes still sounding, by pitch, that the next event may hold on to
    let open = new Map<number, ScoreTimelineNote>();
    order.forEach((mi, step) => {
      // jumping back (or ahead) breaks any open tie
      if (step > 0 && order[step - 1] !== mi - 1) open = new Map();
      let t = starts[step];
      let index = offsets[mi];
      for (const ev of score.measures[mi].staves[staff] ?? []) {
        if (!ev.rest && ev.pitches.length) {
          const next = new Map<number, ScoreTimelineNote>();
          ev.pitches.forEach((p, i) => {
            const midi = toMidi(p);
            const held = heldFromBefore(ev, i) ? open.get(midi) : undefined;
            let note: ScoreTimelineNote;
            if (held) {
              held.beats = t + ev.beats - held.start;
              held.refs.push({ staff, index });
              note = held;
            } else {
              note = { midis: [midi], start: t, beats: ev.beats, refs: [{ staff, index }] };
              out.push(note);
            }
            if (heldIntoNext(ev, i)) next.set(midi, note);
          });
          open = next;
        } else {
          open = new Map();
        }
        t += ev.beats;
        index++;
      }
    });
  });
  return out.sort((a, b) => a.start - b.start);
}
