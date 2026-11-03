import { describe, expect, it } from 'vitest';
import { ALL_SPECIES, NEON, pickNeon, pickSpecies, SpeciesStore, type Look, type Species } from '../src/species';

describe('pickSpecies', () => {
  it('picks a species that is not in the tank yet', () => {
    const inTank = ALL_SPECIES.filter(species => species !== 'lobster');
    expect(pickSpecies('abc', inTank)).toBe('lobster');
  });

  it('spreads many sessions evenly over the species', () => {
    const tank: Species[] = [];
    for (let index = 0; index < ALL_SPECIES.length * 3; index++) tank.push(pickSpecies('session-' + index, tank));
    for (const species of ALL_SPECIES) expect(tank.filter(inTank => inTank === species)).toHaveLength(3);
  });
});

describe('pickNeon', () => {
  it('gives every fish its own colour while there are colours left', () => {
    const tank: Look[] = [];
    for (let index = 0; index < NEON.length; index++) {
      const species = ALL_SPECIES[index % ALL_SPECIES.length];
      tank.push({ species, neon: pickNeon('s' + index, species, tank) });
    }
    expect(new Set(tank.map(look => look.neon)).size).toBe(NEON.length);
  });

  it('then avoids colours already worn by the same species', () => {
    const tank: Look[] = NEON.map((neon, index) => ({ species: index === 0 ? 'koi' : 'puffer', neon }));
    expect(pickNeon('x', 'koi', tank)).not.toBe(NEON[0]);
  });
});

describe('SpeciesStore', () => {
  it('remembers a session\'s species across reloads and forgets ended sessions', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, text: string) => void data.set(key, text) };
    const first = new SpeciesStore(storage);
    const look = first.get('a', []);
    first.get('b', [look]);
    first.prune(new Set(['a']));

    const reloaded = new SpeciesStore(storage);
    expect(reloaded.get('a', ALL_SPECIES.filter(species => species !== look.species).map(species => ({ species, neon: look.neon })))).toEqual(look);
    expect(JSON.parse(data.get('fishtank.species')!)).toEqual({ a: look });
  });

  it('keeps the species stored by older versions and gives it a colour', () => {
    const store = new SpeciesStore({ getItem: () => JSON.stringify({ a: 'koi' }), setItem: () => {} });
    const look = store.get('a', []);
    expect(look.species).toBe('koi');
    expect(NEON).toContain(look.neon);
  });

  it('keeps a session\'s look when it carries on under a new id', () => {
    const store = new SpeciesStore(null);
    const look = store.get('before', []);
    store.move('before', 'after');
    expect(store.get('after', [])).toEqual(look);
  });

  it('survives corrupt storage', () => {
    const store = new SpeciesStore({ getItem: () => '{nope', setItem: () => {} });
    expect(ALL_SPECIES).toContain(store.get('x', []).species);
  });
});
