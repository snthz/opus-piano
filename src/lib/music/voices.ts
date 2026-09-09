import { toMidi, type Pitch } from "./pitch";
import type { XmlEvent } from "./musicxml";

/**
 * Several voices on one staff, folded into one line.
 *
 * A real piano score writes a held bass note in one voice and the chords
 * above it in another, or a melody over its own accompaniment on the same
 * staff. Opus Piano draws and plays one line per staff, so the voices are
 * cut at every onset and every release into slices where the set of sounding
 * notes doesn't change: a bass dotted half under two quarter chords becomes
 * three quarter slices, with the bass tied through. Playback is exact — a
 * tied note doesn't re-attack — and the drawing is honest about what
 * sounds when, even if it isn't engraved the way the original was.
 *
 * Everything here is in the part's own divisions (integers), so voices line
 * up exactly; beats are only computed at the end.
 */

export interface Tuplet {
  /** Notes written in the time of `normal`: 3 in the time of 2 for a triplet. */
  actual: number;
  normal: number;
}

export interface RawNote {
  onset: number;
  duration: number;
  /** null = rest. */
  pitch: Pitch | null;
  vex: string;
  shown: string;
  tieStart: boolean;
  tieStop: boolean;
  tuplet?: Tuplet;
}

/** VexFlow figure from the duration in quarter notes, when the file doesn't state the type. */
export function vexFromBeats(beats: number): string {
  const table: [number, string][] = [
    [4, "w"], [3, "h."], [2, "h"], [1.5, "q."], [1, "q"], [0.75, "8."], [0.5, "8"], [0.375, "16."], [0.25, "16"], [0.125, "32"],
  ];
  for (const [b, v] of table) if (beats >= b - 1e-6) return v;
  return "64";
}

export function mergeVoices(notes: RawNote[], divisions: number): XmlEvent[] {
  const live = notes.filter((n) => n.duration > 0);
  if (!live.length) return [];

  const edges = new Set<number>();
  for (const n of live) {
    edges.add(n.onset);
    edges.add(n.onset + n.duration);
  }
  const bounds = [...edges].sort((a, b) => a - b);
  const out: XmlEvent[] = [];

  for (let i = 0; i + 1 < bounds.length; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    const beats = (b - a) / divisions;
    // every edge is an onset or a release, so a note either covers the slice whole or not at all
    const covering = live.filter((n) => n.onset <= a && n.onset + n.duration >= b);
    const sounding = covering.filter((n) => n.pitch);

    if (!sounding.length) {
      // silence: a written rest, or a gap nobody wrote (a voice that just stops, a <forward>)
      const exact = covering.find((n) => n.onset === a && n.onset + n.duration === b);
      out.push({ pitches: [], rest: true, beats, vex: exact?.vex ?? vexFromBeats(beats), shown: [""], tieStart: false, tieStop: false, tuplet: exact?.tuplet });
      continue;
    }

    // one entry per pitch, low to high; a unison in two voices is one note
    const byMidi = new Map<number, RawNote[]>();
    for (const n of sounding) {
      const midi = toMidi(n.pitch as Pitch);
      byMidi.set(midi, [...(byMidi.get(midi) ?? []), n]);
    }
    const groups = [...byMidi.entries()].sort((x, y) => x[0] - y[0]).map(([, g]) => g);
    const tieStopAt = groups.map((g) => g.some((n) => n.onset < a || (n.tieStop && n.onset === a)));
    const tieStartAt = groups.map((g) => g.some((n) => n.onset + n.duration > b || (n.tieStart && n.onset + n.duration === b)));
    // the slice is a written note (not a cut) when every note in it starts and ends with it
    const exact = sounding.every((n) => n.onset === a && n.onset + n.duration === b);

    out.push({
      pitches: groups.map((g) => g[0].pitch as Pitch),
      rest: false,
      beats,
      vex: exact ? sounding[0].vex : vexFromBeats(beats),
      shown: groups.map((g) => g[0].shown),
      tieStart: tieStartAt.some(Boolean),
      tieStop: tieStopAt.some(Boolean),
      tieStartAt,
      tieStopAt,
      tuplet: exact ? sounding[0].tuplet : undefined,
    });
  }
  return out;
}

/** Whether pitch `i` of `ev` is held over from the previous event (falls back to the chord-level flag). */
export const heldFromBefore = (ev: XmlEvent, i: number): boolean => ev.tieStopAt?.[i] ?? ev.tieStop;
/** Whether pitch `i` of `ev` keeps sounding into the next event. */
export const heldIntoNext = (ev: XmlEvent, i: number): boolean => ev.tieStartAt?.[i] ?? ev.tieStart;

/**
 * Ties to draw between consecutive events: which pitches of `from` continue
 * into which pitches of `to`. Empty when nothing is held.
 */
export function tieIndexes(from: XmlEvent, to: XmlEvent): { fromIdx: number[]; toIdx: number[] } {
  const fromIdx: number[] = [];
  const toIdx: number[] = [];
  const toMidis = to.pitches.map(toMidi);
  from.pitches.forEach((p, i) => {
    if (!heldIntoNext(from, i)) return;
    const j = toMidis.indexOf(toMidi(p));
    if (j >= 0 && heldFromBefore(to, j)) {
      fromIdx.push(i);
      toIdx.push(j);
    }
  });
  return { fromIdx, toIdx };
}

/**
 * Tuplet brackets for a run of events: [first index, count, notes occupied].
 * A tuplet spans `actual` consecutive events with the same ratio; a run cut
 * short (by a slice from another voice, say) draws no bracket rather than a
 * wrong one.
 */
export function tupletGroups(events: XmlEvent[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  let i = 0;
  while (i < events.length) {
    const t = events[i].tuplet;
    if (!t) {
      i++;
      continue;
    }
    let n = 0;
    while (i + n < events.length && events[i + n].tuplet?.actual === t.actual && events[i + n].tuplet?.normal === t.normal && n < t.actual) n++;
    if (n === t.actual) out.push([i, n, t.normal]);
    i += Math.max(1, n);
  }
  return out;
}
