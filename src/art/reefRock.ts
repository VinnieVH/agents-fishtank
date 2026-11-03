import { TAU } from '../util';
import type { Coral, HardKind, Reef } from './reefLayout';
import { rockTop } from './reefLayout';
import { ellipse, g, ink, toon } from './sceneryPen';
import type { Point } from './sceneryPen';

/** Where the sand is at x: the front sand's top edge (art/terrain.ts). */
export type Ground = (x: number) => number;

/** Each row's rock: its body, shadow and lit colours. */
export const ROCK: [string, string, string][] = [['#5c536c', '#3f384c', '#7a7088'], ['#776a86', '#544a63', '#988caa'], ['#85778f', '#5d5268', '#a598b0']];
const CORALLINE = ['#c0679b', '#9a5fb8', '#d98aa0', '#7a5aa8', '#e0a0b8'];
const SAND = '#e8cd96';
/** How wide a coral's foot is, for the rock that grows up around it. */
const FOOT: Partial<Record<HardKind, (size: number) => number>> = { staghorn: size => size * .2, table: size => size * .13, leather: size => size * .22, brain: size => size * .55 };

/** A smooth closed path through points. */
export const smoothOutline = (points: Point[]) => {
  const path = new Path2D(), count = points.length;
  const middle = (index: number) => [(points[index % count][0] + points[(index + 1) % count][0]) / 2, (points[index % count][1] + points[(index + 1) % count][1]) / 2];
  const start = middle(count - 1); path.moveTo(start[0], start[1]);
  for (let index = 0; index < count; index++) { const end = middle(index); path.quadraticCurveTo(points[index][0], points[index][1], end[0], end[1]); }
  path.closePath();
  return path;
};

/** The crusts of pink and purple coralline algae and the holes all over live rock, inside the current clip. */
export const crusts = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }, lit: string, random: () => number) => {
  for (let index = 0; index < 4 + w / 30; index++) {
    const centerX = x + (random() - .5) * w * .9, centerY = y - random() * h * .9, size = 8 + random() * 16;
    const crust = smoothOutline(Array.from({ length: 7 }, (_, corner): Point => {
      const angle = corner / 7 * TAU, wobble = 1 + (random() - .5) * .5;
      return [centerX + Math.cos(angle) * size * wobble, centerY + Math.sin(angle) * size * .6 * wobble];
    }));
    g.globalAlpha = .85; g.fillStyle = CORALLINE[Math.floor(random() * CORALLINE.length)]; g.fill(crust); g.globalAlpha = 1;
  }
  for (let index = 0; index < 1 + w / 90; index++) {
    const holeX = x + (random() - .5) * w * .7, holeY = y - random() * h * .6 - 4, radius = 2.5 + random() * 4;
    ellipse({ x: holeX, y: holeY, radiusX: radius, radiusY: radius * .7, color: '#1d1625' });
    ellipse({ x: holeX - radius * .2, y: holeY - radius * .35, radiusX: radius * .6, radiusY: radius * .25, color: lit, alpha: .5 });
  }
};

/** The edge of the front sand drawn again in front of the rock, where the rock's foot is behind it. */
const redrawSandEdge = (top: Point[], footY: number, ground: Ground) => {
  let run: Point[] = [];
  const paintRun = () => {
    if (run.length > 1) {
      const edge = new Path2D(); run.forEach(([x, y], index) => index ? edge.lineTo(x, y) : edge.moveTo(x, y));
      g.save(); g.translate(0, 6); ink(edge, { color: '#f7e5b8', width: 6 }); g.restore(); ink(edge, { color: '#7a5726', width: 2.4 });
    }
    run = [];
  };
  for (const [x] of top) { if (footY < ground(x)) run.push([x, ground(x)]); else paintRun(); }
  paintRun();
};

/**
 * Sand drifted over the foot of the rock from `from` to `to`, whose foot is at `footY` (or behind the edge of the
 * front sand, where that is lower down): it hides where the rock meets the ground, so the rock sits in it instead of
 * floating over it.
 */
export const sandOver = ([from, to]: [number, number], footY: number, ground: Ground) => {
  const top: Point[] = [];
  for (let x = from; x <= to + .1; x += 5) top.push([x, Math.max(footY, ground(x)) + Math.sin(x * .35) * 1.2]);
  const drift = new Path2D(); top.forEach(([x, y], index) => index ? drift.lineTo(x, y) : drift.moveTo(x, y));
  for (let index = top.length - 1; index >= 0; index--) drift.lineTo(top[index][0], top[index][1] + 18);
  drift.closePath();
  g.fillStyle = SAND; g.fill(drift);
  g.save(); g.clip(drift);
  for (const [x, y] of top) {
    ellipse({ x: x + 2, y: y + 6, radiusX: 1.2, radiusY: .9, color: '#c9a66a' }); ellipse({ x: x - 1, y: y + 12, radiusX: 1, radiusY: .8, color: '#fbecc8' });
  }
  g.restore();
  redrawSandEdge(top, footY, ground);
};

/** A lumpy outcrop of live rock, crusted with pink and purple coralline algae and full of holes, along rockTop; its foot sunk in the sand. */
export const paintLiveRock = (reef: Reef, random: () => number, ground: Ground) => {
  const [body, dark, lit] = ROCK[reef.row], { x, y, w, h } = reef, deep = (footX: number) => Math.max(y, ground(footX)) + 10;
  const top: Point[] = [];
  for (let index = 0, count = 26; index <= count; index++) { const offset = (index / count - .5) * w; top.push([x + offset, rockTop(reef, offset)]); }
  const outline = new Path2D(); outline.moveTo(x - w / 2, deep(x - w / 2));
  for (const [pointX, pointY] of top) outline.lineTo(pointX, pointY);
  outline.lineTo(x + w / 2, deep(x + w / 2));
  const shape = new Path2D(outline); shape.closePath();
  g.fillStyle = body; g.fill(shape);
  g.save(); g.clip(shape);
  ellipse({ x: x + w * .32, y: y - h * .1, radiusX: w * .45, radiusY: h * .9 + 12, color: dark });   // shadow side
  ellipse({ x: x - w * .2, y: y - h * .75, radiusX: w * .3, radiusY: h * .25, rotation: -.2, color: lit }); // lit top
  crusts({ x, y, w, h }, lit, random);
  ellipse({ x, y: y + 4, radiusX: w * .6, radiusY: 9, color: '#140e1a', alpha: .35 }); // shaded where it meets the sand
  g.restore();
  ink(outline, { color: '#221a2a', width: 2.4 }); // its top and sides only: the foot is in the sand
  sandOver([x - w / 2 - 6, x + w / 2 + 6], y, ground);
};

/** A shadow on the rock under a coral, before it's painted. */
export const shadowUnder = (coral: Coral<HardKind>) => {
  const foot = FOOT[coral.kind]?.(coral.size) ?? coral.size * .5;
  ellipse({ x: coral.x + 3, y: coral.y - 1, radiusX: foot * 1.6, radiusY: 4 + foot * .2, color: '#140e1a', alpha: .35 });
};

/** Rock growing up around a coral's foot, so it looks rooted in the reef rather than set on top of it. */
export const rootIn = (coral: Coral<HardKind>, row: number, random: () => number) => {
  const foot = FOOT[coral.kind]?.(coral.size);
  if (!foot) return; // polyps and zoanthids grow as a crust on the rock already
  const [body, dark, lit] = ROCK[row], radiusX = Math.max(7, foot), radiusY = Math.max(4, foot * .45);
  const mound = smoothOutline(Array.from({ length: 9 }, (_, corner): Point => {
    const angle = corner / 9 * TAU, wobble = 1 + (random() - .5) * .3, rise = Math.sin(angle) * radiusY * wobble;
    return [coral.x + Math.cos(angle) * radiusX * wobble, coral.y + 2 + (rise > 0 ? rise * .4 : rise)];
  }));
  toon(mound, { fill: body, inkColor: '#221a2a', width: 1.8 }, () => {
    ellipse({ x: coral.x + radiusX * .5, y: coral.y + 3, radiusX: radiusX * .8, radiusY, color: dark });
    ellipse({ x: coral.x - radiusX * .3, y: coral.y - radiusY * .5, radiusX: radiusX * .4, radiusY: radiusY * .3, color: lit });
    ellipse({ x: coral.x + (random() - .5) * radiusX, y: coral.y + 1, radiusX: radiusX * .35, radiusY: radiusY * .4, color: CORALLINE[Math.floor(random() * CORALLINE.length)], alpha: .8 });
  });
};
