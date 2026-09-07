import { describe, expect, test } from "bun:test";
import type { ParsedScore } from "@/lib/music/musicxml";
import { readSse, splitDataUrl } from "@/lib/ai/errors";
import { AI_MODELS, defaultModel, estimatePlanCost, modelsOf } from "@/lib/ai/models";
import {
  goalRange,
  planStateSchema,
  planUserMessage,
  studyPlanSchema,
  summarizeScore,
  STUDY_PLAN_SCHEMA,
  toJsonSchema,
  SUMMARY_MAX_CHARS,
} from "@/lib/study-plan";

const score: ParsedScore = {
  title: "Minueto",
  keyVex: "G",
  time: { num: 3, den: 4 },
  tempo: 100,
  clefs: ["treble", "bass"],
  measures: [
    {
      number: "1",
      staves: [
        [
          { pitches: [{ letter: "D", accidental: 0, octave: 5 }], rest: false, beats: 1, vex: "q", shown: [""], tieStart: false, tieStop: false },
          { pitches: [{ letter: "G", accidental: 0, octave: 4 }, { letter: "B", accidental: 0, octave: 4 }], rest: false, beats: 2, vex: "h", shown: ["", ""], tieStart: true, tieStop: false },
        ],
        [
          { pitches: [{ letter: "F", accidental: 1, octave: 3 }], rest: false, beats: 1, vex: "q", shown: ["#"], tieStart: false, tieStop: false },
          { pitches: [], rest: true, beats: 2, vex: "h", shown: [""], tieStart: false, tieStop: false },
        ],
      ],
    },
    { number: "2", staves: [[], []] },
  ],
};

const plan = {
  title: "Minueto en Sol",
  composer: "Petzold",
  analysis: {
    key: "Sol mayor",
    scale: "Sol mayor y su arpegio.",
    timeSignature: "3/4",
    tempo: "♩ = 100; empezar a 60",
    form: "A (c. 1-8), B (c. 9-16)",
    difficulty: "elemental",
    character: "Danza cortesana.",
    challenges: ["Fa sostenido en la mano izquierda"],
  },
  prerequisites: [{ title: "Escala de Sol mayor", description: "Dos octavas, manos separadas.", lesson: "escalas", exercise: "teclado" }],
  warmups: ["Escala de Sol mayor a ♩ = 60"],
  goals: [
    { id: "g1", title: "Mano derecha, c. 1-4", from: 1, to: 4, hands: "derecha", description: "Lento.", tips: ["Cuenta en voz alta"], fingering: "MD: 5-3-1", targetTempo: "♩ = 60", sessions: 2 },
    { id: "g1", title: "Mano izquierda, c. 1-4", from: 1, to: 4, hands: "izquierda", description: "Lento.", tips: [], fingering: "", targetTempo: "", sessions: 2 },
  ],
  routine: { sessionMinutes: 20, weeks: 4, blocks: [{ minutes: 5, activity: "Calentar" }], advice: "Poco y a diario." },
};

describe("resumen de la partitura para el modelo", () => {
  test("cabecera y compases nota a nota, con alteraciones reales y ligaduras", () => {
    const s = summarizeScore(score);
    expect(s).toContain("Tonalidad (por la armadura): Sol mayor / G mayor");
    expect(s).toContain("Compás: 3/4");
    expect(s).toContain("Tempo indicado: ♩ = 100");
    expect(s).toContain("c1 | MD: D5/q (G4 B4)/h~ | MI: F#3/q r/h");
    expect(s).toContain("c2 | MD: - | MI: -");
  });

  test("nunca supera el tamaño máximo y avisa de lo omitido", () => {
    const big: ParsedScore = { ...score, measures: Array.from({ length: 20_000 }, (_, i) => ({ ...score.measures[0], number: String(i + 1) })) };
    const s = summarizeScore(big);
    expect(s.length).toBeLessThan(SUMMARY_MAX_CHARS + 200);
    expect(s).toContain("hasta el compás 20000");
  });

  test("el mensaje al modelo cuenta qué páginas se adjuntan", () => {
    const base = { level: "principiante" as const, minutesPerDay: 20, daysPerWeek: 4, goal: "", naming: "latino" as const, scoreName: "X", notes: "", summary: "" };
    expect(planUserMessage({ ...base, pages: { sent: 12, total: 20 } })).toContain("páginas 1 a 12 del PDF (de 20)");
    expect(planUserMessage({ ...base, pages: null })).toContain("No hay contenido musical disponible");
    expect(planUserMessage({ ...base, pages: null, summary: "c1 | …" })).toContain("Contenido de la partitura (MusicXML)");
  });
});

describe("esquema del plan", () => {
  test("acepta un plan válido y lo que se guarda con la partitura", () => {
    expect(studyPlanSchema.safeParse(plan).success).toBe(true);
    expect(planStateSchema.safeParse({ plan, progress: { g1: true }, model: "gpt-5.6-terra", createdAt: Date.now() }).success).toBe(true);
  });

  test("rechaza lecciones que no existen, niveles inventados y objetivos vacíos", () => {
    expect(studyPlanSchema.safeParse({ ...plan, prerequisites: [{ ...plan.prerequisites[0], lesson: "inventada" }] }).success).toBe(false);
    expect(studyPlanSchema.safeParse({ ...plan, analysis: { ...plan.analysis, difficulty: "virtuoso" } }).success).toBe(false);
    expect(studyPlanSchema.safeParse({ ...plan, goals: [] }).success).toBe(false);
  });

  test("el JSON Schema para OpenAI usa tipos en array y para Anthropic anyOf, ambos estrictos", () => {
    const openai = toJsonSchema(STUDY_PLAN_SCHEMA, "typeArray") as { properties: Record<string, { items: { properties: Record<string, unknown> } }> };
    const anthropic = toJsonSchema(STUDY_PLAN_SCHEMA, "anyOf") as typeof openai;
    const from = (s: typeof openai) => s.properties.goals.items.properties.from;
    const hands = (s: typeof openai) => s.properties.goals.items.properties.hands as Record<string, unknown>;
    expect(from(openai)).toMatchObject({ type: ["integer", "null"] });
    expect(hands(openai)).toMatchObject({ type: ["string", "null"], enum: ["derecha", "izquierda", "separadas", "juntas", null] });
    expect(from(anthropic)).toMatchObject({ anyOf: [{ type: "integer" }, { type: "null" }] });
    expect(JSON.stringify(openai)).not.toContain("anyOf");
    expect(JSON.stringify(anthropic)).not.toContain('"type":["');

    // Modo estricto: todos los objetos cierran propiedades y las exigen todas.
    const walk = (node: Record<string, unknown>) => {
      if (node.type === "object") {
        expect(node.additionalProperties).toBe(false);
        expect(node.required).toEqual(Object.keys(node.properties as object));
        for (const v of Object.values(node.properties as Record<string, Record<string, unknown>>)) walk(v);
      }
      if (node.type === "array") walk(node.items as Record<string, unknown>);
      for (const v of (node.anyOf as Record<string, unknown>[] | undefined) ?? []) walk(v);
    };
    walk(openai as unknown as Record<string, unknown>);
    walk(anthropic as unknown as Record<string, unknown>);
  });

  test("tramo de un objetivo en texto", () => {
    expect(goalRange(plan.goals[0] as never)).toBe("Compases 1-4 · Mano derecha");
    expect(goalRange({ ...plan.goals[0], from: 3, to: 3, hands: null } as never)).toBe("Compás 3");
    expect(goalRange({ ...plan.goals[0], from: null, to: null, hands: "juntas" } as never)).toBe("Manos juntas");
  });
});

describe("catálogo de modelos", () => {
  test("cada proveedor tiene exactamente un recomendado y precios coherentes", () => {
    for (const provider of ["openai", "anthropic"] as const) {
      const models = modelsOf(provider);
      expect(models.filter((m) => m.recommended)).toHaveLength(1);
      expect(defaultModel(provider)).toBe(models.find((m) => m.recommended)!.id);
    }
    for (const m of AI_MODELS) {
      expect(m.output).toBeGreaterThan(m.input);
      for (const v of [m.speed, m.precision, m.economy]) expect(v >= 1 && v <= 5).toBe(true);
      expect(estimatePlanCost(m)).toBeGreaterThan(0);
    }
  });
});

describe("utilidades de red", () => {
  test("separa una data URL de imagen", () => {
    expect(splitDataUrl("data:image/jpeg;base64,AAAA")).toEqual({ mediaType: "image/jpeg", data: "AAAA" });
    expect(() => splitDataUrl("http://x")).toThrow();
  });

  test("lee eventos SSE partidos en trozos arbitrarios", async () => {
    const text = 'event: a\ndata: {"type":"x","delta":"ho"}\n\ndata: {"type":"x","delta":"la"}\n\ndata: [DONE]\n\n';
    const chunks = [text.slice(0, 17), text.slice(17, 40), text.slice(40)];
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
        c.close();
      },
    });
    const got: string[] = [];
    await readSse(new Response(stream), (ev) => got.push(ev.delta as string));
    expect(got).toEqual(["ho", "la"]);
  });
});
