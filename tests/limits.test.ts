import { describe, expect, it } from 'vitest';
import { airTanks } from '../src/limits';

const now = Date.parse('2026-10-28T12:00:00Z'), hour = 3600_000;
const limits = (fiveHour: number | null, week: number | null, resetIn = hour) => ({
  fiveHour: fiveHour === null ? null : { usedPct: fiveHour, resetsAt: now + resetIn },
  sevenDay: week === null ? null : { usedPct: week, resetsAt: now + 3 * 24 * hour },
  at: now,
});

describe('airTanks', () => {
  it('shows the air left in each window', () => {
    const t = airTanks(limits(64, 93), now)!;
    expect(t.fiveHour).toMatchObject({ left: 36, warn: false, low: false });
    expect(t.week).toMatchObject({ left: 7, warn: true, low: true });
    expect(t.fiveHour!.refill).toMatch(/\d/);   // a time today
    expect(t.week!.refill).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$/); // e.g. Sat 31 Oct
  });

  it('refills a window once its reset time has passed', () => {
    expect(airTanks(limits(100, 10, -1000), now)!.fiveHour).toMatchObject({ left: 100, low: false, refill: '' });
  });

  it('clamps odd percentages and keeps a missing window empty', () => {
    const t = airTanks(limits(120, null), now)!;
    expect(t.fiveHour!.left).toBe(0);
    expect(t.week).toBeNull();
  });

  it('hides the tanks without any usage', () => {
    expect(airTanks(null, now)).toBeNull();
    expect(airTanks(limits(null, null), now)).toBeNull();
  });
});
