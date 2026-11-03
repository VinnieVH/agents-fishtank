import { describe, expect, it } from 'vitest';
import { keepClear, reefs } from '../src/art/terrain.ts';

const HEIGHT = 900;
const ids = (width: number) => reefs(width, HEIGHT).map(reef => reef.index);

describe('the reef', () => {
  it('has more reefs in a wider tank', () => {
    expect(ids(800).length).toBeLessThan(ids(1600).length);
    expect(ids(1600).length).toBeLessThan(ids(2560).length);
  });

  it('keeps its reefs as the tank widens, and only adds new ones', () => {
    for (let width = 600; width < 2600; width += 37) {
      const wider = new Set(ids(width + 37));
      expect(ids(width).filter(id => !wider.has(id))).toEqual([]);
    }
  });

  it('keeps the chest clear of the reefs in front', () => {
    for (const width of [700, 1280, 2560]) {
      const clear = keepClear(width);
      const inFront = reefs(width, HEIGHT).filter(reef => reef.row > 0);
      for (const reef of inFront) expect(clear.some(([from, to]) => reef.x + reef.w / 2 > from && reef.x - reef.w / 2 < to)).toBe(false);
    }
  });

  it('paints the back row first, then front to back', () => {
    const rows = reefs(2560, HEIGHT).map(reef => reef.row);
    expect(rows).toEqual([...rows].sort());
  });

  it('grows the soft corals on their own reef, within the tank', () => {
    for (const reef of reefs(2560, HEIGHT)) for (const coral of reef.soft) {
      expect(Math.abs(coral.x - reef.x)).toBeLessThan(reef.w / 2);
      expect(coral.size).toBeLessThan(HEIGHT);
    }
  });
});
