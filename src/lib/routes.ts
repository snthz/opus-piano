/**
 * Rutas públicas en un solo sitio.
 *
 * Los datos (`lessons.ts`, `exercises.ts`, `glossary.ts`) todavía usan slugs en
 * español mientras las carpetas de `app/` ya están en inglés. Estas funciones
 * traducen unos a otros; cuando los datos pasen a slugs en inglés las tablas
 * dejarán de encontrar coincidencias y el `?? slug` devolverá el valor tal cual,
 * así que seguirán siendo correctas y podrán borrarse.
 *
 * Importa: una URL equivocada en el sitemap es una página 404 servida a Google.
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
  piano: "piano",
};

const EXERCISE_SLUGS: Record<string, string> = {
  notas: "notes",
  teclado: "keyboard",
  simbolos: "symbols",
  armaduras: "key-signatures",
  ritmo: "rhythm",
  solfeo: "solfege",
  oido: "ear-training",
};

export const lessonPath = (slug: string) => `/theory/${LESSON_SLUGS[slug] ?? slug}`;
export const exercisePath = (id: string) => `/practice/${EXERCISE_SLUGS[id] ?? id}`;

/**
 * Normaliza un enlace guardado en los datos («/teoria/armaduras») a su ruta
 * actual («/theory/key-signatures»). Si ya está en inglés, lo deja igual.
 */
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

/** Categorías del catálogo de símbolos: id de los datos → segmento de URL. */
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
