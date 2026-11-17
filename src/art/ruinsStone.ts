import { rng, shade } from '../util';
import { isSnowy } from './reefRock';
import type { Ground } from './reefRock';
import { ellipse, g, ink, poly, toon } from './sceneryPen';
import type { Point } from './sceneryPen';

export const MARBLE = '#cfd2cc';
const MOSS = ['#6fa150', '#4f8a4a', '#86b45a'];
let groundAt: Ground = () => 0;

/** Tells the stones where the sand is, so they can sink into it. */
export const useGround = (ground: Ground) => { groundAt = ground; };

/** A column standing at (x, y); `tone` darkens it (-) for the ones further back. */
export interface Column { x: number; y: number; w: number; h: number; broken?: boolean; tone?: number }

export const rectangle = (x: number, y: number, ...size: [w: number, h: number]) => poly([x, y], [x + size[0], y], [x + size[0], y - size[1]], [x, y - size[1]]);

/** A rough, broken line from one point to the other: it zigzags, with the odd deep bite. */
export const jagged = ([from, to]: [Point, Point], random: () => number, amount = 9): Point[] => {
  const steps = Math.max(4, Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / 6));
  return Array.from({ length: steps + 1 }, (_, step): Point => {
    const along = step / steps, bite = random() < .14 ? 2.2 : 1, edge = step === 0 || step === steps ? 0 : 1;
    return [from[0] + (to[0] - from[0]) * along + (random() - .5) * amount * .5 * edge, from[1] + (to[1] - from[1]) * along + random() * amount * bite * edge];
  });
};

/** A bright rim along a fresh break, so the snapped edge reads as rough stone. */
export const rim = (edge: Point[], color: string) => {
  g.strokeStyle = shade(color, .4); g.lineWidth = 2; g.beginPath();
  edge.forEach(([x, y], index) => index ? g.lineTo(x, y + 3) : g.moveTo(x, y + 3));
  g.stroke();
};

/** What water and time did to the stone, inside the clip: stains, hairline cracks, barnacles and algae near the foot. */
export const weather = ([x, y, w, h]: [number, number, number, number]) => {
  const random = rng(Math.round(x * 7 + y));
  for (let stain = 0; stain < 2; stain++) { g.fillStyle = '#2c3a2c'; g.globalAlpha = .1; g.fillRect(x + random() * w * .8, y - h, 2 + random() * 5, h); }
  g.globalAlpha = 1; g.strokeStyle = 'rgba(40,40,40,.45)'; g.lineWidth = 1; g.beginPath();
  for (let crack = 0; crack < 1 + w / 40; crack++) {
    let crackX = x + random() * w, crackY = y - h * (.3 + random() * .6); g.moveTo(crackX, crackY);
    for (let step = 0; step < 4; step++) { crackX += (random() - .5) * 8; crackY += 4 + random() * 8; g.lineTo(crackX, crackY); }
  }
  g.stroke();
  for (let barnacle = 0; barnacle < 3 + w / 8; barnacle++) {
    const radius = 1 + random() * 1.4, spotX = x + random() * w, spotY = y - random() * Math.min(h, 30);
    ellipse({ x: spotX, y: spotY, radiusX: radius + .7, radiusY: radius + .7, color: '#3a3a33' }); ellipse({ x: spotX, y: spotY, radiusX: radius, radiusY: radius, color: '#e6e0cc' });
  }
  for (let patch = 0; patch < 2 + w / 20; patch++) ellipse({ x: x + random() * w, y: y - random() * 8, radiusX: 4 + random() * 8, radiusY: 3 + random() * 7, color: MOSS[patch % 3], alpha: .6 });
};

/** A slab of marble, shaded on its right and top-lit, weathered; snow settles on flat tops in winter. */
export const slab = (path: Path2D, [x, y, w, h]: [number, number, number, number], color = MARBLE) => {
  toon(path, { fill: color, inkColor: shade(color, -.62), width: 2 }, () => {
    g.fillStyle = shade(color, -.14); g.fillRect(x + w * .68, y - h, w * .32, h);
    g.fillStyle = shade(color, .25); g.fillRect(x, y - h, w * .12, h);
    if (w > 12 && h > 12) weather([x, y, w, h]);
  });
};

/** A block: a slab that is simply a rectangle. */
export const block = (x: number, y: number, ...rest: [w: number, h: number, color?: string]) => slab(rectangle(x, y, rest[0], rest[1]), [x, y, rest[0], rest[1]], rest[2]);

/** A block with a snapped, uneven top: a broken pier or a chunk of fallen wall. */
export const chunk = (x: number, y: number, ...rest: [w: number, h: number, color?: string]) => {
  const [w, h] = rest, random = rng(Math.round(x + y * 3)), top = jagged([[x + w, y - h + random() * h * .2], [x, y - h + random() * h * .2]], random, 7);
  slab(poly([x, y], [x + w, y], ...top), [x, y, w, h], rest[2]);
  rim(top, rest[2] ?? MARBLE);
};

export const snowCap = (x: number, y: number, w: number) => {
  if (isSnowy()) ellipse({ x, y: y - 1, radiusX: w / 2, radiusY: 4, color: '#f3f8fd' });
};

export const moss = (x: number, y: number, w: number) => {
  const random = rng(Math.round(x));
  for (let patch = 0; patch < 3 + w / 14; patch++) {
    ellipse({ x: x + (random() - .5) * w, y: y - random() * 14, radiusX: 4 + random() * 8, radiusY: 2 + random() * 3, color: MOSS[patch % 3], alpha: .85 });
  }
};

/** Heaps the sand up round the foot of a stone at x (w wide): a hump whose crown reaches topY and that sinks into the ground at both sides, with the sand's own edge line, so the stone grows out of the sand. */
export const bury = (x: number, topY: number, w: number) => {
  const random = rng(Math.round(x * 3)), half = w / 2 + 16, rise = Math.max(5, groundAt(x) - topY), steps = 16, snow = isSnowy();
  const edge: Point[] = Array.from({ length: steps + 1 }, (_, step): Point => {
    const px = x - half + step / steps * half * 2, profile = Math.cos((px - x) / half * Math.PI / 2) ** 2;
    return [px, groundAt(px) - rise * profile * (.92 + Math.sin(px * .45) * .08)];
  });
  const top = new Path2D(); edge.forEach(([px, py], index) => index ? top.lineTo(px, py) : top.moveTo(px, py));
  const mound = new Path2D(top); mound.lineTo(edge[steps][0], edge[steps][1] + 64); mound.lineTo(edge[0][0], edge[0][1] + 64); mound.closePath();
  g.fillStyle = snow ? '#eef5fc' : '#e8cd96'; g.fill(mound);
  g.save(); g.clip(mound);
  for (let speck = 0; speck < 6 + w / 8; speck++) ellipse({ x: x + (random() - .5) * half * 1.8, y: groundAt(x) - random() * rise * .6, radiusX: 1.2, radiusY: .9, color: snow ? '#c3d4e8' : '#c9a66a' });
  g.restore();
  g.save(); g.translate(0, 5); ink(top, { color: snow ? '#ffffff' : '#f7e5b8', width: 5 }); g.restore();
  ink(top, { color: snow ? '#5f7fa3' : '#7a5726', width: 2.4 });
};

/** A capital: a thin slab on an echinus that flares out of the shaft, with a ring where they meet; `y` is the top of the shaft. */
const capital = ({ x, y, w }: { x: number; y: number; w: number }, color: string) => {
  const flare = poly([x - w / 2, y], [x + w / 2, y], [x + w / 2 + 5, y - 9], [x - w / 2 - 5, y - 9]);
  slab(flare, [x - w / 2 - 5, y, w + 10, 9], shade(color, -.05));
  block(x - w / 2 - 9, y - 9, w + 18, 8, color);
  g.strokeStyle = shade(color, -.5); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - w / 2, y - 3); g.lineTo(x + w / 2, y - 3); g.stroke();
};

/** A plinth of two stepped tiers under a column. */
const plinth = ({ x, y, w }: { x: number; y: number; w: number }, color: string) => {
  block(x - w / 2 - 9, y + 6, w + 18, 8, color);
  block(x - w / 2 - 5, y - 2, w + 10, 8, color);
};
/** A fluted column on a plinth, with a capital, or snapped off along a ragged break; the sand heaped round its foot. */
export const paintColumn = ({ x, y, w, h, broken, tone = 0 }: Column) => {
  const left = x - w / 2, shaftTop = y - h, color = shade(MARBLE, tone), random = rng(Math.round(x * 5));
  const top = jagged([[left + w, shaftTop + 8 + random() * 22], [left, shaftTop + 8 + random() * 22]], random, 8);
  plinth({ x, y, w }, color);
  slab(broken ? poly([left, y], [left + w, y], ...top) : rectangle(left, y, w, h), [left, y, w, h], color);
  g.strokeStyle = shade(color, -.35); g.lineWidth = 1.2; g.beginPath();
  for (let flute = 1; flute < 4; flute++) { g.moveTo(left + w * flute / 4, y - 6); g.lineTo(left + w * flute / 4, shaftTop + (broken ? 30 : 12)); }
  g.stroke();
  if (broken) rim(top, color); else capital({ x, y: shaftTop, w }, color);
  snowCap(x, broken ? shaftTop + 14 : shaftTop - 20, w + 16); moss(x, y, w + 10); bury(x, y - 6, w + 12);
};