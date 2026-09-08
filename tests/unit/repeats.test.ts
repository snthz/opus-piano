import { describe, expect, test } from "bun:test";
import { buildTimeline, expandRepeats, type ParsedScore, type XmlMeasure } from "@/lib/music/musicxml";
import { buildMusicXml, linkTies, parseStaffCode } from "@/lib/music/musicxml-build";
import { assemble, transcriptionSchema } from "@/lib/ai/transcribe";
import { locate, type MeasureMap } from "@/lib/score-layout";

const m = (code: string, extra: Partial<XmlMeasure> = {}): XmlMeasure => ({ number: "0", staves: [parseStaffCode(code)], ...extra });

const score = (measures: XmlMeasure[]): ParsedScore => ({
  title: "",
  keyVex: "C",
  time: { num: 4, den: 4 },
  tempo: 0,
  clefs: ["treble"],
  measures: measures.map((x, i) => ({ ...x, number: String(i + 1) })),
});

describe("despliegue de repeticiones", () => {
  test("sin repeticiones es la identidad", () => {
    expect(expandRepeats([{}, {}, {}])).toEqual([0, 1, 2]);
  });

  test("una barra de cierre vuelve una vez al principio de la pieza", () => {
    expect(expandRepeats([{}, { repeatEnd: true }, {}])).toEqual([0, 1, 0, 1, 2]);
  });

  test("con barra de apertura vuelve a ella y no al principio", () => {
    expect(expandRepeats([{}, { repeatStart: true }, { repeatEnd: true }, {}])).toEqual([0, 1, 2, 1, 2, 3]);
  });

  test("casillas 1 y 2: A + 1.ª + A + 2.ª", () => {
    const order = expandRepeats([{ repeatStart: true }, {}, { ending: 1, repeatEnd: true }, { ending: 2 }, {}]);
    expect(order).toEqual([0, 1, 2, 0, 1, 3, 4]);
  });

  test("una casilla puede abarcar varios compases", () => {
    const order = expandRepeats([{ repeatStart: true }, { ending: 1 }, { ending: 1, repeatEnd: true }, { ending: 2 }, { ending: 2 }]);
    expect(order).toEqual([0, 1, 2, 0, 3, 4]);
  });

  test("tres casillas", () => {
    const order = expandRepeats([{ repeatStart: true }, { ending: 1, repeatEnd: true }, { ending: 2, repeatEnd: true }, { ending: 3 }]);
    expect(order).toEqual([0, 1, 0, 2, 0, 3]);
  });

  test("dos secciones seguidas, cada una con su vuelta", () => {
    const order = expandRepeats([{ repeatStart: true }, { repeatEnd: true }, { repeatStart: true }, { repeatEnd: true }]);
    expect(order).toEqual([0, 1, 0, 1, 2, 3, 2, 3]);
  });

  test("una casilla sin barra de cierre que la alcance se toca de corrido", () => {
    expect(expandRepeats([{}, { ending: 1 }, { ending: 2 }])).toEqual([0, 1, 2]);
  });
});

describe("línea de tiempo con repeticiones", () => {
  test("las notas repetidas suenan dos veces y señalan la misma nota impresa", () => {
    const s = score([m("C4/w", { repeatStart: true }), m("D4/w", { ending: 1, repeatEnd: true }), m("E4/w", { ending: 2 })]);
    const tl = buildTimeline(s);
    expect(tl.map((n) => [n.midis[0], n.start])).toEqual([
      [60, 0],
      [62, 4],
      [60, 8],
      [64, 12],
    ]);
    expect(tl[2].refs).toEqual([{ staff: 0, index: 0 }]);
  });

  test("una ligadura abierta no continúa tras el salto", () => {
    const s = score([m("C4/w~", { repeatEnd: true }), m("C4/w")]);
    linkTies(s.measures, 1);
    const tl = buildTimeline(s);
    // Primera pasada: C4 del c1 suelta; segunda: c1 ligado con c2.
    expect(tl.map((n) => [n.start, n.beats])).toEqual([
      [0, 4],
      [4, 8],
    ]);
  });
});

describe("MusicXML con repeticiones", () => {
  test("escribe barras de repetición y casillas en los compases que tocan", () => {
    const xml = buildMusicXml(score([m("C4/w", { repeatStart: true }), m("D4/w", { ending: 1 }), m("D4/w", { ending: 1, repeatEnd: true }), m("E4/w", { ending: 2 })]));
    const measures = xml.split("<measure ").slice(1);
    expect(measures[0]).toContain('<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>');
    expect(measures[0]).not.toContain('location="right"');
    expect(measures[1]).toContain('<barline location="left"><ending number="1" type="start"/></barline>');
    expect(measures[1]).not.toContain('location="right"');
    expect(measures[2]).not.toContain('location="left"');
    expect(measures[2]).toContain('<barline location="right"><bar-style>light-heavy</bar-style><ending number="1" type="stop"/><repeat direction="backward"/></barline>');
    expect(measures[3]).toContain('<ending number="2" type="start"/>');
    expect(measures[3]).toContain('<ending number="2" type="discontinue"/>');
  });

  test("sin repeticiones no aparece ninguna barra", () => {
    expect(buildMusicXml(score([m("C4/w"), m("D4/w")]))).not.toContain("<barline");
  });
});

describe("transcripción con repeticiones", () => {
  const page = {
    title: "", composer: "", fifths: 0, mode: "major" as const, beats: 4, beatType: 4, tempo: 0, clefs: ["sol" as const],
    measures: [
      { number: 1, staves: ["C4/w"], repeat: "start" as const, ending: 0 },
      { number: 2, staves: ["D4/w"], repeat: "end" as const, ending: 1 },
      { number: 3, staves: ["E4/w"], repeat: "none" as const, ending: 2 },
    ],
  };

  test("el esquema admite las marcas y rellena las que faltan", () => {
    expect(transcriptionSchema.safeParse(page).success).toBe(true);
    const old = transcriptionSchema.parse({ ...page, measures: [{ number: 1, staves: ["C4/w"] }] });
    expect(old.measures[0]).toMatchObject({ repeat: "none", ending: 0 });
  });

  test("las marcas pasan a la partitura ensamblada", () => {
    const { score: s } = assemble([page]);
    expect(s.measures.map((x) => [!!x.repeatStart, !!x.repeatEnd, x.ending ?? 0])).toEqual([
      [true, false, 0],
      [false, true, 1],
      [false, false, 2],
    ]);
  });
});

describe("guía sobre el PDF con repeticiones", () => {
  test("localiza el compás impreso según el paso de reproducción", () => {
    const box = { page: 1, x0: 0, x1: 1, top: 0, bottom: 1 };
    const map: MeasureMap = { boxes: [box, box, box], order: [0, 1, 0, 2], starts: [0, 4, 8, 12], lengths: [4, 4, 4, 4], approximate: false };
    expect(locate(map, 2)).toEqual({ measure: 0, frac: 0.5 });
    expect(locate(map, 9)).toEqual({ measure: 0, frac: 0.25 });
    expect(locate(map, 13)).toEqual({ measure: 2, frac: 0.25 });
  });
});
