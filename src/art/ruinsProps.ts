import { rng, shade, TAU } from '../util';
import { isClear } from './chestSpot';
import { smoothOutline } from './reefRock';
import { block, bury, chunk, MARBLE, moss, paintColumn, slab, snowCap, weather } from './ruinsStone';
import type { Column } from './ruinsStone';
import { ellipse, g, poly, toon } from './sceneryPen';
import type { Point } from './sceneryPen';

const CAPITAL = 17; // how far a capital rises above its shaft (ruinsStone.ts)

/** One wedge of an arch: the stone between two radii and two angles round the arch's centre. */
const voussoir = ([centerX, centerY]: Point, [inner, outer]: [number, number], [from, to]: [number, number]) => {
  const path = new Path2D();
  path.arc(centerX, centerY, outer, from, to); path.arc(centerX, centerY, inner, to, from, true); path.closePath();
  return path;
};

/** A freestanding arch: two piers with imposts carrying a ring of wedge stones, the right side fallen in. */
export const paintArch = (x: number, y: number, scale: number) => {
  const pier = 40 * scale, h = 150 * scale, span = 84 * scale, top = y - h, inner = span - pier / 2, outer = span + pier / 2, stones = 9;
  for (const side of [-1, 1]) {
    const pierX = x + side * span;
    block(pierX - pier / 2 - 5, y + 4, pier + 10, 10);
    block(pierX - pier / 2, y, pier, h);
    block(pierX - pier / 2 - 5, top + 12, pier + 10, 12);
    bury(pierX, y - 8, pier + 30); moss(pierX, y, pier + 12);
  }
  for (let stone = 0; stone < stones; stone++) {
    if (stone === 6 || stone === 7) continue;
    const from = Math.PI + stone * Math.PI / stones, to = from + Math.PI / stones, middle = (from + to) / 2;
    slab(voussoir([x, top], [inner, outer], [from, to]), [x + Math.cos(middle) * span - pier / 2, top + Math.sin(middle) * span + pier / 2, pier, pier], shade(MARBLE, ((stone * 37) % 5 - 2) * .03));
  }
  snowCap(x, top - outer + 4, pier * 1.4);
  for (const [at, size] of [[1.9, 16], [2.5, 12]]) { chunk(x + span * at - 14, y + 6, size * 2, size); bury(x + span * at, y - 4, size * 2); }
};

/** A pedestal in three tiers, its shaft carrying an inscription of worn lines. */
const paintPedestal = (x: number, y: number, [w, shaft]: [number, number]) => {
  block(x - w / 2 - 10, y + 12, w + 20, 10); block(x - w / 2 - 5, y + 2, w + 10, 9);
  block(x - w / 2, y - 6, w, shaft);
  g.strokeStyle = 'rgba(40,40,40,.45)'; g.lineWidth = 1.2; g.beginPath();
  for (let row = 0; row < 3; row++) { g.moveTo(x - w * .3, y - 6 - shaft * (.35 + row * .1)); g.lineTo(x + w * (.3 - row * .08), y - 6 - shaft * (.35 + row * .1)); }
  g.stroke();
  block(x - w / 2 - 7, y - 6 - shaft, w + 14, 10); block(x - w / 2 - 3, y - 16 - shaft, w + 6, 6);
};

/** A worn marble face: brow, hollow eyes, a nose knocked down to a stub, lips, ears, a band of curls and a crack. */
const paintFace = (x: number, y: number, radius: number) => {
  const head = new Path2D(); head.ellipse(x, y, radius * .72, radius, 0, 0, TAU);
  for (const side of [-1, 1]) ellipse({ x: x + side * radius * .72, y: y + radius * .05, radiusX: radius * .1, radiusY: radius * .22, color: shade(MARBLE, -.1) });
  toon(head, { fill: MARBLE, inkColor: shade(MARBLE, -.62), width: 2.2 }, () => {
    ellipse({ x: x + radius * .4, y, radiusX: radius * .5, radiusY: radius * 1.05, color: shade(MARBLE, -.15) });
    ellipse({ x: x - radius * .3, y: y - radius * .3, radiusX: radius * .22, radiusY: radius * .5, rotation: .3, color: shade(MARBLE, .25) });
    weather([x - radius * .72, y + radius, radius * 1.44, radius * 2]);
  });
  g.strokeStyle = shade(MARBLE, -.6); g.lineWidth = 1.6; g.lineCap = 'round'; g.beginPath();
  for (const side of [-1, 1]) { g.moveTo(x + side * radius * .1, y - radius * .22); g.quadraticCurveTo(x + side * radius * .35, y - radius * .36, x + side * radius * .55, y - radius * .2); }
  g.moveTo(x - radius * .06, y - radius * .12); g.lineTo(x - radius * .1, y + radius * .25); g.lineTo(x + radius * .12, y + radius * .3);
  g.moveTo(x - radius * .24, y + radius * .56); g.quadraticCurveTo(x, y + radius * .64, x + radius * .24, y + radius * .54);
  g.moveTo(x - radius * .12, y + radius * .7); g.quadraticCurveTo(x, y + radius * .74, x + radius * .12, y + radius * .7);
  g.stroke();
  for (const side of [-1, 1]) {
    ellipse({ x: x + side * radius * .3, y: y - radius * .06, radiusX: radius * .17, radiusY: radius * .1, color: shade(MARBLE, -.55) });
    ellipse({ x: x + side * radius * .3 - side * radius * .03, y: y - radius * .09, radiusX: radius * .07, radiusY: radius * .04, color: shade(MARBLE, -.2) });
  }
  for (let curl = 0; curl < 11; curl++) {
    const angle = Math.PI * 1.08 + curl / 10 * Math.PI * .84, ring = new Path2D();
    ring.arc(x + Math.cos(angle) * radius * .68, y + Math.sin(angle) * radius * .97 + radius * .08, radius * .17, 0, TAU);
    toon(ring, { fill: shade(MARBLE, -.06), inkColor: shade(MARBLE, -.6), width: 1.3 });
  }
  g.strokeStyle = 'rgba(30,30,30,.5)'; g.lineWidth = 1.2; g.beginPath();
  g.moveTo(x - radius * .3, y - radius * .85); g.lineTo(x - radius * .12, y - radius * .5); g.lineTo(x - radius * .24, y - radius * .3); g.lineTo(x - radius * .05, y); g.stroke();
};

/** A marble bust on a pedestal: neck, draped shoulders and a weathered face. */
export const paintBust = (x: number, y: number, scale: number) => {
  const radius = 30 * scale, w = 66 * scale, shaft = 74 * scale, base = y - 16 - shaft;
  paintPedestal(x, y, [w, shaft]);
  const chest = smoothOutline([[x - radius * 1.6, base], [x - radius * 1.55, base - radius * .35], [x - radius * .95, base - radius * .8], [x - radius * .4, base - radius * .9], [x + radius * .4, base - radius * .9], [x + radius * .95, base - radius * .8], [x + radius * 1.55, base - radius * .35], [x + radius * 1.6, base]]);
  slab(chest, [x - radius * 1.6, base, radius * 3.2, radius * .9]);
  g.strokeStyle = shade(MARBLE, -.5); g.lineWidth = 1.3; g.beginPath();
  for (const side of [-1, 1]) for (let fold = 0; fold < 3; fold++) { g.moveTo(x + side * radius * (.5 + fold * .35), base - radius * .75); g.quadraticCurveTo(x + side * radius * (.7 + fold * .35), base - radius * .35, x + side * radius * (.55 + fold * .4), base); }
  g.stroke();
  block(x - radius * .32, base - radius * .8, radius * .64, radius * .55);
  paintFace(x, base - radius * 1.75, radius);
  snowCap(x, base - radius * 2.7, radius * 1.3); moss(x, y, w); bury(x, y - 8, w + 20);
};

/** A row of columns far behind, darker, some still carrying a stretch of beam: the rest of the colonnade. */
export const paintColonnade = ({ width, scale, ground }: { width: number; scale: number; ground: (x: number) => number }, clear: [number, number][]) => {
  for (let x = 40, index = 0; x < width; x += 120 + (index * 37) % 50, index++) {
    if (!isClear(clear, x - 40, x + 40)) continue;
    const column: Column = { x, y: ground(x) - 14, w: 28 * scale, h: (95 + (index * 53) % 70) * scale, broken: index % 3 !== 1, tone: -.3 };
    paintColumn(column);
    if (!column.broken) chunk(x - 40 * scale, column.y - column.h - CAPITAL, 80 * scale, 16 * scale, shade(MARBLE, -.3));
  }
};

/** Chunks of fallen stone: lumpy, not boxes, half sunk in the sand. */
export const paintRubble = (spots: [number, number, number][]) => {
  spots.forEach(([x, y, size], index) => {
    const random = rng(900 + index * 17), w = size * 1.8, h = size;
    const points = Array.from({ length: 7 }, (_, corner): Point => {
      const angle = corner / 7 * TAU;
      return [x + Math.cos(angle) * w / 2 * (.7 + random() * .3), Math.min(y, y - h / 2 + Math.sin(angle) * h / 2 * (.7 + random() * .3))];
    });
    slab(poly(...points), [x - w / 2, y, w, h], shade(MARBLE, -.05 - random() * .1));
    bury(x, y - h * .35, w + 10);
  });
};
