/**
 * Which question to ask next.
 *
 * Every exercise used to draw at random, so the note you never miss came up
 * as often as the one you always do. Here each item — a note on a staff, a
 * key signature, an interval — keeps its own record and a Leitner box: a miss
 * drops it to the first box and it comes back within the session; a hit moves
 * it up and it goes quiet for days. What is due, and what fails most, is what
 * gets asked.
 *
 * Pure on purpose: no storage and no clock of its own, so it can be tested.
 * The stored side lives in `item-stats.ts`.
 */

export interface ItemStat {
  attempts: number;
  correct: number;
  /** Consecutive hits; a miss resets it to 0. */
  streak: number;
  /** Leitner box: 0 = just missed, MAX_BOX = settled. */
  box: number;
  /** Epoch ms of the last answer. */
  last: number;
  /** Epoch ms from which it is worth asking again. */
  due: number;
}

/** Items of one exercise, by item id. */
export type ItemStats = Record<string, ItemStat>;

/** Minutes each box waits before its item is due again. */
export const BOX_MINUTES = [0, 1, 6, 30, 60 * 24, 60 * 24 * 3, 60 * 24 * 7];
export const MAX_BOX = BOX_MINUTES.length - 1;

/** Weight of an item never asked before: above a settled one, below a failed one. */
const NEW_WEIGHT = 2.5;
/** Weight of an item that is not due yet; small, but never zero (variety). */
const EARLY_WEIGHT = 0.15;

export function emptyStat(now = 0): ItemStat {
  return { attempts: 0, correct: 0, streak: 0, box: 0, last: 0, due: now };
}

/**
 * Hit rate with a Laplace prior, so three hits out of three don't read as
 * mastery and the weighting stays sane on tiny samples.
 */
export function accuracy(stat: ItemStat | undefined): number {
  if (!stat) return 0.5;
  return (stat.correct + 1) / (stat.attempts + 2);
}

/** The item's record after one answer. */
export function applyAnswer(stat: ItemStat | undefined, correct: boolean, now: number): ItemStat {
  const prev = stat ?? emptyStat(now);
  // A miss doesn't reset all the way to 0 once the item has been learnt: it
  // steps back one box, which is what keeps a single slip from re-teaching
  // something already known.
  const box = correct ? Math.min(MAX_BOX, prev.box + 1) : Math.max(0, prev.box - 1);
  return {
    attempts: prev.attempts + 1,
    correct: prev.correct + (correct ? 1 : 0),
    streak: correct ? prev.streak + 1 : 0,
    box,
    last: now,
    due: now + BOX_MINUTES[box] * 60_000,
  };
}

/** How much an item deserves to be asked right now. */
export function weight(stat: ItemStat | undefined, now: number): number {
  if (!stat || stat.attempts === 0) return NEW_WEIGHT;
  if (now < stat.due) return EARLY_WEIGHT;
  // What fails most weighs most; on top of that, the further from settled the
  // heavier, so a due item in box 1 beats a due item in box 5.
  const base = 1 + 4 * (1 - accuracy(stat));
  return base + ((MAX_BOX - stat.box) / MAX_BOX) * 1.5;
}

export interface ChooseOptions {
  now: number;
  /** Item id not to repeat (the previous question); ignored if it's the only one. */
  exclude?: string;
  /** Injectable for tests; returns [0, 1). */
  rng?: () => number;
}

/**
 * Weighted draw over a pool of candidates. Everything keeps a chance of
 * coming up — an exercise that only ever showed your three worst notes would
 * be unbearable — but the weak ones come up several times as often.
 */
export function chooseItem<T>(
  pool: readonly T[],
  keyOf: (item: T) => string,
  stats: ItemStats,
  { now, exclude, rng = Math.random }: ChooseOptions,
): T {
  if (!pool.length) throw new Error("chooseItem: pool vacía");
  const candidates = pool.length > 1 && exclude !== undefined ? pool.filter((i) => keyOf(i) !== exclude) : [...pool];
  const list = candidates.length ? candidates : [...pool];
  const weights = list.map((item) => weight(stats[keyOf(item)], now));
  const total = weights.reduce((a, b) => a + b, 0);
  let target = rng() * total;
  for (let i = 0; i < list.length; i++) {
    target -= weights[i];
    if (target <= 0) return list[i];
  }
  return list[list.length - 1];
}

export interface WeakItem {
  exerciseId: string;
  itemId: string;
  stat: ItemStat;
  /** Hit rate as measured, 0-1 (no prior: this one is for reading, not for weighting). */
  rate: number;
}

/** Answers before an item is worth calling a weak point. */
export const WEAK_MIN_ATTEMPTS = 3;

/**
 * The items that resist most, worst first. Only what has been asked a few
 * times and missed at least once: one slip on the second question isn't a
 * weak point, it's a slip.
 */
export function weakest(all: Record<string, ItemStats>, limit = 6): WeakItem[] {
  const out: WeakItem[] = [];
  for (const [exerciseId, items] of Object.entries(all)) {
    for (const [itemId, stat] of Object.entries(items)) {
      const misses = stat.attempts - stat.correct;
      if (stat.attempts < WEAK_MIN_ATTEMPTS || misses === 0) continue;
      out.push({ exerciseId, itemId, stat, rate: stat.correct / stat.attempts });
    }
  }
  return out
    .sort((a, b) => a.rate - b.rate || b.stat.attempts - a.stat.attempts || a.itemId.localeCompare(b.itemId))
    .slice(0, limit);
}

/** Items of an exercise that are settled (top box) — what no longer needs asking. */
export function settledCount(items: ItemStats): number {
  return Object.values(items).filter((s) => s.box >= MAX_BOX).length;
}
