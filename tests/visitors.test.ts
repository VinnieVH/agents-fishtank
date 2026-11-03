import { describe, expect, it } from 'vitest';
import { rng } from '../src/util';
import { pickVisitor } from '../src/visitors';

// whale, shark, orca, manta, dolphins, jellyfish, submarine, kraken (as in src/scene/passersby.ts)
const WEIGHTS = [3, 3, 2, 2.5, 2.5, 3, .6, .1];
const SUB = 6, KRAKEN = 7;
const TOTAL = WEIGHTS.reduce((sum, weight) => sum + weight);

describe('pickVisitor', () => {
  it('picks each visitor as often as its weight', () => {
    const random = rng(1), seen = WEIGHTS.map(() => 0), draws = 50000;
    for (let draw = 0; draw < draws; draw++) seen[pickVisitor(WEIGHTS, -1, random)]++;
    expect(seen[0] / draws).toBeCloseTo(3 / TOTAL, 1);
    expect(seen[SUB] / draws).toBeGreaterThan(.025);
    expect(seen[SUB] / draws).toBeLessThan(.05);
  });

  it('keeps the kraken very rare', () => {
    const random = rng(3), draws = 50000;
    let kraken = 0;
    for (let draw = 0; draw < draws; draw++) if (pickVisitor(WEIGHTS, -1, random) === KRAKEN) kraken++;
    expect(kraken / draws).toBeGreaterThan(.003);
    expect(kraken / draws).toBeLessThan(.01);
  });

  it('rarely sends the same visitor twice in a row', () => {
    const random = rng(2);
    let last = -1, repeats = 0;
    for (let draw = 0; draw < 20000; draw++) {
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
