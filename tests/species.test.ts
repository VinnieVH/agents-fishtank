import { describe, expect, it } from 'vitest';
import { ALL_SPECIES, pickSpecies, SpeciesStore, type Species } from '../src/species';

describe('pickSpecies', () => {
  it('picks a species that is not in the tank yet', () => {
    const inTank: Species[] = ['tropical', 'koi', 'sturgeon', 'angelfish'];
    expect(pickSpecies('abc', inTank)).toBe('puffer');
  });

  it('spreads many sessions evenly over the species', () => {
    const tank: Species[] = [];
    for (let i = 0; i < ALL_SPECIES.length * 3; i++) tank.push(pickSpecies('session-' + i, tank));
    for (const s of ALL_SPECIES) expect(tank.filter(x => x === s)).toHaveLength(3);
  });
});

describe('SpeciesStore', () => {
  it('remembers a session\'s species across reloads and forgets ended sessions', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    const first = new SpeciesStore(storage);
    const a = first.get('a', []);
    first.get('b', [a]);
    first.prune(new Set(['a']));

    const reloaded = new SpeciesStore(storage);
    expect(reloaded.get('a', ALL_SPECIES.filter(s => s !== a))).toBe(a);
    expect(JSON.parse(data.get('fishtank.species')!)).toEqual({ a });
  });

  it('survives corrupt storage', () => {
    const store = new SpeciesStore({ getItem: () => '{nope', setItem: () => {} });
    expect(ALL_SPECIES).toContain(store.get('x', []));
  });
});
