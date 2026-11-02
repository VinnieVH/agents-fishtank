import { CanvasSource, Texture } from 'pixi.js';

/** A 2D canvas of w x h CSS pixels at the given resolution, with the context pre-scaled. */
export function makeCanvas(w: number, h: number, res: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * res)); c.height = Math.max(1, Math.ceil(h * res));
  const g = c.getContext('2d')!;
  g.scale(res, res);
  return { c, g };
}

/**
 * A Pixi texture source for a canvas drawn at `res`. It's made at resolution 1 and given its resolution after: made
 * with it, Pixi works its size in pixels out as (width / res) * res, which can land a hair off at a resolution like
 * 1.25 (Windows at 125%), and then resizes the canvas to match, which wipes it.
 */
export function canvasSource(c: HTMLCanvasElement, res: number): CanvasSource {
  const source = new CanvasSource({ resource: c, resolution: 1 });
  source.resolution = res;
  return source;
}

export function canvasTexture(c: HTMLCanvasElement, res: number): Texture {
  return new Texture({ source: canvasSource(c, res) });
}

/** Paint something with Canvas 2D and turn it into a Pixi texture. */
export function paintTexture(w: number, h: number, res: number, paint: (g: CanvasRenderingContext2D) => void): Texture {
  const { c, g } = makeCanvas(w, h, res);
  paint(g);
  return canvasTexture(c, res);
}
