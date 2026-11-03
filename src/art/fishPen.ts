import { TAU } from '../util';

/** The ink colour of a creature's outlines, and its body size (outline widths scale with it). */
export interface Ink {
  color: string;
  size: number;
}

export type Point = [number, number];

// Painters draw with Canvas 2D into this context; the result becomes a texture that a MeshRope bends while swimming.
export let g: CanvasRenderingContext2D;

export const drawInto = (context: CanvasRenderingContext2D) => {
  g = context;
};

export const ink = (pen: Ink, alpha = 1, widthScale = 1) => {
  g.strokeStyle = pen.color; g.lineWidth = Math.max(1.1, pen.size * .045) * widthScale; g.lineJoin = 'round'; g.lineCap = 'round';
  g.globalAlpha = alpha; g.stroke(); g.globalAlpha = 1;
};

export const shape = (path: () => void, fill: string | CanvasGradient, pen: Ink) => {
  path(); g.fillStyle = fill; g.fill(); ink(pen);
};

/** Darker brush strokes on fins, each segment as [x0, y0, x1, y1]. */
export const streaks = (color: string, size: number, segments: number[][]) => {
  g.strokeStyle = color; g.lineWidth = Math.max(.7, size * .025); g.lineCap = 'round'; g.globalAlpha = .55;
  g.beginPath(); for (const [x0, y0, x1, y1] of segments) { g.moveTo(x0, y0); g.lineTo(x1, y1); } g.stroke();
  g.globalAlpha = 1;
};

export const eye = ([x, y]: Point, radius: number, inkColor: string) => {
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, radius, 0, TAU); g.fill();
  g.strokeStyle = inkColor; g.lineWidth = Math.max(.8, radius * .14); g.stroke();
  const irisX = x + radius * .2, irisY = y + radius * .06, iris = g.createRadialGradient(irisX, irisY, 0, irisX, irisY, radius * .68);
  iris.addColorStop(0, '#fff7a8'); iris.addColorStop(.55, '#ffd21a'); iris.addColorStop(1, '#d99a00');
  g.fillStyle = iris; g.beginPath(); g.arc(irisX, irisY, radius * .68, 0, TAU); g.fill();
  g.fillStyle = '#1c2457'; g.beginPath(); g.arc(x + radius * .3, y + radius * .08, radius * .4, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x + radius * .14, y - radius * .14, radius * .17, 0, TAU); g.fill();
  g.beginPath(); g.arc(x + radius * .48, y + radius * .3, radius * .08, 0, TAU); g.fill();
};

/** A glossy highlight (an ellipse as [x, y, rx, ry, rotation]) plus a few little sparkle dots as [x, y, radius]. */
export const shine = ([x, y, rx, ry, rotation]: number[], dots: number[][]) => {
  g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(x, y, rx, ry, rotation, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.4)';
  for (const [dotX, dotY, radius] of dots) { g.beginPath(); g.arc(dotX, dotY, radius, 0, TAU); g.fill(); }
};

export const bodyFill = ([top, middle, bottom]: string[], fromY: number, toY: number) => {
  const gradient = g.createLinearGradient(0, fromY, 0, toY);
  gradient.addColorStop(0, top); gradient.addColorStop(.5, middle); gradient.addColorStop(1, bottom);
  return gradient;
};

export const pout = (x: number, y: number, pen: Ink) => {
  const size = pen.size;
  g.beginPath(); g.moveTo(x - size * .1, y + size * .02); g.quadraticCurveTo(x - size * .03, y + size * .07, x, y);
  ink(pen, .85, .8);
};

/** A limb, arm or antenna: a tapering tube with an ink edge, following the given curve. */
export const tube = (path: () => void, { width, fill }: { width: number; fill: string }, pen: Ink) => {
  const edge = Math.max(1.1, pen.size * .045);
  g.lineCap = 'round'; g.lineJoin = 'round';
  path(); g.strokeStyle = pen.color; g.lineWidth = width + edge * 2; g.stroke();
  path(); g.strokeStyle = fill; g.lineWidth = width; g.stroke();
};

/** A smooth closed path through traced x, y points (curves between the midpoints, so the corners round off). */
export const tracedPath = (points: number[], size: number) => {
  const count = points.length / 2;
  const x = (index: number) => points[(index % count) * 2] / 1000 * size;
  const y = (index: number) => points[(index % count) * 2 + 1] / 1000 * size;
  g.beginPath(); g.moveTo((x(0) + x(1)) / 2, (y(0) + y(1)) / 2);
  for (let index = 1; index <= count; index++) g.quadraticCurveTo(x(index), y(index), (x(index) + x(index + 1)) / 2, (y(index) + y(index + 1)) / 2);
  g.closePath();
};
