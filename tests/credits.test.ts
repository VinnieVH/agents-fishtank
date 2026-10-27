import { describe, expect, it } from 'vitest';
import { credits, type Quota } from '../src/credits';

const q = (o: Partial<Quota>): Quota => ({
  entitlement: 22200, used: 17871, remainingPct: 19.5, unlimited: false, overage: 0, resetDate: '2026-11-01T00:00:00Z', at: 0, ...o,
});

describe('credits', () => {
  it('matches the VS Code numbers', () => {
    const c = credits(q({}))!;
    expect(c.usedPct).toBeCloseTo(80.5);
    expect(c.left).toBe(4329);
    expect(c.low).toBe(false);
    expect(c.reset?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('fills the chest in 5% steps and only empties it at 0%', () => {
    expect(credits(q({ remainingPct: 19.5 }))!.gold).toBe(.2);
    expect(credits(q({ remainingPct: .4 }))!.gold).toBe(.05);
    expect(credits(q({ remainingPct: 0, used: 22200 }))!.gold).toBe(0);
    expect(credits(q({ remainingPct: 100, used: 0 }))!.gold).toBe(1);
  });

  it('keeps one precious stone per started 20% left', () => {
    expect(credits(q({ remainingPct: 100, used: 0 }))!.gems).toBe(5);
    expect(credits(q({ remainingPct: 80 }))!.gems).toBe(4);
    expect(credits(q({ remainingPct: 79.5 }))!.gems).toBe(4);
    expect(credits(q({ remainingPct: 19 }))!.gems).toBe(1); // 81% used
    expect(credits(q({ remainingPct: .5 }))!.gems).toBe(1);
    expect(credits(q({ remainingPct: 0, used: 22200 }))!.gems).toBe(0);
  });

  it('warns under 10% left and clamps overage', () => {
    const c = credits(q({ remainingPct: -3, used: 22900, overage: 700 }))!;
    expect(c.low).toBe(true);
    expect(c.usedPct).toBe(100);
    expect(c.left).toBe(0);
    expect(credits(q({ remainingPct: 10 }))!.low).toBe(false);
  });

  it('handles unlimited plans and missing data', () => {
    expect(credits(q({ unlimited: true }))).toMatchObject({ unlimited: true, gold: 1, low: false });
    expect(credits(null)).toBeNull();
  });
});
