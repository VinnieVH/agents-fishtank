import { describe, expect, it } from 'vitest';
import { canvasSource } from '../src/art/canvas.ts';

describe('canvas textures', () => {
  it('keep their canvas (and what is painted on it) at a resolution like 4/3', () => {
    // Windows at 125%, 133% and 150%: 1941 / (4/3) * (4/3) isn't quite 1941 in floating point
    for (const resolution of [1.25, 4 / 3, 1.3333332538604736, 1.5, 1.75]) {
      for (const w of [1941, 1825, 777, 3]) {
        const canvas = { width: w, height: w + 1 } as unknown as HTMLCanvasElement;
        const source = canvasSource(canvas, resolution);
        expect([canvas.width, canvas.height]).toEqual([w, w + 1]); // a resize would have wiped it
        expect(source.width).toBeCloseTo(w / resolution, 6);
        expect(source.resolution).toBe(resolution);
      }
    }
  });
});