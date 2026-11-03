import { CanvasSource, Texture } from 'pixi.js';

/** A 2D canvas of w x h CSS pixels at the given resolution, with the context pre-scaled. */
export const makeCanvas = (w: number, h: number, resolution: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * resolution)); canvas.height = Math.max(1, Math.ceil(h * resolution));
  const g = canvas.getContext('2d')!;
  g.scale(resolution, resolution);
  return { canvas, g };
};

/**
 * A Pixi texture source for a canvas drawn at `resolution`. It's made at resolution 1 and given its resolution after:
 * made with it, Pixi works its size in pixels out as (width / resolution) * resolution, which can land a hair off at a
 * resolution like 1.25 (Windows at 125%), and then resizes the canvas to match, which wipes it.
 */
export const canvasSource = (canvas: HTMLCanvasElement, resolution: number): CanvasSource => {
  const source = new CanvasSource({ resource: canvas, resolution: 1 });
  source.resolution = resolution;
  return source;
};

export const canvasTexture = (canvas: HTMLCanvasElement, resolution: number): Texture =>
  new Texture({ source: canvasSource(canvas, resolution) });

export const paintTexture = (
  { w, h }: { w: number; h: number }, resolution: number, paint: (g: CanvasRenderingContext2D) => void,
): Texture => {
  const { canvas, g } = makeCanvas(w, h, resolution);
  paint(g);
  return canvasTexture(canvas, resolution);
};