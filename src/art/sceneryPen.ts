import { TAU } from '../util';

export type Point = [number, number];
export interface Stroke { color: string; width: number; alpha?: number }
export interface Look { fill: string; inkColor: string; width: number }
export interface Oval { x: number; y: number; radiusX: number; radiusY: number; rotation?: number; color: string; alpha?: number }

// The terrain and reef painters draw with Canvas 2D into this context, in the fish's cartoon style: flat cel-shaded
// fills, ink outlines, light rims and shine spots.
export let g: CanvasRenderingContext2D;

export const drawInto = (context: CanvasRenderingContext2D) => {
  g = context;
};

export const ink = (path: Path2D, { color, width, alpha = 1 }: Stroke) => {
  g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round';
  g.stroke(path); g.globalAlpha = 1;
};

/** Fill a shape, then paint shading inside it (clipped) and outline it. */
export const toon = (path: Path2D, look: Look, paintInside?: () => void) => {
  g.fillStyle = look.fill; g.fill(path);
  if (paintInside) { g.save(); g.clip(path); paintInside(); g.restore(); }
  ink(path, { color: look.inkColor, width: look.width });
};

export const ellipse = ({ x, y, radiusX, radiusY, rotation = 0, color, alpha = 1 }: Oval) => {
  g.globalAlpha = alpha; g.fillStyle = color;
  g.beginPath(); g.ellipse(x, y, radiusX, radiusY, rotation, 0, TAU); g.fill(); g.globalAlpha = 1;
};
