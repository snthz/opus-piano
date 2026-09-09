import { z } from "zod";
import { scheduleSchema, STEP_KINDS } from "@/lib/agenda";
import { LESSON_SECTIONS } from "@/data/lessons";
import { EXERCISES } from "@/data/exercises";
import { ALL_KEYS, keyByVex, keyName } from "@/lib/music/keys";
import { eventCode } from "@/lib/music/musicxml-build";
import type { ParsedScore } from "@/lib/music/musicxml";
import { NAMING_SYSTEMS, type NamingSystem } from "@/lib/music/pitch";
import { arr, en, int, nullable, obj, str, type SchemaNode } from "@/lib/plan/schema";

/**
 * Study plan for a score, prepared by Claude with the server's own API key
 * (see `src/lib/server/study-plan.ts`). Holds what the browser (gathers data,
 * shows the plan) and the server (builds the model request, saves the
 * result) share: the plan schema, the score's text summary, and the prompts.
 */

/* ---------- Plan schema (what the model returns and what gets saved) ---------- */

export const LEVELS = ["principiante", "elemental", "intermedio", "avanzado"] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_LABELS: Record<Level, string> = {
  principiante: "Principiante · empiezo a leer",
  elemental: "Elemental · leo despacio, toco piezas fáciles",
  intermedio: "Intermedio · piezas de dificultad media",
  avanzado: "Avanzado",
};

export const HANDS = ["derecha", "izquierda", "separadas", "juntas"] as const;
export const HAND_LABELS: Record<(typeof HANDS)[number], string> = {
  derecha: "Mano derecha",
  izquierda: "Mano izquierda",
  separadas: "Manos separadas",
  juntas: "Manos juntas",
};

const LESSON_SLUGS = LESSON_SECTIONS.flatMap((s) => s.lessons.map((l) => l.slug));
const EXERCISE_IDS = EXERCISES.map((e) => e.id);
/** Every key in short form ("G", "Bb", "F#m"), so the app can draw the piece's scale. */
const KEY_CODES = ALL_KEYS.map((k) => k.vex);

/**
 * The zod caps are a safety net, not a style guide — the prompts and schema
 * descriptions decide how terse the plan is. Kept generous on purpose, since
 * running one line over shouldn't cost the whole plan (and another paid request).
 */
const short = z.string().max(300);
const long = z.string().max(4000);

export const goalSchema = z.object({
  id: z.string().min(1).max(20),
  title: short,
  /** First and last measure; null if the goal isn't about specific measures. */
  from: z.number().int().nullable(),
  to: z.number().int().nullable(),
  hands: z.enum(HANDS).nullable(),
  description: long,
  tips: z.array(long).max(12),
  fingering: long,
  targetTempo: short,
  sessions: z.number().int(),
});

export const studyPlanSchema = z.object({
  title: short,
  composer: short,
  analysis: z.object({
    key: short,
    /** Same key in short form; optional because plans made before it existed read it from `key` instead. */
    keySignature: z.enum(KEY_CODES as [string, ...string[]]).optional(),
    scale: long,
    timeSignature: short,
    tempo: short,
    form: long,
    difficulty: z.enum(LEVELS),
    character: long,
    challenges: z.array(long).max(12),
  }),
  prerequisites: z
    .array(
      z.object({
        title: short,
        description: long,
        lesson: z.enum(LESSON_SLUGS as [string, ...string[]]).nullable(),
        exercise: z.enum(EXERCISE_IDS as [string, ...string[]]).nullable(),
      }),
    )
    .max(15),
  warmups: z.array(long).max(10),
  goals: z.array(goalSchema).min(1).max(30),
  routine: z.object({
    sessionMinutes: z.number().int(),
    weeks: z.number().int(),
    /** `kind` is optional for plans made before it existed; those get sorted by wording. */
    blocks: z.array(z.object({ minutes: z.number().int(), activity: long, kind: z.enum(STEP_KINDS).optional() })).max(10),
    advice: long,
  }),
});

export type StudyPlan = z.infer<typeof studyPlanSchema>;
export type Goal = z.infer<typeof goalSchema>;

/** What's saved with the score (locally and on the account). */
export const planStateSchema = z.object({
  plan: studyPlanSchema,
  /** Completed goals: { "<goalId>": true } */
  progress: z.record(z.string().max(20), z.boolean()),
  model: z.string().max(80),
  createdAt: z.number().int().positive(),
  /**
   * Study schedule, once the routine is added to the agenda. Lives here
   * rather than as its own score field so it syncs to the account the same
   * way the plan does, and gets deleted with it.
   */
  schedule: scheduleSchema.optional(),
});
export type PlanState = z.infer<typeof planStateSchema>;

export const STUDY_PLAN_SCHEMA: SchemaNode = obj({
  title: str("Nombre de la pieza tal como aparece en la partitura"),
  composer: str("Compositor; cadena vacía si no consta"),
  analysis: obj({
    key: str("Tonalidad, p. ej. «Sol mayor»"),
    keySignature: en(KEY_CODES, "La misma tonalidad en cifrado corto: mayores C, G, D, A, E, B, F#, C#, F, Bb, Eb, Ab, Db, Gb, Cb; menores con «m»: Am, Em, Bm, F#m, C#m, G#m, D#m, A#m, Dm, Gm, Cm, Fm, Bbm, Ebm, Abm"),
    scale: str("Qué escala y arpegio conviene dominar para esta pieza, y por qué. Una o dos frases"),
    timeSignature: str("Compás, p. ej. «3/4»"),
    tempo: str("Tempo de la pieza y tempo de estudio inicial, p. ej. «♩ = 120 (Allegro); empezar a ♩ = 60»"),
    form: str("Estructura por secciones con sus compases, p. ej. «A (c. 1-8), A' (c. 9-16), B (c. 17-24)». Solo eso, sin comentario"),
    difficulty: en(LEVELS),
    character: str("Carácter de la pieza. Una o dos frases"),
    challenges: arr(str("Una dificultad concreta en una línea, con sus compases"), "De 3 a 5 dificultades, las que de verdad cuestan"),
  }),
  prerequisites: arr(
    obj({
      title: str("Nombre corto, p. ej. «Escala de sol mayor»"),
      description: str("Qué practicar y cómo. Una o dos frases"),
      lesson: nullable(en(LESSON_SLUGS), "Lección de Opus Piano relacionada, o null"),
      exercise: nullable(en(EXERCISE_IDS), "Ejercicio de Opus Piano relacionado, o null"),
    }),
    "De 3 a 5: lo que hace falta tener a punto para esta pieza en concreto",
  ),
  warmups: arr(str("Un calentamiento en una línea"), "De 2 a 3 calentamientos breves, adaptados a la pieza"),
  goals: arr(
    obj({
      id: str("Identificador corto y único, p. ej. «g1», «g2»…"),
      title: str("Qué se consigue, en pocas palabras"),
      from: nullable(int(), "Primer compás del objetivo (numeración de la partitura) o null"),
      to: nullable(int(), "Último compás del objetivo o null"),
      hands: nullable(en(HANDS)),
      description: str("Cómo trabajar este tramo. Dos o tres frases, sin repetir lo que ya dicen los consejos"),
      tips: arr(str("Un consejo en una línea"), "De 2 a 4 consejos concretos: ritmo, lectura, articulación, pedal, memoria…"),
      fingering: str("Digitaciones de los pasos difíciles de este tramo (MD/MI, dedos 1-5), o cadena vacía si no hace falta"),
      targetTempo: str("Cuándo se da por cumplido, p. ej. «♩ = 72 sin errores 3 veces seguidas»"),
      sessions: int("Sesiones de estudio estimadas"),
    }),
    "De 5 a 9 objetivos ordenados y progresivos. Mejor pocos y bien delimitados que muchos y solapados",
  ),
  routine: obj({
    sessionMinutes: int("Minutos por sesión, coherentes con el tiempo disponible"),
    weeks: int("Semanas estimadas para completar el plan"),
    blocks: arr(
      obj({
        kind: en(STEP_KINDS, "calentamiento: escala y arpegio (la app los enseña con su digitación). objetivo: trabajo del objetivo del día. repaso: tocar de seguido lo aprendido"),
        minutes: int(),
        activity: str("Qué se hace en ese bloque, en una línea"),
      }),
      "De 3 a 4 bloques para repartir una sesión típica: un calentamiento, uno o dos de objetivo y un repaso",
    ),
    advice: str("Lo que de verdad marca la diferencia al estudiar esta pieza. Dos o tres frases"),
  }),
});

/* ---------- Score summary for the model ---------- */

export const SUMMARY_MAX_CHARS = 100_000;

/**
 * Compact text with everything the app knows about a MusicXML: header, then
 * each staff's notes measure by measure. Deterministic, so the chat can
 * regenerate it without saving it.
 */
export function summarizeScore(parsed: ParsedScore): string {
  const key = keyByVex(parsed.keyVex);
  const staffLabel = (i: number) => (parsed.clefs.length > 1 ? (i === 0 ? "MD" : "MI") : "P");
  const lines = [
    `Título: ${parsed.title || "(sin título en el archivo)"}`,
    `Tonalidad (por la armadura): ${keyName(key, "latino")} / ${keyName(key, "anglosajon")}`,
    `Compás: ${parsed.time.num}/${parsed.time.den}`,
    `Tempo indicado: ${parsed.tempo ? `♩ = ${parsed.tempo}` : "no consta"}`,
    `Pentagramas: ${parsed.clefs.map((c, i) => `${staffLabel(i)} en clave de ${c === "bass" ? "fa" : c === "alto" ? "do" : "sol"}`).join(", ")}`,
    `Compases: ${parsed.measures.length}`,
    "Notación: nombres anglosajones con octava científica (C4 = do central), alteraciones reales ya aplicadas. " +
      "«|:» y «:|» son barras de repetición y «[1.]», «[2.]» las casillas de repetición. " +
      "Duración tras la barra: w redonda, h blanca, q negra, 8 corchea, 16 semicorchea, 32 fusa; «.» puntillo; r silencio; " +
      "acordes entre paréntesis; «~» ligadura de unión con la nota siguiente. Solo la voz principal de cada pentagrama.",
    "",
  ];
  let text = lines.join("\n");
  for (const m of parsed.measures) {
    const staves = m.staves.map((events, i) => `${staffLabel(i)}: ${events.map(eventCode).join(" ") || "-"}`);
    const marks = `${m.ending ? ` [${m.ending}.]` : ""}${m.repeatStart ? " |:" : ""}`;
    const line = `c${m.number}${marks} | ${staves.join(" | ")}${m.repeatEnd ? " :|" : ""}\n`;
    if (text.length + line.length > SUMMARY_MAX_CHARS) {
      text += `… (la partitura sigue hasta el compás ${parsed.measures[parsed.measures.length - 1].number}; se omite el resto por longitud)\n`;
      break;
    }
    text += line;
  }
  return text;
}

/* ---------- PDF pages the model sees ---------- */

/** Pages sent as images (the first ones). */
export const MAX_PAGES = 12;

/**
 * Long side (px) each page is rendered at. Images are most of what a plan
 * costs — Anthropic charges roughly width×height/750 tokens per image, and
 * the server pays: at 1568 px an A4 runs ~2300 tokens, so twelve pages land
 * around 28,000. Going up to the model's max of 2576 nearly triples that for
 * detail that doesn't change the plan on a printed score.
 */
export const PAGE_EDGE = 1568;

/* ---------- What the browser sends the server ---------- */

/** Student's notes and personal goal: plenty of room, and caps what reaches the model. */
const NOTES_MAX_CHARS = 4_000;
const GOAL_MAX_CHARS = 1_000;

export const planRequestSchema = z.object({
  level: z.enum(LEVELS),
  minutesPerDay: z.number().int().min(5).max(240),
  daysPerWeek: z.number().int().min(1).max(7),
  goal: z.string().max(GOAL_MAX_CHARS),
  naming: z.enum(NAMING_SYSTEMS),
  scoreName: z.string().max(300),
  notes: z.string().max(NOTES_MAX_CHARS),
  summary: z.string().max(SUMMARY_MAX_CHARS + 200),
  /** How many PDF pages are attached, and how many it has. */
  pages: z.object({ sent: z.number().int().min(0), total: z.number().int().min(0) }).nullable(),
});
export type PlanRequest = z.infer<typeof planRequestSchema>;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Most recent turns sent; the prompt already carries the plan and score. */
export const HISTORY_TURNS = 12;
const QUESTION_MAX_CHARS = 2_000;

export const askRequestSchema = z.object({
  naming: z.enum(NAMING_SYSTEMS),
  scoreName: z.string().max(300),
  plan: studyPlanSchema,
  progress: z.record(z.string().max(20), z.boolean()),
  summary: z.string().max(SUMMARY_MAX_CHARS + 200),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(QUESTION_MAX_CHARS * 8) }))
    .min(1)
    .max(HISTORY_TURNS),
});

/* ---------- Prompts for the model ---------- */

const namingRule = (naming: NamingSystem) =>
  naming === "latino"
    ? "Nombra las notas y tonalidades en sistema latino (do, re, mi… «Sol mayor», «fa sostenido»)."
    : "Nombra las notas y tonalidades en sistema anglosajón (C, D, E… «G major», «F#»).";

/**
 * What makes a plan useful is fitting in a glance: the student opens it
 * between practice sessions, not to sit and read. Hence this style repeats
 * in both the prompts and the schema descriptions.
 */
const BREVITY =
  "Escribe condensado: frases cortas, una idea por frase y nada de relleno. Prohibido el preámbulo («en esta pieza vamos a…»), " +
  "el elogio y repetir en un campo lo que ya dice otro. Cada consejo cabe en una línea y dice qué hacer, no por qué es importante. " +
  "Si un campo no aporta nada concreto para esta pieza, déjalo lo más corto posible en vez de rellenarlo.";

function catalog(): string {
  const lessons = LESSON_SECTIONS.flatMap((s) => s.lessons.map((l) => `- ${l.slug}: ${l.title} — ${l.summary}`)).join("\n");
  const exercises = EXERCISES.map((e) => `- ${e.id}: ${e.title} — ${e.text}`).join("\n");
  return `Lecciones de teoría de Opus Piano (usa el slug exacto en «lesson»):\n${lessons}\n\nEjercicios de práctica (usa el id exacto en «exercise»):\n${exercises}`;
}

export function planInstructions(req: PlanRequest): string {
  return [
    "Eres profesor o profesora de piano en Opus Piano, una app en español para aprender a leer partituras y tocar el piano. " +
      "Un alumno te pide un plan de estudio para una partitura concreta. Tutea, sé concreto y realista.",
    BREVITY,
    namingRule(req.naming) + " Las digitaciones van con números 1-5 (1 = pulgar) e indica la mano: MD (derecha) o MI (izquierda).",
    "Los compases se numeran como en la partitura (en el resumen, «c12» es el compás 12). No inventes compases que no existan ni contenido que no puedas ver: " +
      "si algo no se distingue bien en las imágenes, dilo en el análisis en lugar de suponerlo.",
    "Construye objetivos progresivos: tramos cortos (frases de 2-8 compases), manos separadas antes que juntas, tempo lento que sube, " +
      "y al final uniones de secciones y pieza completa. Cada objetivo con compases concretos y, en los pasos difíciles, digitaciones.",
    "En «prerequisites», incluye la escala y el arpegio de la tonalidad y los patrones de acompañamiento que aparezcan; enlaza lecciones o ejercicios " +
      "solo cuando existan en el catálogo y de verdad vengan al caso.",
    "La rutina y el número de sesiones deben ser coherentes con el tiempo disponible del alumno. Cada sesión de estudio sigue los bloques de la rutina " +
      "con un cronómetro; en el bloque de calentamiento la app enseña sola la escala y el arpegio de la tonalidad con su digitación habitual, " +
      "así que ahí basta con decir cómo tocarlos (manos separadas, tempo, octavas), no qué notas son.",
    "",
    catalog(),
  ].join("\n");
}

export function planUserMessage(req: PlanRequest): string {
  const parts = [
    `Partitura: «${req.scoreName}».`,
    `Nivel del alumno: ${req.level}. Tiempo disponible: ${req.minutesPerDay} minutos al día, ${req.daysPerWeek} días por semana.`,
    req.goal.trim() ? `Objetivo personal del alumno: ${req.goal.trim()}` : "El alumno no ha indicado un objetivo concreto: quiere aprender la pieza entera.",
    req.notes.trim() ? `Notas personales del alumno sobre la partitura: ${req.notes.trim()}` : "",
  ];
  if (req.pages) {
    parts.push(
      req.pages.sent < req.pages.total
        ? `Se adjuntan las páginas 1 a ${req.pages.sent} del PDF (de ${req.pages.total}); el resto no se ve.`
        : `Se adjuntan las ${req.pages.total} páginas del PDF de la partitura.`,
    );
  }
  if (req.summary) parts.push("", "Contenido de la partitura (MusicXML):", req.summary);
  else if (!req.pages) parts.push("No hay contenido musical disponible: elabora el plan a partir del nombre de la pieza y avisa de esa limitación.");
  return parts.filter((p) => p !== "").join("\n");
}

export interface AskContext {
  naming: NamingSystem;
  scoreName: string;
  plan: StudyPlan;
  progress: Record<string, boolean>;
  summary: string;
}

export function askInstructions(ctx: AskContext): string {
  const done = ctx.plan.goals.filter((g) => ctx.progress[g.id]).map((g) => g.id);
  return [
    "Eres profesor o profesora de piano en Opus Piano, una app en español para aprender a leer partituras y tocar el piano. " +
      "El alumno estudia una partitura con un plan que tú preparaste y te escribe por chat sobre ella: digitaciones, cómo abordar un pasaje, " +
      "teoría que aparece en la pieza, cómo organizar el estudio. Tutea.",
    "Responde como en un chat: corto y concreto. Lo normal son dos a cuatro frases, y como mucho unas 80 palabras. Una sola idea principal por respuesta; " +
      "si hay más que decir, ofrece seguir en una frase en vez de contarlo todo. Solo cuando pidan pasos u opciones, usa una lista breve con guiones " +
      "(tres o cuatro puntos de una línea). Texto plano: sin Markdown, sin encabezados ni negritas.",
    "Ve al grano: sin saludo, sin preámbulo, sin resumir la pregunta ni repetir lo que ya pone en el plan salvo que te lo pidan, y sin cierre de cortesía.",
    namingRule(ctx.naming) + " Digitaciones con números 1-5 (1 = pulgar), indicando MD o MI. Los compases se numeran como en la partitura.",
    "Si preguntan algo que no puedes saber con la información disponible, dilo en una frase.",
    "Cuando una lección o un ejercicio de Opus Piano ayude de verdad con lo preguntado, remite a él escribiendo en el texto la marca " +
      `${REF_EXAMPLE_LESSON} o ${REF_EXAMPLE_EXERCISE} con el slug o id exactos del catálogo: la app la convierte en un enlace, así que no escribas el título al lado. ` +
      "Como mucho una o dos marcas por respuesta, y ninguna si no viene al caso.",
    "",
    `Partitura: «${ctx.scoreName}».`,
    `Plan de estudio (JSON): ${JSON.stringify(ctx.plan)}`,
    done.length ? `Objetivos ya cumplidos: ${done.join(", ")}.` : "Todavía no ha cumplido ningún objetivo.",
    ctx.summary ? `\nContenido de la partitura (MusicXML):\n${ctx.summary}` : "\nNo se dispone del contenido nota a nota de la partitura (solo del plan).",
    "",
    catalog(),
  ].join("\n");
}

/* ---------- References to the site in the teacher's answers ---------- */

const REF_EXAMPLE_LESSON = "[leccion:armaduras]";
const REF_EXAMPLE_EXERCISE = "[ejercicio:ritmo]";
/** `[leccion:slug]` / `[ejercicio:id]`, accent-tolerant; the model was shown the plain form. */
const REF_RE = /\[(lecci[oó]n|ejercicio):\s*([a-z0-9-]+)\s*\]/gi;

export type TeacherRef = { kind: "lesson"; slug: string; title: string } | { kind: "exercise"; id: string; title: string };
export type TeacherPart = { type: "text"; text: string } | { type: "ref"; ref: TeacherRef };

/**
 * Splits an answer into plain text and the site references it cites, so the
 * chat can render them as links. A mark naming something not in the catalog
 * is dropped from the text: a broken link would be worse than nothing.
 */
export function splitTeacherRefs(text: string): TeacherPart[] {
  const parts: TeacherPart[] = [];
  let last = 0;
  for (const m of text.matchAll(REF_RE)) {
    const before = text.slice(last, m.index);
    const ref = lookupRef(m[1].toLowerCase().startsWith("lecci") ? "lesson" : "exercise", m[2].toLowerCase());
    if (before) parts.push({ type: "text", text: before });
    if (ref) parts.push({ type: "ref", ref });
    last = m.index + m[0].length;
  }
  const tail = text.slice(last);
  if (tail || !parts.length) parts.push({ type: "text", text: tail });
  return parts;
}

function lookupRef(kind: "lesson" | "exercise", key: string): TeacherRef | null {
  if (kind === "lesson") {
    const lesson = LESSON_SECTIONS.flatMap((s) => s.lessons).find((l) => l.slug === key);
    return lesson ? { kind, slug: lesson.slug, title: lesson.title } : null;
  }
  const exercise = EXERCISES.find((e) => e.id === key);
  return exercise ? { kind, id: exercise.id, title: exercise.title } : null;
}

/** Short chips for a goal: ["Compases 5-8", "Manos separadas"]. */
export function goalChips(g: Goal): string[] {
  const parts: string[] = [];
  if (g.from !== null && g.to !== null) parts.push(g.from === g.to ? `Compás ${g.from}` : `Compases ${g.from}-${g.to}`);
  else if (g.from !== null) parts.push(`Desde el compás ${g.from}`);
  if (g.hands) parts.push(HAND_LABELS[g.hands]);
  return parts;
}

/** Short text for a goal's range: "Compases 5-8 · Manos separadas". */
export const goalRange = (g: Goal): string => goalChips(g).join(" · ");

/** Goal ids must be unique; renumbered if the model repeats one. */
export function dedupeGoalIds(plan: StudyPlan): StudyPlan {
  const seen = new Set<string>();
  const goals = plan.goals.map((g, i) => {
    const id = seen.has(g.id) || !g.id ? `g${i + 1}` : g.id;
    seen.add(id);
    return { ...g, id };
  });
  return { ...plan, goals };
}
