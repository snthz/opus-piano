/** Stable pastel per score: two pieces on the same day read apart at a glance. */
const PASTELS = ["bg-blue", "bg-mint", "bg-peach", "bg-pink", "bg-yellow"] as const;

export function pastelOf(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PASTELS[h % PASTELS.length];
}
