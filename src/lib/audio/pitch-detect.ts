/**
 * Hearing a played or sung note: how loud it is, when it starts, and what
 * note it is.
 *
 * Everything here is arithmetic over a buffer of samples — no microphone, no
 * AudioContext — so it can be tested with a synthetic wave. The plumbing that
 * feeds it real sound is in `listen.ts`.
 */

/** Loudness of a block of samples, 0-1 (root mean square). */
export function rms(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

export interface PitchOptions {
  /** Lowest note worth looking for, in Hz (default: a low male voice). */
  minFreq?: number;
  /** Highest, in Hz. */
  maxFreq?: number;
  /** Below this loudness it's silence, not a note. */
  minLevel?: number;
  /** How clear the repetition has to be, 0-1: below it, it's noise. */
  clarity?: number;
}

/**
 * The frequency of a sung or played note, in Hz, or null if there isn't one.
 *
 * Autocorrelation normalised by energy (the McLeod idea): the wave is
 * compared with itself displaced by every plausible period, and the best
 * match wins. It's slower than looking at the spectrum, but it doesn't
 * mistake the second harmonic for the note, which is exactly what a voice
 * full of harmonics would cause.
 *
 * The peak is refined with a parabola through its two neighbours, so the
 * reading doesn't jump in steps of a whole sample: without it, a high note
 * would land several cents off.
 */
export function detectPitch(buffer: Float32Array, sampleRate: number, options: PitchOptions = {}): number | null {
  const { minFreq = 70, maxFreq = 1200, minLevel = 0.01, clarity = 0.5 } = options;
  const n = buffer.length;
  if (rms(buffer) < minLevel) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq));
  const maxLag = Math.min(n - 1, Math.ceil(sampleRate / minFreq));
  if (maxLag <= minLag) return null;

  // Normalised correlation for every plausible period.
  const curve = new Float32Array(maxLag - minLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i + lag < n; i++) {
      correlation += buffer[i] * buffer[i + lag];
      normA += buffer[i] * buffer[i];
      normB += buffer[i + lag] * buffer[i + lag];
    }
    curve[lag - minLag] = normA && normB ? correlation / Math.sqrt(normA * normB) : 0;
  }

  // The period, its double and its triple all correlate about the same, so
  // taking the highest peak is a coin toss that lands an octave low about
  // half the time. The note is the *first* peak that is nearly as good as the
  // best one.
  let best = 0;
  for (let i = 0; i < curve.length; i++) if (curve[i] > best) best = curve[i];
  if (best < clarity) return null;

  const enough = best * 0.9;
  let peak = -1;
  for (let i = 1; i < curve.length - 1; i++) {
    if (curve[i] >= enough && curve[i] >= curve[i - 1] && curve[i] >= curve[i + 1]) {
      peak = i;
      break;
    }
  }
  if (peak < 0) return null;

  // Parabola through the peak and its neighbours, so the reading doesn't move
  // in whole samples: without it a high note would land several cents off.
  const left = curve[peak - 1];
  const right = curve[peak + 1];
  const denominator = 2 * (2 * curve[peak] - left - right);
  const shift = denominator === 0 ? 0 : (right - left) / denominator;
  const lag = minLag + peak + Math.max(-1, Math.min(1, shift));

  return sampleRate / lag;
}

/**
 * How much the spectrum has grown since the previous frame (spectral flux).
 * A note starting is a jump in energy across many bands at once, which is
 * what tells a hand clap from a hum.
 *
 * Magnitudes come as decibels, the way `AnalyserNode` gives them; only what
 * grows counts, because what fades is the previous note dying out.
 */
export function spectralFlux(previous: Float32Array, current: Float32Array): number {
  let sum = 0;
  const n = Math.min(previous.length, current.length);
  for (let i = 0; i < n; i++) {
    const growth = current[i] - previous[i];
    if (growth > 0) sum += growth;
  }
  return n ? sum / n : 0;
}

/**
 * When a note starts, from the flux of each frame.
 *
 * There's no fixed threshold that works for a clap, a table knock and a piano
 * at the same time: what counts is standing out from the recent past, so the
 * detector carries a window of its own history and fires at whatever exceeds
 * it by a margin. After firing it goes deaf for a moment — a single attack
 * spreads over several frames, and without that it would be counted as
 * several hits.
 */
export class OnsetDetector {
  private history: number[] = [];
  private lastOnset = -Infinity;

  constructor(
    /** Frames of history used as the reference. */
    private readonly window = 20,
    /** How far above the recent mean a frame has to be. */
    private readonly margin = 1.6,
    /** Minimum seconds between two onsets. */
    readonly refractory = 0.08,
    /** Floor, so silence with a faint hiss doesn't fire. */
    private readonly floor = 0.6,
  ) {}

  /** Feeds one frame; true if a note starts here. */
  push(flux: number, time: number): boolean {
    const reference = this.history.length
      ? this.history.reduce((a, b) => a + b, 0) / this.history.length
      : 0;
    this.history.push(flux);
    if (this.history.length > this.window) this.history.shift();

    const loud = flux > Math.max(this.floor, reference * this.margin);
    if (!loud || time - this.lastOnset < this.refractory) return false;
    // A note doesn't start from nothing on the first frame: the reference
    // needs some past, or opening the microphone would fire on its own.
    if (this.history.length < 4) return false;
    this.lastOnset = time;
    return true;
  }

  reset() {
    this.history = [];
    this.lastOnset = -Infinity;
  }
}
