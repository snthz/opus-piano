import { describe, expect, test } from "bun:test";
import { buildTimeline, endsOnMinorTonic, type ParsedScore } from "@/lib/music/musicxml";
import { parseStaffCode } from "@/lib/music/musicxml-build";
import { parsePitch } from "@/lib/music/pitch";
import { mergeVoices, tieIndexes, tupletGroups, type RawNote } from "@/lib/music/voices";

/** Negra = 4 divisiones, como escribe MuseScore para música sin semicorcheas. */
const DIV = 4;
const note = (onset: number, duration: number, pitch: string | null, extra: Partial<RawNote> = {}): RawNote => ({
  onset,
  duration,
  pitch: pitch ? parsePitch(pitch) : null,
  vex: { 16: "w", 12: "h.", 8: "h", 4: "q", 2: "8", 1: "16" }[duration] ?? "q",
  shown: "",
  tieStart: false,
  tieStop: false,
  ...extra,
});
const codes = (events: ReturnType<typeof mergeVoices>) =>
  events.map((e) => (e.rest ? `r/${e.vex}` : `${e.pitches.map((p) => `${p.letter}${p.octave}`).join("+")}/${e.vex}${e.tieStart ? "~" : ""}`));

describe("fundir las voces de un pentagrama", () => {
  test("una sola voz sale tal cual, con sus figuras", () => {
    const events = mergeVoices([note(0, 4, "C4"), note(4, 4, "D4"), note(8, 8, "E4")], DIV);
    expect(codes(events)).toEqual(["C4/q", "D4/q", "E4/h"]);
    expect(events.map((e) => e.beats)).toEqual([1, 1, 2]);
  });

  test("un acorde escrito en una voz sigue siendo un acorde", () => {
    const events = mergeVoices([note(0, 8, "C4"), note(0, 8, "E4"), note(0, 8, "G4")], DIV);
    expect(codes(events)).toEqual(["C4+E4+G4/h"]);
    expect(events[0].tieStart).toBe(false);
  });

  test("un bajo largo bajo dos acordes se corta y se liga, como en la Gymnopédie", () => {
    // voz 5: sol2 blanca con puntillo; voz 6: silencio de negra y dos acordes de negra
    const events = mergeVoices(
      [note(0, 12, "G2"), note(0, 4, null), note(4, 4, "B3"), note(4, 4, "D4"), note(8, 4, "B3"), note(8, 4, "D4")],
      DIV,
    );
    expect(codes(events)).toEqual(["G2/q~", "G2+B3+D4/q~", "G2+B3+D4/q"]);
    // solo el bajo va ligado; los acordes se atacan cada vez
    expect(events[0].tieStartAt).toEqual([true]);
    expect(events[1].tieStopAt).toEqual([true, false, false]);
    expect(events[1].tieStartAt).toEqual([true, false, false]);
    expect(events[2].tieStopAt).toEqual([true, false, false]);
    expect(events[2].tieStartAt).toEqual([false, false, false]);
  });

  test("las ligaduras escritas en el archivo se respetan", () => {
    const events = mergeVoices([note(0, 8, "C4", { tieStart: true }), note(8, 8, "C4", { tieStop: true })], DIV);
    expect(codes(events)).toEqual(["C4/h~", "C4/h"]);
    expect(events[1].tieStop).toBe(true);
  });

  test("un hueco que nadie escribió (forward) se rellena con silencio", () => {
    const events = mergeVoices([note(0, 4, "C4"), note(8, 4, "E4")], DIV);
    expect(codes(events)).toEqual(["C4/q", "r/q", "E4/q"]);
  });

  test("dos voces al unísono son una sola nota", () => {
    const events = mergeVoices([note(0, 4, "C4"), note(0, 4, "C4")], DIV);
    expect(events[0].pitches).toHaveLength(1);
  });

  test("las notas salen de grave a agudo aunque las voces vengan al revés", () => {
    const events = mergeVoices([note(0, 4, "G4"), note(0, 4, "C3")], DIV);
    expect(codes(events)).toEqual(["C3+G4/q"]);
  });

  test("un tresillo conserva su marca si no lo corta otra voz", () => {
    const t = { actual: 3, normal: 2 };
    const events = mergeVoices([note(0, 2, "C4", { tuplet: t, vex: "8" }), note(2, 2, "D4", { tuplet: t, vex: "8" }), note(4, 2, "E4", { tuplet: t, vex: "8" })], DIV);
    expect(events.every((e) => e.tuplet?.actual === 3)).toBe(true);
    expect(tupletGroups(events)).toEqual([[0, 3, 2]]);
  });

  test("un tresillo cortado por otra voz no dibuja corchete", () => {
    const t = { actual: 3, normal: 2 };
    const events = mergeVoices(
      [note(0, 2, "C4", { tuplet: t }), note(2, 2, "D4", { tuplet: t }), note(4, 2, "E4", { tuplet: t }), note(0, 3, "C3")],
      DIV,
    );
    expect(tupletGroups(events)).toEqual([]);
  });

  test("tieIndexes dice qué notas del acorde van ligadas a cuáles", () => {
    const events = mergeVoices([note(0, 8, "C3"), note(0, 4, "E4"), note(4, 4, "G4")], DIV);
    expect(tieIndexes(events[0], events[1])).toEqual({ fromIdx: [0], toIdx: [0] });
  });
});

describe("la línea de tiempo con voces fundidas", () => {
  test("el bajo ligado suena una sola vez, los acordes cada uno", () => {
    const staff = mergeVoices(
      [note(0, 12, "G2"), note(0, 4, null), note(4, 4, "B3"), note(4, 4, "D4"), note(8, 4, "B3"), note(8, 4, "D4")],
      DIV,
    );
    const score: ParsedScore = { title: "", keyVex: "C", time: { num: 3, den: 4 }, tempo: 0, clefs: ["treble"], measures: [{ number: "1", staves: [staff] }] };
    const notes = buildTimeline(score).map((n) => `${n.midis[0]}@${n.start}+${n.beats}`);
    // sol2 = 43, si3 = 59, re4 = 62
    expect(notes).toEqual(["43@0+3", "59@1+1", "62@1+1", "59@2+1", "62@2+1"]);
  });
});

describe("modo mayor o menor cuando el archivo no lo dice", () => {
  const piece = (right: string, left: string) => [{ number: "1", staves: [parseStaffCode(right), parseStaffCode(left)] }];

  test("sin alteraciones y acabando en la: la menor (Para Elisa)", () => {
    expect(endsOnMinorTonic(piece("C5/q A4/q", "A2/h"), 0)).toBe(true);
  });
  test("sin alteraciones y acabando en do: do mayor", () => {
    expect(endsOnMinorTonic(piece("E4/q C4/q", "C3/h"), 0)).toBe(false);
  });
  test("cuatro sostenidos acabando en do sostenido: do sostenido menor (Claro de luna)", () => {
    expect(endsOnMinorTonic(piece("G#4/q E4/q", "(C#2 C#3)/h"), 4)).toBe(true);
  });
  test("decide la nota más grave del último acorde, aunque la mano derecha acabe en otra", () => {
    expect(endsOnMinorTonic(piece("E5/w", "(A2 E3)/w"), 0)).toBe(true);
    expect(endsOnMinorTonic(piece("A5/w", "(C3 E3)/w"), 0)).toBe(false);
  });
  test("un acorde final arpegiado (la, mi, do) cuenta por su nota más grave", () => {
    expect(endsOnMinorTonic(piece("A4/h r/q", "A2/8 E3/8 C4/8 r/8 r/q"), 0)).toBe(true);
  });
  test("si la mano izquierda calla al final, decide la derecha", () => {
    expect(endsOnMinorTonic(piece("E4/q", "-"), 1)).toBe(true);
  });
});
