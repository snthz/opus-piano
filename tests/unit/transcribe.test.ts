/**
 * La transcripción con IA se apoya en dos piezas deterministas que sí se pueden
 * probar sin llamar a ningún modelo: el códec de la notación compacta (el mismo
 * texto que la app le enseña al modelo y que el modelo le devuelve) y el
 * escritor de MusicXML. Lo que se comprueba aquí es que la ida y la vuelta
 * cuadran y que las duraciones que no suman se detectan.
 */
import { describe, expect, test } from "bun:test";
import {
  beatsOfVex,
  buildMusicXml,
  checkDurations,
  eventCode,
  linkTies,
  measureBeats,
  parseEventCode,
  parseStaffCode,
} from "@/lib/music/musicxml-build";
import { assemble, transcribeUserMessage, transcriptionSchema, TRANSCRIPTION_SCHEMA } from "@/lib/ai/transcribe";
import { toJsonSchema } from "@/lib/ai/schema";
import type { ParsedScore } from "@/lib/music/musicxml";

describe("notación compacta", () => {
  test("figuras y puntillos en negras", () => {
    expect(beatsOfVex("w")).toBe(4);
    expect(beatsOfVex("q")).toBe(1);
    expect(beatsOfVex("h.")).toBe(3);
    expect(beatsOfVex("q..")).toBe(1.75);
    expect(beatsOfVex("16")).toBe(0.25);
    expect(() => beatsOfVex("z")).toThrow();
  });

  test("ida y vuelta de un evento", () => {
    for (const code of ["C4/q", "F#4/8.", "Bb3/h", "(C4 E4 G4)/h", "G4/h~", "r/q"]) {
      expect(eventCode(parseEventCode(code))).toBe(code);
    }
  });

  test("una nota suelta", () => {
    const ev = parseEventCode("F#4/8.");
    expect(ev.pitches).toEqual([{ letter: "F", accidental: 1, octave: 4 }]);
    expect(ev.beats).toBe(0.75);
    expect(ev.rest).toBe(false);
  });

  test("un acorde no se parte por los espacios de dentro", () => {
    const events = parseStaffCode("C4/q (E4 G4 C5)/h~ r/q");
    expect(events).toHaveLength(3);
    expect(events[1].pitches).toHaveLength(3);
    expect(events[1].tieStart).toBe(true);
    expect(events[2].rest).toBe(true);
  });

  test("un pentagrama sin notas", () => {
    expect(parseStaffCode("-")).toEqual([]);
    expect(parseStaffCode("   ")).toEqual([]);
  });

  test("lo que no se entiende se rechaza", () => {
    expect(() => parseEventCode("C4")).toThrow();
    expect(() => parseEventCode("H4/q")).toThrow();
    expect(() => parseEventCode("C4/x")).toThrow();
  });

  test("la ligadura se cierra en la nota siguiente, aunque cambie de compás", () => {
    const measures = [
      { number: "1", staves: [parseStaffCode("C4/h C4/h~")] },
      { number: "2", staves: [parseStaffCode("C4/h r/h")] },
    ];
    linkTies(measures, 1);
    expect(measures[0].staves[0][0].tieStop).toBe(false);
    expect(measures[1].staves[0][0].tieStop).toBe(true);
    expect(measures[1].staves[0][1].tieStop).toBe(false);
  });
});

/** Una partitura de prueba montada como la monta `assemble`: compases sueltos y las ligaduras ya encadenadas. */
function scoreOf(measures: ParsedScore["measures"], time = { num: 4, den: 4 }): ParsedScore {
  linkTies(measures, 2);
  return { title: "Prueba", keyVex: "G", time, tempo: 96, clefs: ["treble", "bass"], measures };
}

describe("duraciones", () => {
  test("negras que dura un compás", () => {
    expect(measureBeats({ num: 3, den: 4 })).toBe(3);
    expect(measureBeats({ num: 6, den: 8 })).toBe(3);
  });

  test("se señala el compás que no suma", () => {
    const score = scoreOf([
      { number: "1", staves: [parseStaffCode("C4/q C4/q C4/q C4/q"), parseStaffCode("C3/w")] },
      { number: "2", staves: [parseStaffCode("C4/q C4/q C4/q"), parseStaffCode("C3/w")] },
      { number: "3", staves: [parseStaffCode("C4/w"), parseStaffCode("C3/w")] },
    ]);
    const issues = checkDurations(score);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ measure: "2", staff: 0, beats: 3 });
  });

  test("la anacrusa y el último compás pueden quedarse cortos", () => {
    const score = scoreOf([
      { number: "1", staves: [parseStaffCode("C4/q"), []] },
      { number: "2", staves: [parseStaffCode("C4/w"), []] },
      { number: "3", staves: [parseStaffCode("C4/h"), []] },
    ]);
    expect(checkDurations(score)).toEqual([]);
  });

  test("pasarse sí se señala, esté donde esté", () => {
    const score = scoreOf([{ number: "1", staves: [parseStaffCode("C4/w C4/q"), []] }]);
    expect(checkDurations(score)).toHaveLength(1);
  });
});

describe("escritura de MusicXML", () => {
  const score = scoreOf(
    [
      { number: "1", staves: [parseStaffCode("F#4/q (D4 G4)/h~"), parseStaffCode("G3/h. ")] },
      { number: "2", staves: [parseStaffCode("(D4 G4)/q F4/q r/q"), parseStaffCode("r/h.")] },
    ],
    { num: 3, den: 4 },
  );

  test("cabecera, armadura y claves", () => {
    const xml = buildMusicXml(score, { composer: "Bach & hijo" });
    expect(xml).toContain("<work-title>Prueba</work-title>");
    expect(xml).toContain('<creator type="composer">Bach &amp; hijo</creator>');
    expect(xml).toContain("<fifths>1</fifths>");
    expect(xml).toContain("<beats>3</beats><beat-type>4</beat-type>");
    expect(xml).toContain("<staves>2</staves>");
    expect(xml).toContain('<clef number="2"><sign>F</sign><line>4</line></clef>');
    expect(xml).toContain('<sound tempo="96"/>');
  });

  test("las duraciones salen enteras y la segunda mano vuelve atrás", () => {
    const xml = buildMusicXml(score);
    expect(xml).not.toMatch(/<duration>[\d]*\.[\d]+<\/duration>/);
    // La mano derecha del primer compás ocupa las tres negras: 3 × 48.
    expect(xml).toContain("<backup><duration>144</duration></backup>");
  });

  test("el acorde marca sus notas y la ligadura se abre y se cierra", () => {
    const xml = buildMusicXml(score);
    expect((xml.match(/<chord\/>/g) ?? [])).toHaveLength(2);
    expect(xml).toContain('<tie type="start"/>');
    expect(xml).toContain('<tie type="stop"/>');
  });

  test("solo se imprime la alteración que no está ya vigente", () => {
    // En Sol mayor el fa ya es sostenido por la armadura: F#4 no lleva alteración impresa,
    // pero el F4 becuadro del segundo compás sí.
    const xml = buildMusicXml(score);
    expect((xml.match(/<accidental>/g) ?? [])).toHaveLength(1);
    expect(xml).toContain("<accidental>natural</accidental>");
  });
});

describe("montaje de la respuesta del modelo", () => {
  const page = (measures: { number: number; staves: string[] }[], extra: Record<string, unknown> = {}) => ({
    title: "Minueto",
    composer: "Petzold",
    fifths: 1,
    mode: "major" as const,
    beats: 3,
    beatType: 4,
    tempo: 100,
    clefs: ["sol", "fa"] as ("sol" | "fa" | "do")[],
    measures,
    ...extra,
  });

  test("las páginas se numeran de corrido", () => {
    const { score, composer } = assemble([
      page([
        { number: 1, staves: ["D5/q G4/q A4/q", "G3/h."] },
        { number: 2, staves: ["B4/q C5/q D5/q", "G3/h."] },
      ]),
      // El modelo se despista contando y repite la numeración de la primera página.
      page([{ number: 1, staves: ["G4/h.", "-"] }]),
    ]);
    expect(score.measures.map((m) => m.number)).toEqual(["1", "2", "3"]);
    expect(score.keyVex).toBe("G");
    expect(score.clefs).toEqual(["treble", "bass"]);
    expect(composer).toBe("Petzold");
  });

  test("un pentagrama ilegible no tira abajo el resto", () => {
    const { score, warnings } = assemble([
      page([
        { number: 1, staves: ["D5/q G4/q A4/q", "esto no es notación"] },
        { number: 2, staves: ["B4/h.", "G3/h."] },
      ]),
    ]);
    expect(score.measures).toHaveLength(2);
    expect(score.measures[0].staves[1]).toEqual([]);
    expect(score.measures[1].staves[0]).toHaveLength(1);
    expect(warnings.some((w) => w.includes("Compás 1, pentagrama 2"))).toBe(true);
  });

  test("los compases que no cuadran llegan como aviso", () => {
    const { warnings } = assemble([
      page([
        { number: 1, staves: ["D5/q G4/q A4/q", "G3/h."] },
        { number: 2, staves: ["B4/q C5/q", "G3/h."] },
        { number: 3, staves: ["D5/h.", "G3/h."] },
      ]),
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toBe("Compás 2, pentagrama 1: dura 2 en vez de 3 negras");
  });

  test("sin páginas no hay partitura", () => {
    expect(() => assemble([])).toThrow();
  });
});

describe("lo que se le manda al modelo", () => {
  test("el esquema vale para los dos proveedores", () => {
    for (const style of ["typeArray", "anyOf"] as const) {
      const json = toJsonSchema(TRANSCRIPTION_SCHEMA, style) as { properties: Record<string, unknown>; required: string[] };
      expect(json.required).toContain("measures");
      expect(json.properties.clefs).toBeDefined();
      expect(JSON.stringify(json)).not.toContain("undefined");
    }
  });

  test("la primera página pide la cabecera y las siguientes la reciben", () => {
    const base = { scoreName: "Minueto", page: 1, index: 1, total: 3, firstMeasure: 1, header: null };
    expect(transcribeUserMessage(base)).toContain("Lee también la cabecera");

    const next = transcribeUserMessage({
      ...base,
      page: 2,
      index: 2,
      firstMeasure: 9,
      header: { fifths: 1, mode: "major", beats: 3, beatType: 4, tempo: 100, clefs: ["sol", "fa"] },
    });
    expect(next).toContain("a partir del 9");
    expect(next).toContain("fifths 1 (G)");
    expect(next).toContain("compás 3/4");
  });

  test("el zod rechaza una cabecera imposible", () => {
    const ok = { title: "", composer: "", fifths: 0, mode: "major", beats: 4, beatType: 4, tempo: 0, clefs: ["sol"], measures: [] };
    expect(transcriptionSchema.safeParse(ok).success).toBe(true);
    expect(transcriptionSchema.safeParse({ ...ok, fifths: 9 }).success).toBe(false);
    expect(transcriptionSchema.safeParse({ ...ok, clefs: ["sol", "fa", "do"] }).success).toBe(false);
  });
});
