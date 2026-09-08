import { z } from "zod";
import { LESSON_SECTIONS } from "@/data/lessons";
import { EXERCISES } from "@/data/exercises";
import { keyByVex, keyName } from "@/lib/music/keys";
import { eventCode } from "@/lib/music/musicxml-build";
import type { ParsedScore } from "@/lib/music/musicxml";
import { NAMING_SYSTEMS, type NamingSystem } from "@/lib/music/pitch";
import { arr, en, int, nullable, obj, str, type SchemaNode } from "@/lib/plan/schema";

/**
 * Plan de estudio de una partitura, preparado por Claude con la clave de API
 * del servidor (ver `src/lib/server/study-plan.ts`). Aquí vive todo lo que
 * comparten el navegador —que reúne los datos y enseña el plan— y el servidor
 * —que arma la petición al modelo y guarda el resultado—: el esquema del plan,
 * el resumen textual de la partitura y las instrucciones.
 */

/* ---------- Esquema del plan (lo que devuelve el modelo y lo que se guarda) ---------- */

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

/**
 * Los topes de zod son una red de seguridad, no el estilo: quien decide lo
 * corto que sale el plan son las instrucciones y las descripciones del esquema.
 * Van holgados a propósito, porque pasarse de una línea no puede costar el plan
 * entero (y otra petición pagada) por un consejo de más.
 */
const short = z.string().max(300);
const long = z.string().max(4000);

export const goalSchema = z.object({
  id: z.string().min(1).max(20),
  title: short,
  /** Primer y último compás; null si el objetivo no va de compases concretos */
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
    blocks: z.array(z.object({ minutes: z.number().int(), activity: long })).max(10),
    advice: long,
  }),
});

export type StudyPlan = z.infer<typeof studyPlanSchema>;
export type Goal = z.infer<typeof goalSchema>;

/** Lo que se guarda con la partitura (local y en la cuenta). */
export const planStateSchema = z.object({
  plan: studyPlanSchema,
  /** Objetivos cumplidos: { "<goalId>": true } */
  progress: z.record(z.string().max(20), z.boolean()),
  model: z.string().max(80),
  createdAt: z.number().int().positive(),
});
export type PlanState = z.infer<typeof planStateSchema>;

export const STUDY_PLAN_SCHEMA: SchemaNode = obj({
  title: str("Nombre de la pieza tal como aparece en la partitura"),
  composer: str("Compositor; cadena vacía si no consta"),
  analysis: obj({
    key: str("Tonalidad, p. ej. «Sol mayor»"),
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
    blocks: arr(obj({ minutes: int(), activity: str("Qué se hace en ese bloque, en una línea") }), "De 3 a 4 bloques para repartir una sesión típica"),
    advice: str("Lo que de verdad marca la diferencia al estudiar esta pieza. Dos o tres frases"),
  }),
});

/* ---------- Resumen de la partitura para el modelo ---------- */

export const SUMMARY_MAX_CHARS = 100_000;

/**
 * Texto compacto con todo lo que sabe la app de un MusicXML: cabecera y, compás
 * a compás, las notas de cada pentagrama. Es determinista, así que el chat
 * puede regenerarlo sin guardarlo.
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

/* ---------- Páginas del PDF que ve el modelo ---------- */

/** Páginas que se envían como imagen (las primeras). */
export const MAX_PAGES = 12;

/**
 * Lado largo (px) al que se dibuja cada página. Las imágenes son la mayor parte
 * de lo que cuesta un plan —Anthropic cuenta unos ancho×alto/750 tokens por
 * imagen— y aquí paga el servidor, no el alumno: a 1568 px una A4 sale por unos
 * 2300 tokens, así que las doce páginas rondan los 28 000. Subirlo a los 2576
 * que admite el modelo casi triplica esa cuenta a cambio de un detalle que en
 * una partitura impresa no cambia el plan.
 */
export const PAGE_EDGE = 1568;

/* ---------- Lo que el navegador manda al servidor ---------- */

/** Notas y objetivo personal del alumno: caben de sobra y acotan lo que se le pasa al modelo. */
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
  /** Cuántas páginas del PDF se adjuntan y cuántas tiene */
  pages: z.object({ sent: z.number().int().min(0), total: z.number().int().min(0) }).nullable(),
});
export type PlanRequest = z.infer<typeof planRequestSchema>;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Los últimos turnos que se mandan; la instrucción ya lleva el plan y la partitura. */
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

/* ---------- Instrucciones para el modelo ---------- */

const namingRule = (naming: NamingSystem) =>
  naming === "latino"
    ? "Nombra las notas y tonalidades en sistema latino (do, re, mi… «Sol mayor», «fa sostenido»)."
    : "Nombra las notas y tonalidades en sistema anglosajón (C, D, E… «G major», «F#»).";

/**
 * Lo que hace útil un plan es que quepa de un vistazo: el alumno lo abre entre
 * dos sesiones de estudio, no se sienta a leerlo. De ahí que el estilo se
 * repita en las instrucciones y en las descripciones del esquema.
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
    "La rutina y el número de sesiones deben ser coherentes con el tiempo disponible del alumno.",
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
      "El alumno estudia una partitura con un plan que tú preparaste y te hace preguntas sobre ella: digitaciones, cómo abordar un pasaje, " +
      "teoría que aparece en la pieza, cómo organizar el estudio. Tutea, responde de forma breve y concreta (normalmente menos de 150 palabras) " +
      "y en texto plano: sin Markdown ni encabezados; si haces una lista, usa guiones.",
    "Ve al grano: sin preámbulo ni resumen de la pregunta, y sin repetir lo que ya pone en el plan salvo que te lo pidan.",
    namingRule(ctx.naming) + " Digitaciones con números 1-5 (1 = pulgar), indicando MD o MI. Los compases se numeran como en la partitura.",
    "Si preguntan algo que no puedes saber con la información disponible, dilo.",
    "",
    `Partitura: «${ctx.scoreName}».`,
    `Plan de estudio (JSON): ${JSON.stringify(ctx.plan)}`,
    done.length ? `Objetivos ya cumplidos: ${done.join(", ")}.` : "Todavía no ha cumplido ningún objetivo.",
    ctx.summary ? `\nContenido de la partitura (MusicXML):\n${ctx.summary}` : "\nNo se dispone del contenido nota a nota de la partitura (solo del plan).",
  ].join("\n");
}

/** Texto corto del tramo de un objetivo: «Compases 5-8 · Manos separadas». */
export function goalRange(g: Goal): string {
  const parts: string[] = [];
  if (g.from !== null && g.to !== null) parts.push(g.from === g.to ? `Compás ${g.from}` : `Compases ${g.from}-${g.to}`);
  else if (g.from !== null) parts.push(`Desde el compás ${g.from}`);
  if (g.hands) parts.push(HAND_LABELS[g.hands]);
  return parts.join(" · ");
}

/** Los ids de los objetivos deben ser únicos: si el modelo repite alguno, se renumeran. */
export function dedupeGoalIds(plan: StudyPlan): StudyPlan {
  const seen = new Set<string>();
  const goals = plan.goals.map((g, i) => {
    const id = seen.has(g.id) || !g.id ? `g${i + 1}` : g.id;
    seen.add(id);
    return { ...g, id };
  });
  return { ...plan, goals };
}
