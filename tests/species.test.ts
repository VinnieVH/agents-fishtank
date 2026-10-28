import { describe, expect, it } from 'vitest';
import { ALL_SPECIES, NEON, pickNeon, pickSpecies, SpeciesStore, type Look, type Species } from '../src/species';

describe('pickSpecies', () => {
  it('picks a species that is not in the tank yet', () => {
    const inTank = ALL_SPECIES.filter(s => s !== 'lobster');
    expect(pickSpecies('abc', inTank)).toBe('lobster');
  });

  it('spreads many sessions evenly over the species', () => {
    const tank: Species[] = [];
    for (let i = 0; i < ALL_SPECIES.length * 3; i++) tank.push(pickSpecies('session-' + i, tank));
    for (const s of ALL_SPECIES) expect(tank.filter(x => x === s)).toHaveLength(3);
  });
});

describe('pickNeon', () => {
  it('gives every fish its own colour while there are colours left', () => {
    const tank: Look[] = [];
    for (let i = 0; i < NEON.length; i++) tank.push({ species: ALL_SPECIES[i % ALL_SPECIES.length], neon: pickNeon('s' + i, ALL_SPECIES[i % ALL_SPECIES.length], tank) });
    expect(new Set(tank.map(l => l.neon)).size).toBe(NEON.length);
  });

  it('then avoids colours already worn by the same species', () => {
    const tank: Look[] = NEON.map((neon, i) => ({ species: i === 0 ? 'koi' : 'puffer', neon }));
    expect(pickNeon('x', 'koi', tank)).not.toBe(NEON[0]);
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
    expect(reloaded.get('a', ALL_SPECIES.filter(s => s !== a.species).map(species => ({ species, neon: a.neon })))).toEqual(a);
    expect(JSON.parse(data.get('fishtank.species')!)).toEqual({ a });
  });

  it('keeps the species stored by older versions and gives it a colour', () => {
    const store = new SpeciesStore({ getItem: () => JSON.stringify({ a: 'koi' }), setItem: () => {} });
    const look = store.get('a', []);
    expect(look.species).toBe('koi');
    expect(NEON).toContain(look.neon);
  });

  it('survives corrupt storage', () => {
    const store = new SpeciesStore({ getItem: () => '{nope', setItem: () => {} });
    expect(ALL_SPECIES).toContain(store.get('x', []).species);
  });
});
