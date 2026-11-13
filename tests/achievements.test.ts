import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, AchievementStore, seasonId, visitorId } from '../src/achievements';
import { SEASONS } from '../src/seasons';
import { KINDS } from '../src/scene/passersby';

const memory = () => {
  const saved = new Map<string, string>();
  return { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, text: string) => { saved.set(key, text); } };
};

const ids = (earned: { id: string }[]) => earned.map(achievement => achievement.id);

describe('achievements', () => {
  it('has one for every season and every visitor', () => {
    const all = ids(ACHIEVEMENTS);
    for (const season of SEASONS) expect(all).toContain(seasonId(season.id));
    for (const kind of KINDS) expect(all).toContain(visitorId(kind.name));
    expect(new Set(all).size).toBe(all.length);
  });

  it('is earned once and remembered', () => {
    const storage = memory();
    expect(new AchievementStore(storage).earn(seasonId('winter'), 5)?.group).toBe('seasons');
    const again = new AchievementStore(storage);
    expect(again.earn(seasonId('winter'), 9)).toBeNull();
    expect(again.earnedAt(seasonId('winter'))).toBe(5);
  });

  it('earns the fish milestones up to the number of fish', () => {
    const store = new AchievementStore(null);
    expect(store.earnUpTo('fish', 0)).toEqual([]);
    expect(ids(store.earnUpTo('fish', 5))).toEqual(['fish-1', 'fish-5']);
    expect(ids(store.earnUpTo('fish', 12))).toEqual(['fish-10']);
    expect(ids(store.earnUpTo('fish', 30))).toEqual(['fish-15', 'fish-20', 'fish-25']);
  });

  it('counts up over time, also across reloads', () => {
    const storage = memory();
    const store = new AchievementStore(storage);
    expect(ids(store.add('crab'))).toEqual(['crab-1']);
    for (let visit = 2; visit < 10; visit++) expect(store.add('crab')).toEqual([]);
    expect(ids(new AchievementStore(storage).add('crab'))).toEqual(['crab-10']);
  });
});
