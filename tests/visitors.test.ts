import { describe, expect, it } from 'vitest';
import { rng } from '../src/util';
import { pickVisitor } from '../src/visitors';

// whale, shark, orca, manta, dolphins, jellyfish, submarine, kraken (as in src/scene/passersby.ts)
const WEIGHTS = [3, 3, 2, 2.5, 2.5, 3, .6, .1];
const SUB = 6, KRAKEN = 7;
const TOTAL = WEIGHTS.reduce((a, b) => a + b);

describe('pickVisitor', () => {
  it('picks each visitor as often as its weight', () => {
    const random = rng(1), seen = WEIGHTS.map(() => 0), n = 50000;
    for (let i = 0; i < n; i++) seen[pickVisitor(WEIGHTS, -1, random)]++;
    expect(seen[0] / n).toBeCloseTo(3 / TOTAL, 1);
    expect(seen[SUB] / n).toBeGreaterThan(.025);
    expect(seen[SUB] / n).toBeLessThan(.05);
  });

  it('keeps the kraken very rare', () => {
    const random = rng(3), n = 50000;
    let kraken = 0;
    for (let i = 0; i < n; i++) if (pickVisitor(WEIGHTS, -1, random) === KRAKEN) kraken++;
    expect(kraken / n).toBeGreaterThan(.003);
    expect(kraken / n).toBeLessThan(.01);
  });

  it('rarely sends the same visitor twice in a row', () => {
    const random = rng(2);
    let last = -1, repeats = 0;
    for (let i = 0; i < 20000; i++) {
      const next = pickVisitor(WEIGHTS, last, random);
      if (next === last) repeats++;
      last = next;
    }
    expect(repeats / 20000).toBeLessThan(.15);
  });

  it('handles the edges of the random range', () => {
    expect(pickVisitor(WEIGHTS, -1, () => 0)).toBe(0);
    expect(pickVisitor(WEIGHTS, -1, () => .9999999)).toBe(KRAKEN);
  });
});
