import { describe, expect, it } from 'vitest';
import { FOREGROUND_ART } from '../src/art/foreground.ts';
import { keepClear } from '../src/art/chestSpot.ts';
import { DEFAULT_FOREGROUND, FOREGROUNDS, ForegroundStore } from '../src/foregrounds.ts';

const memory = (initial: Record<string, string> = {}) => {
  const saved = { ...initial };
  return { getItem: (key: string) => saved[key] ?? null, setItem: (key: string, value: string) => { saved[key] = value; } };
};

describe('the chosen foreground', () => {
  it('is the default until one is picked', () => {
    expect(new ForegroundStore(memory()).get()).toBe(DEFAULT_FOREGROUND);
  });

  it('is remembered across reloads', () => {
    const storage = memory();
    new ForegroundStore(storage).set('kelp');
    expect(new ForegroundStore(storage).get()).toBe('kelp');
  });

  it('falls back to the default when what was saved is not a foreground', () => {
    expect(new ForegroundStore(memory({ 'fishtank.foreground': 'volcano' })).get()).toBe(DEFAULT_FOREGROUND);
  });
});

describe('the foregrounds', () => {
  it('have art for every one on the page', () => {
    for (const { id } of FOREGROUNDS) expect(FOREGROUND_ART[id]).toBeDefined();
  });

  it('keep what sways within the tank, and the same as the tank widens', () => {
    for (const { id } of FOREGROUNDS) {
      const narrow = FOREGROUND_ART[id].swayers(900, 800), wide = FOREGROUND_ART[id].swayers(1800, 800);
      expect(wide.length).toBeGreaterThanOrEqual(narrow.length);
      for (const plant of narrow) expect(plant.size).toBeLessThan(800);
    }
  });

  it('leave the chest clear of eelgrass and plastic plants', () => {
    const [[from, to]] = keepClear(1400);
    for (const id of ['kelp', 'ruins'] as const) {
      const plants = FOREGROUND_ART[id].swayers(1400, 800).filter(plant => plant.kind === 'grass');
      expect(plants.some(plant => plant.x > from && plant.x < to)).toBe(false);
    }
  });
});
