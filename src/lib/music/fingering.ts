import type { KeyInfo } from "./keys";
import { ALL_KEYS } from "./keys";
import { LETTER_SEMITONES } from "./pitch";

/**
 * Standard piano fingerings for scales and arpeggios, one octave ascending,
 * as taught in most method books (Hanon, ABRSM). Descending is the same
 * sequence read backwards, which is how the study session draws it.
 *
 * Keyed by VexFlow key name; enharmonic keys (Gb/F#, Cb/B, C#/Db, and the
 * minor ones) share an entry because the keys under the fingers are the same.
 */

export interface HandFingering {
  /** Right hand, 8 numbers (1 = thumb). */
  rh: number[];
  /** Left hand, 8 numbers. */
  lh: number[];
}

const f = (rh: string, lh: string): HandFingering => ({ rh: [...rh].map(Number), lh: [...lh].map(Number) });

const MAJOR: Record<string, HandFingering> = {
  C: f("12312345", "54321321"),
  G: f("12312345", "54321321"),
  D: f("12312345", "54321321"),
  A: f("12312345", "54321321"),
  E: f("12312345", "54321321"),
  B: f("12312345", "43214321"),
  "F#": f("23412312", "43213214"),
  "C#": f("23123412", "32143213"),
  F: f("12341234", "54321321"),
  Bb: f("41231234", "32143213"),
  Eb: f("31234123", "32143213"),
  Ab: f("34123123", "32143213"),
  Db: f("23123412", "32143213"),
  Gb: f("23412312", "43213214"),
  Cb: f("12312345", "43214321"),
};

/** Harmonic minor: the form with a settled standard fingering. */
const MINOR: Record<string, HandFingering> = {
  Am: f("12312345", "54321321"),
  Em: f("12312345", "54321321"),
  Bm: f("12312345", "43214321"),
  "F#m": f("34123123", "43213214"),
  "C#m": f("34123123", "32143213"),
  "G#m": f("34123123", "32143213"),
  "D#m": f("31234123", "21432132"),
  "A#m": f("41231234", "21321432"),
  Dm: f("12312345", "54321321"),
  Gm: f("12312345", "54321321"),
  Cm: f("12312345", "54321321"),
  Fm: f("12341234", "54321321"),
  Bbm: f("41231234", "21321432"),
  Ebm: f("31234123", "21432132"),
  Abm: f("34123123", "32143213"),
};

/** Fingering of the key's scale (major, or harmonic minor), one octave ascending. */
export function scaleFingering(key: KeyInfo): HandFingering | null {
  return (key.mode === "mayor" ? MAJOR : MINOR)[key.vex] ?? null;
}

/**
 * Root-position arpeggio, one octave (4 notes). On a white-key tonic both
 * hands use the same shape; on a black key the fingering depends on which
 * chord tones are black, so nothing is claimed there.
 */
export function arpeggioFingering(key: KeyInfo): HandFingering | null {
  if (key.tonicAccidental !== 0) return null;
  return { rh: [1, 2, 3, 5], lh: [5, 3, 2, 1] };
}

/* ---------- Reading a key name out of text ---------- */

const LATIN: Record<string, string> = { do: "C", re: "D", mi: "E", fa: "F", sol: "G", la: "A", si: "B" };

/**
 * Finds the key a plan names in prose: «Sol mayor», «la menor», «Si♭ mayor»,
 * «G major», «F# minor», «Bb», «Am». Returns null when there's no key at the
 * start of the text. A spelling that isn't a real key («Re♯ mayor») resolves
 * to its enharmonic equivalent so the scale can still be drawn.
 */
export function parseKeyName(text: string): KeyInfo | null {
  const t = text
    .trim()
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/\s+sostenido/gi, "#")
    .replace(/\s+bemol/gi, "b");

  let letter: string | undefined;
  let accidental = 0;
  let modeText = "";

  // the accidental is optional as a whole so «la menor» doesn't lose its space to it
  const latin = /^(do|re|mi|fa|sol|la|si)(?:\s*(#|b))?(?:\s+(mayor|menor|maj|min|m))?\b/i.exec(t);
  if (latin) {
    letter = LATIN[latin[1].toLowerCase()];
    accidental = latin[2] === "#" ? 1 : latin[2] === "b" ? -1 : 0;
    modeText = (latin[3] ?? "").toLowerCase();
  } else {
    const english = /^([A-Ga-g])\s*(#|b)?(?:\s*(major|minor|mayor|menor|maj|min|m))?\b/.exec(t);
    if (!english) return null;
    letter = english[1].toUpperCase();
    accidental = english[2] === "#" ? 1 : english[2] === "b" ? -1 : 0;
    modeText = (english[3] ?? "").toLowerCase();
  }
  const mode: KeyInfo["mode"] = /^(menor|minor|min|m)$/.test(modeText) ? "menor" : "mayor";

  const exact = ALL_KEYS.find((k) => k.tonic === letter && k.tonicAccidental === accidental && k.mode === mode);
  if (exact) return exact;
  const pc = (LETTER_SEMITONES[letter as keyof typeof LETTER_SEMITONES] + accidental + 12) % 12;
  return ALL_KEYS.find((k) => k.mode === mode && (LETTER_SEMITONES[k.tonic] + k.tonicAccidental + 12) % 12 === pc) ?? null;
}

/**
 * A tempo in a text, within metronome range; null if none. «♩ = 72» wins,
 * then «a 80»; failing those, the first figure that could be a tempo (so
 * «compases 1-16 a 80» doesn't read 16 as one).
 */
export function parseBpm(text: string): number | null {
  const inRange = (v: string | undefined) => {
    const n = Number(v);
    return n >= 30 && n <= 240 ? n : null;
  };
  const eq = /=\s*(\d{2,3})\b/.exec(text);
  if (eq) return inRange(eq[1]);
  const after = /\ba\s+(\d{2,3})\b/.exec(text);
  if (after) return inRange(after[1]);
  for (const m of text.match(/\b\d{2,3}\b/g) ?? []) {
    const n = inRange(m);
    if (n) return n;
  }
  return null;
}
