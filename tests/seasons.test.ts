import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { currentSeason, SEASONS, seasonOn } from '../src/seasons';

const on = (month: number, day: number) => seasonOn(new Date(2027, month - 1, day))?.id ?? null;

describe('seasonOn', () => {
  it('knows when each season starts and ends', () => {
    expect([on(2, 2), on(2, 16)]).toEqual(['lunar', 'love']);
    expect([on(3, 29), on(4, 5)]).toEqual(['spring', 'spring']);
    expect([on(6, 21), on(7, 5)]).toEqual(['midsummer', 'midsummer']);
    expect([on(9, 20), on(10, 6)]).toEqual(['brewfest', 'brewfest']);
    expect([on(10, 19), on(11, 2)]).toEqual(['halloween', 'halloween']);
    expect([on(11, 22), on(11, 29)]).toEqual(['thanksgiving', 'thanksgiving']);
  });

  it('is null between seasons', () => {
    expect([on(1, 3), on(2, 23), on(4, 6), on(5, 11), on(8, 15), on(9, 19), on(12, 14)]).toEqual(Array(7).fill(null));
  });

  it('runs winter across New Year', () => {
    expect([on(12, 15), on(12, 31), on(1, 1), on(1, 2)]).toEqual(Array(4).fill('winter'));
  });

  it('lets love take over from the Lunar New Year where they overlap', () => {
    expect([on(2, 7), on(2, 8), on(2, 22)]).toEqual(['lunar', 'love', 'love']);
  });

  it('has no pirates', () => {
    expect(on(9, 19)).toBeNull();
  });
});

describe('currentSeason', () => {
  const summer = new Date(2027, 7, 15);

  it('follows the date', () => {
    expect(currentSeason(new URLSearchParams(), new Date(2026, 11, 24))?.id).toBe('winter');
    expect(currentSeason(new URLSearchParams(), summer)).toBeNull();
  });

  it('lets ?season choose one to look at', () => {
    expect(currentSeason(new URLSearchParams('season=halloween'), summer)?.id).toBe('halloween');
    expect(currentSeason(new URLSearchParams('season=nope'), summer)).toBeNull();
  });
});

describe('the website', () => {
  it('has the same calendar as the tank', () => {
    const page = readFileSync('site/site.js', 'utf8');
    const listed = [...page.matchAll(/\['(\w+)', \[(\d+), (\d+)\], \[(\d+), (\d+)\]\]/g)]
      .map(([, id, ...days]) => `${id} ${days.join(' ')}`);
    expect(listed).toEqual(SEASONS.map(({ id, start, end }) => `${id} ${[...start, ...end].join(' ')}`));
  });
});
