import { describe, expect, it } from 'vitest';
import { shade } from '../src/util.ts';

describe('shade', () => {
  it('lightens and darkens a hex colour', () => {
    expect(shade('#808080', -.5)).toBe('rgb(64,64,64)');
    expect(shade('#000000', .5)).toBe('rgb(128,128,128)');
  });

  it('shades a colour it shaded before, instead of turning it black', () => {
    expect(shade(shade('#808080', -.5), .5)).toBe('rgb(160,160,160)');
  });
});
