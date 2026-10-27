import { describe, expect, it } from 'vitest';
import { guessLocation, lightFor, makeClock, sunPosition } from '../src/sky';

const brussels = { lat: 50.85, lon: 4.35 };

describe('sunPosition', () => {
  it('puts the sun high at midsummer noon and below the horizon at midnight', () => {
    const noon = sunPosition(new Date(Date.UTC(2024, 5, 21, 11, 45)), brussels);
    const midnight = sunPosition(new Date(Date.UTC(2024, 5, 21, 23, 45)), brussels);
    expect(noon.el).toBeGreaterThan(60);
    expect(noon.el).toBeLessThan(64);
    expect(Math.abs(noon.ha)).toBeLessThan(.05);
    expect(midnight.el).toBeLessThan(-10);
  });

  it('keeps the winter sun low', () => {
    expect(sunPosition(new Date(Date.UTC(2024, 11, 21, 11, 45)), brussels).el).toBeLessThan(17);
  });

  it('marks the morning as dawn and the evening as dusk', () => {
    const morning = sunPosition(new Date(Date.UTC(2024, 2, 20, 5, 45)), brussels);
    const evening = sunPosition(new Date(Date.UTC(2024, 2, 20, 17, 55)), brussels);
    expect(lightFor(morning.el, morning.ha).phase).toBe('Dawn');
    expect(lightFor(evening.el, evening.ha).phase).toBe('Dusk');
  });
});

describe('lightFor', () => {
  it('is full day high up and full night after nautical twilight', () => {
    expect(lightFor(30, 0)).toMatchObject({ day: 1, night: 0, phase: 'Day' });
    expect(lightFor(-20, 3)).toMatchObject({ day: 0, night: 1, phase: 'Night' });
    expect(lightFor(1, -1).warm).toBe(1);
  });
});

describe('guessLocation', () => {
  it('uses the standard offset for longitude and the region for latitude', () => {
    expect(guessLocation('Europe/Brussels', 60)).toEqual({ lat: 50, lon: 15 });
    expect(guessLocation('Australia/Sydney', 600)).toEqual({ lat: -33, lon: 150 });
    expect(guessLocation('', 0)).toEqual({ lat: 45, lon: 0 });
  });
});

describe('makeClock', () => {
  it('pins the time with ?time and speeds it up with ?timelapse', () => {
    let now = new Date(2024, 0, 1, 9, 0).getTime();
    const fixed = makeClock(new URLSearchParams('time=21:30'), () => now)();
    expect([fixed.getHours(), fixed.getMinutes()]).toEqual([21, 30]);
    const lapse = makeClock(new URLSearchParams('timelapse'), () => now);
    now += 60_000;
    expect(lapse().getTime() - new Date(2024, 0, 1, 9, 0).getTime()).toBe(864e5);
  });
});
