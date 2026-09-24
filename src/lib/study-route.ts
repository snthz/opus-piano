import { z } from "zod";
import { arr, en, int, nullable, obj, str, type SchemaNode } from "@/lib/plan/schema";

/**
 * A study route: the pieces to learn, in order, plus the daily routine, the
 * goals by horizon and the notes that explain the why. It is the student's
 * own plan (or their teacher's), not something the app derives — the app only
 * keeps it, links each piece to a score in the library and marks progress.
 *
 * Distinct from the per-score study plan (`study-plan.ts`, made by the AI for
 * one piece) and from the course path (`data/path.ts`, the lessons in order).
 *
 * Stored whole as a JSON document, locally (IndexedDB) and on the account.
 * Small enough that syncing the document as a unit is simpler and safer than
 * syncing its parts.
 */

const short = z.string().max(300);
const long = z.string().max(6000);
/** "2026-09-24", or null when not set. */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export const PIECE_KINDS = ["core", "side"] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];
export const PIECE_KIND_LABELS: Record<PieceKind, string> = {
  core: "Obligatoria",
  side: "Por gusto",
};

export const routePieceSchema = z.object({
  id: z.string().min(1).max(40),
  title: short,
  /** Catalogue number, collection, composer: "BWV Anh. 114 · Cuaderno de A. M. Bach". */
  detail: short,
  /** What it develops: the reason this piece is on the route. */
  why: long,
  /** "3–4 sem.", as text: the estimate is a hint, not a deadline to compute with. */
  estimate: short,
  /** A short tag the plan gives the piece: "entrada", "reto", "meta". */
  tag: z.string().max(30),
  /** Core pieces go in order; side pieces run in parallel, for the joy of it. */
  kind: z.enum(PIECE_KINDS),
  /** Score in the library, once linked. */
  scoreId: z.string().max(64).nullable(),
  /** Piece in the app's catalogue, when the route knows it's there: one tap to add it. */
  catalogId: z.string().max(64).nullable(),
  done: z.boolean(),
  startedAt: day,
  doneAt: day,
});
export type RoutePiece = z.infer<typeof routePieceSchema>;

export const routineBlockSchema = z.object({
  id: z.string().min(1).max(40),
  minutes: z.number().int().min(1).max(240),
  title: short,
  content: long,
});
export type RoutineBlock = z.infer<typeof routineBlockSchema>;

export const routeGoalSchema = z.object({
  id: z.string().min(1).max(40),
  /** "1 mes", "3 meses"… Goals are grouped by it, in the order they first appear. */
  horizon: short,
  title: long,
  done: z.boolean(),
});
export type RouteGoal = z.infer<typeof routeGoalSchema>;

export const MAX_PIECES = 60;
export const MAX_BLOCKS = 12;
export const MAX_GOALS = 80;

/** What is saved (and what the account receives). */
export const studyRouteSchema = z.object({
  id: z.string().min(1).max(64),
  name: short.min(1),
  /** The one-line aim: "Principiante avanzado → intermedio temprano". */
  level: short,
  /** Why this route and what it wants to reach. */
  goal: long,
  /** "60 min · 6 días/sem." */
  practice: short,
  startDate: day,
  pieces: z.array(routePieceSchema).max(MAX_PIECES),
  routine: z.array(routineBlockSchema).max(MAX_BLOCKS),
  goals: z.array(routeGoalSchema).max(MAX_GOALS),
  /** Everything else the plan says: principles, material, rules. Free text. */
  notes: long,
  archived: z.boolean(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type StudyRoute = z.infer<typeof studyRouteSchema>;

/** The document plus what only the device knows about it. */
export interface StudyRouteRecord extends StudyRoute {
  /** When the server confirmed it has this version. */
  syncedAt?: number;
}

/** Strips the local-only fields before the document travels. */
export function routeDocument(r: StudyRouteRecord): StudyRoute {
  const { syncedAt: _synced, ...doc } = r;
  void _synced;
  return doc;
}

/* ---------- Building ---------- */

const uid = () => crypto.randomUUID().slice(0, 8);

export type RouteDraft = Partial<Omit<StudyRoute, "id" | "createdAt" | "updatedAt">> & { name: string };

export function newRoute(draft: RouteDraft, now = Date.now()): StudyRoute {
  return {
    id: crypto.randomUUID(),
    name: draft.name,
    level: draft.level ?? "",
    goal: draft.goal ?? "",
    practice: draft.practice ?? "",
    startDate: draft.startDate ?? null,
    pieces: draft.pieces ?? [],
    routine: draft.routine ?? [],
    goals: draft.goals ?? [],
    notes: draft.notes ?? "",
    archived: draft.archived ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

export function newPiece(p: Partial<RoutePiece> & { title: string }): RoutePiece {
  return {
    id: p.id ?? uid(),
    title: p.title,
    detail: p.detail ?? "",
    why: p.why ?? "",
    estimate: p.estimate ?? "",
    tag: p.tag ?? "",
    kind: p.kind ?? "core",
    scoreId: p.scoreId ?? null,
    catalogId: p.catalogId ?? null,
    done: p.done ?? false,
    startedAt: p.startedAt ?? null,
    doneAt: p.doneAt ?? null,
  };
}

export const newBlock = (b: Partial<RoutineBlock> & { title: string }): RoutineBlock => ({
  id: b.id ?? uid(),
  minutes: b.minutes ?? 10,
  title: b.title,
  content: b.content ?? "",
});

export const newGoal = (g: Partial<RouteGoal> & { title: string }): RouteGoal => ({
  id: g.id ?? uid(),
  horizon: g.horizon ?? "",
  title: g.title,
  done: g.done ?? false,
});

/* ---------- Reading ---------- */

export const corePieces = (r: StudyRoute) => r.pieces.filter((p) => p.kind === "core");
export const sidePieces = (r: StudyRoute) => r.pieces.filter((p) => p.kind === "side");

/** The piece in hand: the first core piece not yet done. */
export function currentPiece(r: StudyRoute): RoutePiece | null {
  return corePieces(r).find((p) => !p.done) ?? null;
}

export function routeProgress(r: StudyRoute): { done: number; total: number } {
  const core = corePieces(r);
  return { done: core.filter((p) => p.done).length, total: core.length };
}

/** Goals grouped by horizon, horizons in order of first appearance. */
export function goalsByHorizon(r: StudyRoute): { horizon: string; goals: RouteGoal[] }[] {
  const groups: { horizon: string; goals: RouteGoal[] }[] = [];
  for (const g of r.goals) {
    let group = groups.find((x) => x.horizon === g.horizon);
    if (!group) groups.push((group = { horizon: g.horizon, goals: [] }));
    group.goals.push(g);
  }
  return groups;
}

export const routineMinutes = (r: StudyRoute) => r.routine.reduce((n, b) => n + b.minutes, 0);

/* ---------- Editing (pure: return a new route, `updatedAt` untouched — the store sets it) ---------- */

export function patchPiece(r: StudyRoute, pieceId: string, changes: Partial<RoutePiece>): StudyRoute {
  return { ...r, pieces: r.pieces.map((p) => (p.id === pieceId ? { ...p, ...changes } : p)) };
}

/**
 * Ticks a piece as done (or undoes it). Dates are kept for the record the
 * plan asks for: when it started and when it was finished.
 */
export function setPieceDone(r: StudyRoute, pieceId: string, done: boolean, today: string): StudyRoute {
  return patchPiece(r, pieceId, done ? { done: true, doneAt: today, startedAt: r.pieces.find((p) => p.id === pieceId)?.startedAt ?? today } : { done: false, doneAt: null });
}

export function movePiece(r: StudyRoute, pieceId: string, dir: -1 | 1): StudyRoute {
  const i = r.pieces.findIndex((p) => p.id === pieceId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= r.pieces.length) return r;
  const pieces = [...r.pieces];
  [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  return { ...r, pieces };
}

export const removePiece = (r: StudyRoute, pieceId: string): StudyRoute => ({ ...r, pieces: r.pieces.filter((p) => p.id !== pieceId) });

/** Unlinks a score from every piece that pointed at it (the score was deleted). */
export function forgetScore(r: StudyRoute, scoreId: string): StudyRoute {
  if (!r.pieces.some((p) => p.scoreId === scoreId)) return r;
  return { ...r, pieces: r.pieces.map((p) => (p.scoreId === scoreId ? { ...p, scoreId: null } : p)) };
}

/* ---------- Import (the model reads a plan written as text and returns this) ---------- */

/** Pasted plans longer than this are cut: a study plan is a few pages, not a book. */
export const IMPORT_TEXT_MAX = 60_000;

export const importRequestSchema = z.object({
  text: z.string().trim().min(40, { error: "El texto es demasiado corto para ser un plan de estudio." }).max(IMPORT_TEXT_MAX, { error: "El texto es demasiado largo. Pega solo el plan." }),
});

/** What the model must return: the route without ids, dates or progress, which the app adds. */
export const ROUTE_IMPORT_SCHEMA: SchemaNode = obj({
  name: str("Título corto del plan (máx. 60 caracteres)"),
  level: str("Nivel de partida y de llegada, en una línea; cadena vacía si no consta"),
  goal: str("El objetivo del plan en una o dos frases; cadena vacía si no consta"),
  practice: str("Tiempo de práctica previsto, p. ej. «60 min · 6 días/sem.»; cadena vacía si no consta"),
  pieces: arr(
    obj({
      title: str("Nombre de la pieza"),
      detail: str("Número de catálogo, colección y compositor, p. ej. «BWV Anh. 114 · Cuaderno de A. M. Bach»; cadena vacía si no consta"),
      why: str("Qué desarrolla o por qué está en la ruta; cadena vacía si no consta"),
      estimate: str("Tiempo estimado tal como lo dice el plan, p. ej. «3–4 sem.»; cadena vacía si no consta"),
      tag: str("Etiqueta corta que el plan le da (entrada, actual, reto, meta…); cadena vacía si no tiene"),
      kind: en(PIECE_KINDS, "«core» si es del repertorio obligatorio en orden; «side» si es una pieza de gusto en paralelo"),
      done: en(["yes", "no"], "«yes» solo si el plan la marca como ya terminada"),
    }),
    "Las piezas en el orden en que el plan las presenta. Solo piezas concretas, no libros de ejercicios (Beyer, Czerny, Hanon van en las notas)",
  ),
  routine: arr(
    obj({
      minutes: int("Minutos del bloque; con un rango («5–10 min») el valor mayor"),
      title: str("Nombre del bloque: Técnica, Lectura a primera vista…"),
      content: str("Qué se hace en ese bloque"),
    }),
    "La rutina diaria, en orden; vacío si el plan no la tiene",
  ),
  goals: arr(
    obj({
      horizon: str("Plazo del objetivo tal como lo dice el plan: «1 mes», «3 meses», «12 meses»…"),
      title: str("El objetivo, en una línea"),
    }),
    "Los objetivos por plazo, en orden; vacío si el plan no los tiene",
  ),
  notes: nullable(
    str("Todo lo demás que importa del plan, en Markdown ligero (títulos con ##, listas con -): principios, material y dónde entrar, protocolo de trabajo, escalas, teoría, reglas de lectura. Fiel al texto, sin inventar"),
  ),
});

export function importInstructions(): string {
  return [
    "Eres el asistente de Opus Piano, una app en español para aprender piano.",
    "Recibes un plan de estudio de piano escrito como texto (a menudo extraído de un PDF, con el orden de columnas revuelto) y lo conviertes a la estructura pedida, sin añadir nada que el plan no diga.",
    "Las piezas de repertorio van en `pieces` en el orden del plan. Los métodos y libros de ejercicios (Beyer, Czerny, Hanon) no son piezas: van en `notes`.",
    "Escribe todo en español. Conserva los nombres de las piezas y sus números de catálogo tal como aparecen.",
  ].join("\n");
}

/** What the model returns, checked before it becomes a route. */
export const importedRouteSchema = z.object({
  name: short.min(1),
  level: short,
  goal: long,
  practice: short,
  pieces: z
    .array(
      z.object({
        title: short.min(1),
        detail: short,
        why: long,
        estimate: short,
        tag: z.string().max(30),
        kind: z.enum(PIECE_KINDS),
        done: z.enum(["yes", "no"]),
      }),
    )
    .max(MAX_PIECES),
  routine: z.array(z.object({ minutes: z.number().int().min(1).max(240), title: short.min(1), content: long })).max(MAX_BLOCKS),
  goals: z.array(z.object({ horizon: short, title: long.min(1) })).max(MAX_GOALS),
  notes: long.nullable(),
});
export type ImportedRoute = z.infer<typeof importedRouteSchema>;

/** "actual" is what the route works out by itself; as a stored tag it would go stale. */
const cleanTag = (tag: string) => {
  const t = tag.trim().toLowerCase();
  return t === "actual" ? "" : t;
};

/** Turns what the model returned into a route the app can keep. */
export function routeFromImport(imp: ImportedRoute, today: string, now = Date.now()): StudyRoute {
  return newRoute(
    {
      name: imp.name,
      level: imp.level,
      goal: imp.goal,
      practice: imp.practice,
      startDate: today,
      pieces: imp.pieces.map((p) => newPiece({ ...p, tag: cleanTag(p.tag), done: p.done === "yes", doneAt: p.done === "yes" ? today : null })),
      routine: imp.routine.map((b) => newBlock(b)),
      goals: imp.goals.map((g) => newGoal(g)),
      notes: (imp.notes ?? "").trim(),
    },
    now,
  );
}
