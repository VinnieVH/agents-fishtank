import { describe, expect, it } from 'vitest';
import { credits, type Quota } from '../src/credits';

const quota = (overrides: Partial<Quota>): Quota => ({
  entitlement: 22200, used: 17871, remainingPct: 19.5, unlimited: false, overage: 0, resetDate: '2026-11-01T00:00:00Z', at: 0, ...overrides,
});

describe('credits', () => {
  it('matches the VS Code numbers', () => {
    const shown = credits(quota({}))!;
    expect(shown.usedPct).toBeCloseTo(80.5);
    expect(shown.left).toBe(4329);
    expect(shown.low).toBe(false);
    expect(shown.reset?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('fills the chest in 5% steps and only empties it at 0%', () => {
    expect(credits(quota({ remainingPct: 19.5 }))!.gold).toBe(.2);
    expect(credits(quota({ remainingPct: .4 }))!.gold).toBe(.05);
    expect(credits(quota({ remainingPct: 0, used: 22200 }))!.gold).toBe(0);
    expect(credits(quota({ remainingPct: 100, used: 0 }))!.gold).toBe(1);
  });

  it('keeps one precious stone per started 20% left', () => {
    expect(credits(quota({ remainingPct: 100, used: 0 }))!.gems).toBe(5);
    expect(credits(quota({ remainingPct: 80 }))!.gems).toBe(4);
    expect(credits(quota({ remainingPct: 79.5 }))!.gems).toBe(4);
    expect(credits(quota({ remainingPct: 19 }))!.gems).toBe(1); // 81% used
    expect(credits(quota({ remainingPct: .5 }))!.gems).toBe(1);
    expect(credits(quota({ remainingPct: 0, used: 22200 }))!.gems).toBe(0);
  });

  it('warns under 10% left and clamps overage', () => {
    const shown = credits(quota({ remainingPct: -3, used: 22900, overage: 700 }))!;
    expect(shown.low).toBe(true);
    expect(shown.usedPct).toBe(100);
    expect(shown.left).toBe(0);
    expect(credits(quota({ remainingPct: 10 }))!.low).toBe(false);
  });

  it('handles unlimited plans and missing data', () => {
    expect(credits(quota({ unlimited: true }))).toMatchObject({ unlimited: true, gold: 1, low: false });
    expect(credits(null)).toBeNull();
  });
});
