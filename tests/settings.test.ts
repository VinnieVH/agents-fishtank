import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings } from '../shared/settings';

describe('mergeSettings', () => {
  it('applies valid changes', () => {
    const s = mergeSettings(DEFAULT_SETTINGS, { daylight: 'night', motion: 'calm', visitors: false, notifyAfter: 300, location: { lat: 51.05, lon: 3.72 } });
    expect(s).toMatchObject({ daylight: 'night', motion: 'calm', visitors: false, notifyAfter: 300, location: { lat: 51.05, lon: 3.72 } });
    expect(mergeSettings(s, { location: null }).location).toBeNull();
  });

  it('keeps the rest as it was', () => {
    const s = mergeSettings({ ...DEFAULT_SETTINGS, crabAlways: true }, { notifyFinished: true });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, crabAlways: true, notifyFinished: true });
  });

  it('ignores unknown keys, wrong types and impossible places', () => {
    const s = mergeSettings(DEFAULT_SETTINGS, {
      daylight: 'dusk', motion: 1, visitors: 'no', openAtLogin: 'true', notifyAfter: 5, evil: true,
      location: { lat: 120, lon: 3 },
    });
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(DEFAULT_SETTINGS, { location: { lat: '51', lon: 3 } }).location).toBeNull();
  });

  it('survives anything that is not an object', () => {
    for (const bad of [null, undefined, 'x', 42, []]) expect(mergeSettings(DEFAULT_SETTINGS, bad)).toEqual(DEFAULT_SETTINGS);
  });
});
