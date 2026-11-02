import { describe, expect, it } from 'vitest';
import { keepClear, reefs } from '../src/art/terrain.ts';

const H = 900;
const ids = (W: number) => reefs(W, H).map(r => r.i);

describe('the reef', () => {
  it('has more reefs in a wider tank', () => {
    expect(ids(800).length).toBeLessThan(ids(1600).length);
    expect(ids(1600).length).toBeLessThan(ids(2560).length);
  });

  it('keeps its reefs as the tank widens, and only adds new ones', () => {
    for (let W = 600; W < 2600; W += 37) {
      const wider = new Set(ids(W + 37));
      expect(ids(W).filter(i => !wider.has(i))).toEqual([]);
    }
  });

  it('keeps the chest clear of the reefs in front', () => {
    for (const W of [700, 1280, 2560]) {
      const clear = keepClear(W);
      for (const r of reefs(W, H)) if (r.row > 0) expect(clear.some(([a, b]) => r.x + r.w / 2 > a && r.x - r.w / 2 < b)).toBe(false);
    }
  });

  it('paints the back row first, then front to back', () => {
    const rows = reefs(2560, H).map(r => r.row);
    expect(rows).toEqual([...rows].sort());
  });

  it('grows the soft corals on their own reef, within the tank', () => {
    for (const r of reefs(2560, H)) for (const c of r.soft) {
      expect(Math.abs(c.x - r.x)).toBeLessThan(r.w / 2);
      expect(c.s).toBeLessThan(H);
    }
  });
});
