/**
 * EasyScore es la notación con la que se le pasan los compases a VexFlow, y su
 * gramática es estricta: si una figura no analiza, revienta el dibujo de la
 * partitura entera. El sitio donde es fácil equivocarse son los silencios con
 * puntillo, porque el puntillo va detrás del tipo y no detrás de la figura.
 */
import { describe, expect, test } from "bun:test";
import { EasyScore } from "vexflow";
import { easyScorePiece } from "@/lib/music/easyscore";
import { eventToEasyScore, type XmlEvent } from "@/lib/music/musicxml";
import { rhythmToEasyScore } from "@/lib/music/rhythm";

const parses = (line: string) => new EasyScore().parse(line).success;

const rest = (vex: string): XmlEvent => ({ pitches: [], rest: true, beats: 0, vex, shown: [], tieStart: false, tieStop: false });

describe("figuras en EasyScore", () => {
  test("el puntillo de un silencio va detrás del tipo", () => {
    expect(easyScorePiece("B4", "h.", true)).toBe("B4/h/r.");
    expect(easyScorePiece("B4", "q..", true)).toBe("B4/q/r..");
  });

  test("una nota lleva el puntillo pegado a la figura", () => {
    expect(easyScorePiece("C4", "h.")).toBe("C4/h.");
    expect(easyScorePiece("(C4 E4)", "q")).toBe("(C4 E4)/q");
  });

  test("VexFlow analiza los silencios con puntillo de la partitura", () => {
    for (const vex of ["w", "h", "h.", "q.", "8.", "16."]) {
      expect(parses(eventToEasyScore(rest(vex), "treble"))).toBe(true);
      expect(parses(eventToEasyScore(rest(vex), "bass"))).toBe(true);
    }
  });

  test("VexFlow analiza los compases de lectura rítmica con silencio con puntillo", () => {
    const measure = [
      { beats: 1.5, rest: true, vex: "q." },
      { beats: 1.5, rest: false, vex: "q." },
      { beats: 1, rest: false, vex: "q" },
    ];
    expect(rhythmToEasyScore(measure)).toBe("B4/q/r., B4/q., B4/q");
    expect(parses(rhythmToEasyScore(measure))).toBe(true);
  });
});
