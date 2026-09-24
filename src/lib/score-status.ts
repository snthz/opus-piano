/**
 * Where a score stands in the student's life: still waiting, being worked on,
 * or played through. Three states and no more — the status is set by hand, so
 * it must be obvious which one applies without reading a definition.
 *
 * The values are stored (IndexedDB and the account); the labels are what the
 * student sees and can change without a migration.
 */
export const SCORE_STATUSES = ["pending", "studying", "learned"] as const;
export type ScoreStatus = (typeof SCORE_STATUSES)[number];

export const STATUS_LABELS: Record<ScoreStatus, string> = {
  pending: "Por empezar",
  studying: "En estudio",
  learned: "Dominada",
};

/** Plural, for the library's filter pills ("3 dominadas"). */
export const STATUS_PLURALS: Record<ScoreStatus, string> = {
  pending: "Por empezar",
  studying: "En estudio",
  learned: "Dominadas",
};

export const STATUS_HINTS: Record<ScoreStatus, string> = {
  pending: "Guardada y a la espera de su turno.",
  studying: "La estás trabajando ahora: sale en el inicio para empezar rápido.",
  learned: "A tempo, con partitura y de memoria, sin detenerte.",
};

/** In the order the library shows them: what's in hand first, what's finished last. */
export const STATUS_RANK: Record<ScoreStatus, number> = { studying: 0, pending: 1, learned: 2 };

/**
 * The status of a record, with a guess for those saved before the field
 * existed: a score with a study plan was clearly being worked on; the rest
 * are waiting.
 */
export function scoreStatus(s: { status?: ScoreStatus | null; plan?: unknown }): ScoreStatus {
  if (s.status && SCORE_STATUSES.includes(s.status)) return s.status;
  return s.plan ? "studying" : "pending";
}

export const isScoreStatus = (v: unknown): v is ScoreStatus => typeof v === "string" && (SCORE_STATUSES as readonly string[]).includes(v);

/** Library order: by status, then newest first. Stable for equal keys. */
export function sortByStatus<T extends { status?: ScoreStatus | null; plan?: unknown; addedAt: number }>(scores: T[]): T[] {
  return [...scores].sort((a, b) => STATUS_RANK[scoreStatus(a)] - STATUS_RANK[scoreStatus(b)] || b.addedAt - a.addedAt);
}
