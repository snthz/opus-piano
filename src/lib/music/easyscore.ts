import { FIGURE_BY_VEX, dottedBeats, type Figure } from "./durations";

/** An EasyScore figure ("pitch/duration/type/dots"); a dotted rest is "B4/h/r.", not "B4/h./r". */
export function easyScorePiece(keys: string, vex: string, rest = false): string {
  if (!rest) return `${keys}/${vex}`;
  const dots = vex.replace(/[^.]/g, "");
  return `${keys}/${vex.replace(/\./g, "")}/r${dots}`;
}

export interface EasyScoreToken {
  /** Pitches of the figure: one, or several if it's a chord. */
  keys: string[];
  rest: boolean;
  /** Duration in quarter notes, dots included. */
  beats: number;
}

const DURATION = /^(w|h|q|8|16|32|64)(\.*)$/;
const REST = /^r(\.*)$/;

/**
 * The figures of an EasyScore measure, in order. Rests count as figures: they
 * take an index in `Score` just like notes do.
 *
 * Duration is sticky, as in VexFlow: in "C4/q, D4, E4" the three are quarters.
 * Written material lives in data files, so this is what checks that every
 * measure adds up to its time signature before anyone tries to read it.
 */
export function parseEasyScore(measure: string): EasyScoreToken[] {
  const out: EasyScoreToken[] = [];
  let figure: Figure = FIGURE_BY_VEX.q;
  for (const token of measure.split(",")) {
    const parts = token.trim().split("/");
    const keys = parts[0].trim();
    if (!keys) continue;
    let dots = 0;
    let rest = false;
    for (const part of parts.slice(1)) {
      const duration = DURATION.exec(part.trim());
      if (duration) {
        figure = FIGURE_BY_VEX[duration[1] as Figure["vex"]];
        dots = duration[2].length;
        continue;
      }
      // The dots of a rest hang off the type ("B4/h/r."), not off the figure.
      const silence = REST.exec(part.trim());
      if (silence) {
        rest = true;
        dots += silence[1].length;
      }
    }
    out.push({
      keys: keys.replace(/[()]/g, "").split(/\s+/).filter(Boolean),
      rest,
      beats: dottedBeats(figure.beats, dots),
    });
  }
  return out;
}

/** Total duration of a measure in quarter notes. */
export function easyScoreBeats(measure: string): number {
  return parseEasyScore(measure).reduce((sum, token) => sum + token.beats, 0);
}
