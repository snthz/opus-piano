/**
 * Public routes in one place. Data files (`lessons.ts`, `exercises.ts`,
 * `glossary.ts`) still use Spanish slugs while `app/` folders are already in
 * English; these functions translate between them. A wrong URL in the
 * sitemap means a 404 served to Google.
 */

const LESSON_SLUGS: Record<string, string> = {
  pentagrama: "staff",
  claves: "clefs",
  notas: "notes",
  figuras: "note-values",
  compases: "measures",
  simbolos: "symbols",
  armaduras: "key-signatures",
  escalas: "scales",
  postura: "posture",
  piano: "piano",
};

const EXERCISE_SLUGS: Record<string, string> = {
  notas: "notes",
  "primera-vista": "sight-reading",
  teclado: "keyboard",
  simbolos: "symbols",
  armaduras: "key-signatures",
  ritmo: "rhythm",
  solfeo: "solfege",
  oido: "ear-training",
};

export const lessonPath = (slug: string) => `/theory/${LESSON_SLUGS[slug] ?? slug}`;
export const exercisePath = (id: string) => `/practice/${EXERCISE_SLUGS[id] ?? id}`;

/** Normalizes a link saved in the data ("/teoria/armaduras") to its current route; already-English links pass through unchanged. */
export function normalizePath(href: string): string {
  const [, section, slug] = href.split("/");
  if (section === "teoria" || section === "theory") return slug ? lessonPath(slug) : "/theory";
  if (section === "practica" || section === "practice") return slug ? exercisePath(slug) : "/practice";
  if (section === "glosario") return "/glossary";
  if (section === "partituras") return "/scores";
  if (section === "ajustes") return "/settings";
  if (section === "mas") return "/more";
  return href;
}

/** Symbol catalog categories: data id → URL segment. */
export const SYMBOL_CATEGORY_SLUGS: Record<string, string> = {
  claves: "clefs",
  figuras: "note-values",
  silencios: "rests",
  alteraciones: "accidentals",
  compas: "time-signatures",
  dinamicas: "dynamics",
  articulaciones: "articulations",
  adornos: "ornaments",
  repeticiones: "repeats",
  octavas: "octaves",
  pedal: "pedal",
  estructura: "staff-elements",
};

export const symbolCategoryPath = (id: string) => `/symbols/${SYMBOL_CATEGORY_SLUGS[id] ?? id}`;

export function symbolCategoryIdFromSlug(slug: string): string | undefined {
  const entry = Object.entries(SYMBOL_CATEGORY_SLUGS).find(([, value]) => value === slug);
  return entry?.[0] ?? slug;
}
