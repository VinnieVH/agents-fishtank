/**
 * Picks the index of the next visitor to swim by, each as likely as its weight. The one that came last gets only a
 * third of its chance, so the same animal rarely shows up twice in a row.
 */
export const pickVisitor = (weights: number[], last: number, random = Math.random): number => {
  const chances = weights.map((weight, index) => index === last ? weight * .3 : weight);
  let roll = random() * chances.reduce((sum, chance) => sum + chance, 0);
  for (let index = 0; index < chances.length; index++) if ((roll -= chances[index]) < 0) return index;
  return chances.length - 1;
};
