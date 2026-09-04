export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Elige un elemento distinto del anterior (si hay más de uno). */
export function pickDifferent<T>(arr: readonly T[], prev: T | undefined, eq: (a: T, b: T) => boolean = (a, b) => a === b): T {
  if (arr.length < 2 || prev === undefined) return pick(arr);
  let next = pick(arr);
  let guard = 0;
  while (eq(next, prev) && guard++ < 20) next = pick(arr);
  return next;
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** n elementos distintos al azar. */
export function sample<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}
