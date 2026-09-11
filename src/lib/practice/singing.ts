/**
 * Grading a sung melody.
 *
 * The exercise used to ask the student whether they had read it right, which
 * is the one question a learner can't answer: not knowing is precisely why
 * they're here. With the microphone the app can tell — what was sung is
 * compared, note by note, with what was written.
 *
 * Two decisions that are the whole of it:
 *
 * - **The octave doesn't count.** A bass sings an octave below a soprano and
 *   both are right. Only the note within the octave is compared.
 * - **Only the middle of each note is looked at.** The start is a slide
 *   towards the note and the end is already leaving it; judging by them would
 *   fail a perfectly good voice.
 *
 * Pure arithmetic: the microphone is in `listen.ts`.
 */

export interface PitchSample {
  /** Instant on the audio clock. */
  at: number;
  /** MIDI note with decimals (61.4 is a C sharp a bit flat). */
  midi: number;
}

export interface ExpectedNote {
  /** Position in the score, to paint the result on it. */
  index: number;
  start: number;
  end: number;
  midi: number;
}

export interface SungNote {
  index: number;
  expected: number;
  /** What was heard, or null if nothing was (a swallowed note). */
  heard: number | null;
  correct: boolean;
  /** How far off, in cents; positive = sharp. Null if nothing was heard. */
  cents: number | null;
}

/** Half a semitone is where one note ends and the next begins; a little less, to be fair to both. */
export const TOLERANCE_SEMITONES = 0.75;
/** Samples needed before a note counts as sung at all. */
const MIN_SAMPLES = 3;
/** Fraction of the note skipped at the start (the slide into it) and at the end. */
const WINDOW = { from: 0.3, to: 0.9 };

/** When each note of the melody falls, given when the first one starts. */
export function expectedNotes(
  events: { midis: number[]; beats: number }[],
  startTime: number,
  beatSeconds: number,
): ExpectedNote[] {
  const notes: ExpectedNote[] = [];
  let at = startTime;
  events.forEach((event, index) => {
    const duration = event.beats * beatSeconds;
    if (event.midis.length) notes.push({ index, start: at, end: at + duration, midi: event.midis[0] });
    at += duration;
  });
  return notes;
}

/** Distance between two notes ignoring the octave, in semitones (signed, -6 to 6). */
export function pitchClassDistance(heard: number, expected: number): number {
  const diff = (((heard - expected) % 12) + 18) % 12 - 6;
  return diff;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface SingingResult {
  notes: SungNote[];
  correct: number;
  total: number;
  /** 0-100. */
  score: number;
}

export function gradeSinging(expected: ExpectedNote[], samples: PitchSample[], tolerance = TOLERANCE_SEMITONES): SingingResult {
  const notes: SungNote[] = expected.map((note) => {
    const length = note.end - note.start;
    const from = note.start + length * WINDOW.from;
    const to = note.start + length * WINDOW.to;
    const heard = samples.filter((s) => s.at >= from && s.at <= to).map((s) => s.midi);
    if (heard.length < MIN_SAMPLES) {
      return { index: note.index, expected: note.midi, heard: null, correct: false, cents: null };
    }
    // The median, not the mean: one stray reading (a breath, a chair) would
    // drag the mean a long way and the median not at all.
    const sung = median(heard);
    const distance = pitchClassDistance(sung, note.midi);
    return {
      index: note.index,
      expected: note.midi,
      heard: sung,
      correct: Math.abs(distance) <= tolerance,
      cents: Math.round(distance * 100),
    };
  });

  const correct = notes.filter((n) => n.correct).length;
  return {
    notes,
    correct,
    total: notes.length,
    score: notes.length ? Math.round((correct / notes.length) * 100) : 0,
  };
}
