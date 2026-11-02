/**
 * Picks the index of the next visitor to swim by, each as likely as its weight. The one that came last gets only a
 * third of its chance, so the same animal rarely shows up twice in a row.
 */
export function pickVisitor(weights: number[], last: number, random = Math.random): number {
  const w = weights.map((x, i) => i === last ? x * .3 : x);
  let r = random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) if ((r -= w[i]) < 0) return i;
  return w.length - 1;
}
