import { describe, expect, test } from "bun:test";
import type { ParsedScore } from "@/lib/music/musicxml";
import { toJsonSchema } from "@/lib/plan/schema";
import {
  askInstructions,
  askRequestSchema,
  dedupeGoalIds,
  goalRange,
  planRequestSchema,
  planStateSchema,
  planUserMessage,
  studyPlanSchema,
  splitTeacherRefs,
  summarizeScore,
  STUDY_PLAN_SCHEMA,
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

  test("el JSON Schema que se le manda al modelo es estricto y expresa «o null» con anyOf", () => {
    const schema = toJsonSchema(STUDY_PLAN_SCHEMA) as { properties: Record<string, { items: { properties: Record<string, unknown> } }> };
    expect(schema.properties.goals.items.properties.from).toMatchObject({ anyOf: [{ type: "integer" }, { type: "null" }] });
    // Anthropic no admite tipos en array como ["integer","null"].
    expect(JSON.stringify(schema)).not.toContain('"type":["');

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
    walk(schema as unknown as Record<string, unknown>);
  });

  test("los objetivos con id repetido se renumeran", () => {
    // El modelo devuelve dos «g1»; sin renumerar, marcar uno marcaría los dos.
    expect(dedupeGoalIds(studyPlanSchema.parse(plan)).goals.map((g) => g.id)).toEqual(["g1", "g2"]);
  });

  test("tramo de un objetivo en texto", () => {
    expect(goalRange(plan.goals[0] as never)).toBe("Compases 1-4 · Mano derecha");
    expect(goalRange({ ...plan.goals[0], from: 3, to: 3, hands: null } as never)).toBe("Compás 3");
    expect(goalRange({ ...plan.goals[0], from: null, to: null, hands: "juntas" } as never)).toBe("Manos juntas");
  });
});

/**
 * Lo que manda el navegador llega al servidor como JSON cualquiera: la clave de
 * API es la del servidor, así que aquí se acota lo que puede acabar en la
 * petición al modelo.
 */
describe("lo que el navegador puede pedirle al servidor", () => {
  const request = {
    level: "principiante",
    minutesPerDay: 20,
    daysPerWeek: 4,
    goal: "",
    naming: "latino",
    scoreName: "Minueto",
    notes: "",
    summary: "",
    pages: { sent: 2, total: 5 },
  };

  test("acepta una petición normal", () => {
    expect(planRequestSchema.safeParse(request).success).toBe(true);
    expect(planRequestSchema.safeParse({ ...request, pages: null }).success).toBe(true);
  });

  test("rechaza tiempos imposibles, sistemas de nombres inventados y textos desmedidos", () => {
    expect(planRequestSchema.safeParse({ ...request, minutesPerDay: 4000 }).success).toBe(false);
    expect(planRequestSchema.safeParse({ ...request, daysPerWeek: 0 }).success).toBe(false);
    expect(planRequestSchema.safeParse({ ...request, naming: "solfeo" }).success).toBe(false);
    expect(planRequestSchema.safeParse({ ...request, goal: "x".repeat(2000) }).success).toBe(false);
    expect(planRequestSchema.safeParse({ ...request, summary: "x".repeat(SUMMARY_MAX_CHARS * 2) }).success).toBe(false);
  });

  test("una pregunta al profesor lleva el plan y una conversación acotada", () => {
    const ask = { naming: "latino", scoreName: "Minueto", plan, progress: { g1: true }, summary: "", history: [{ role: "user", content: "¿Y la izquierda?" }] };
    expect(askRequestSchema.safeParse(ask).success).toBe(true);
    expect(askRequestSchema.safeParse({ ...ask, history: [] }).success).toBe(false);
    expect(askRequestSchema.safeParse({ ...ask, plan: { ...plan, goals: [] } }).success).toBe(false);
    const long = Array.from({ length: 20 }, () => ({ role: "user", content: "x" }));
    expect(askRequestSchema.safeParse({ ...ask, history: long }).success).toBe(false);
  });
});

describe("referencias del profesor a lecciones y ejercicios", () => {
  test("las marcas se convierten en enlaces y el texto se conserva", () => {
    const parts = splitTeacherRefs("Repasa la armadura en [leccion:armaduras] y luego [ejercicio:ritmo].");
    expect(parts).toEqual([
      { type: "text", text: "Repasa la armadura en " },
      { type: "ref", ref: { kind: "lesson", slug: "armaduras", title: "Armaduras y tonalidades" } },
      { type: "text", text: " y luego " },
      { type: "ref", ref: { kind: "exercise", id: "ritmo", title: "Ritmo" } },
      { type: "text", text: "." },
    ]);
  });

  test("admite la tilde y las mayúsculas del modelo", () => {
    const parts = splitTeacherRefs("Mira [Lección: escalas]");
    expect(parts[1]).toEqual({ type: "ref", ref: { kind: "lesson", slug: "escalas", title: "Escalas, intervalos y acordes" } });
  });

  test("una marca a algo que no existe desaparece sin romper el enlace", () => {
    expect(splitTeacherRefs("Ver [leccion:pedal] hoy")).toEqual([
      { type: "text", text: "Ver " },
      { type: "text", text: " hoy" },
    ]);
  });

  test("sin marcas devuelve el texto tal cual, también vacío", () => {
    expect(splitTeacherRefs("Hola")).toEqual([{ type: "text", text: "Hola" }]);
    expect(splitTeacherRefs("")).toEqual([{ type: "text", text: "" }]);
  });

  test("el prompt del chat pide brevedad y enseña la marca con el catálogo", () => {
    const text = askInstructions({ naming: "latino", scoreName: "Arabesque", plan: studyPlanSchema.parse(plan), progress: {}, summary: "" });
    expect(text).toContain("80 palabras");
    expect(text).toContain("[leccion:armaduras]");
    expect(text).toContain("- escalas: Escalas, intervalos y acordes");
    expect(text).toContain("- ritmo: Ritmo");
  });
});
