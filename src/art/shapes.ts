import { shade, TAU } from '../util';
import { fine, g, ink, toon } from './sceneryPen';
import type { Point } from './sceneryPen';

// Small cartoon shapes for the festive hats and props: a flat fill with an ink outline in a dark shade of the fill.

export const circle = (x: number, y: number, radius: number) => {
  const path = new Path2D(); path.arc(x, y, radius, 0, TAU);
  return path;
};

export const oval = (x: number, y: number, ...size: [radiusX: number, radiusY: number, rotation?: number]) => {
  const path = new Path2D(); path.ellipse(x, y, size[0], size[1], size[2] ?? 0, 0, TAU);
  return path;
};

/** A line of bezier segments: [first control point, second control point, end point]. */
export const open = (start: Point, ...segments: [Point, Point, Point][]) => {
  const path = new Path2D(); path.moveTo(...start);
  for (const [first, second, end] of segments) path.bezierCurveTo(first[0], first[1], second[0], second[1], end[0], end[1]);
  return path;
};

/** A closed shape made of bezier segments. */
export const curve = (start: Point, ...segments: [Point, Point, Point][]) => {
  const path = open(start, ...segments); path.closePath();
  return path;
};

export const solid = (path: Path2D, fill: string) => toon(path, { fill, inkColor: shade(fill, -.65), width: 1.6 });
export const dot = (x: number, y: number, ...rest: [radius: number, color: string]) => solid(circle(x, y, rest[0]), rest[1]);

export const stroke = (path: Path2D, color: string, width: number) => ink(path, { color, width: fine(width) });

export const line = (...points: Point[]) => {
  const path = new Path2D(); path.moveTo(...points[0]);
  for (const point of points.slice(1)) path.lineTo(...point);
  return path;
};

/** A soft shadow on the sand under a prop. */
export const shadow = (radius: number) => {
  g.globalAlpha = .25; g.fillStyle = '#000'; g.fill(oval(0, 1, radius, radius * .28)); g.globalAlpha = 1;
};
