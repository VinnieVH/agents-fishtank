import { ellipse, g, ink, poly, toon } from './sceneryPen';
import { shade } from '../util';
import type { Point } from './sceneryPen';
import { smoothOutline } from './reefRock';
import { circle, curve, dot, line, open, oval, shadow, solid, stroke } from './shapes';
import { gift } from './propsWinter';

// The winter holiday's big props, standing on the sand at (0, 0), up being negative y.

const GREEN = '#1c9356';

interface Tier { half: number; base: number; apex: number }

/** A tier of the tree: a soft cone whose bottom edge droops into boughs. */
const bough = ({ half, base, apex }: Tier) => {
  const teeth = 4, edge = half, step = edge * 2 / teeth, shoulder = apex + (base - apex) * .5;
  const points: Point[] = [[0, apex], [half * .5, shoulder], [edge, base - 2]];
  for (let index = 0; index < teeth; index++) {
    points.push([edge - step * (index + .5), base + 6]);
    if (index < teeth - 1) points.push([edge - step * (index + 1), base - 1]);
  }
  points.push([-edge, base - 2], [-half * .5, shoulder]);
  return smoothOutline(points);
};

/** The tier's shading, like the corals': a dark side, a light rim, grooves between the boughs and needle specks. */
const shadeTier = ({ half, base, apex }: Tier) => {
  const rise = base - apex;
  ellipse({ x: half * .75, y: base - rise * .35, radiusX: half * .6, radiusY: rise * .8, color: shade(GREEN, -.3) });
  ellipse({ x: -half * .78, y: base - rise * .45, radiusX: half * .2, radiusY: rise * .5, rotation: .3, color: shade(GREEN, .3), alpha: .6 });
  for (const lane of [-.55, 0, .55]) {
    const groove = open([half * lane, base + 4], [[half * lane * .9, base - rise * .3], [half * lane * .6, base - rise * .55], [half * lane * .35, base - rise * .75]]);
    ink(groove, { color: shade(GREEN, -.5), width: .8, alpha: .8 });
  }
  for (let speck = 0; speck < 9; speck++) {
    ellipse({ x: ((speck * 37) % 100 / 100 - .5) * half * 1.3, y: base - rise * (.15 + (speck * 53) % 60 / 100), radiusX: 1.3, radiusY: .8, color: shade(GREEN, .5) });
  }
};

const ribbon = (path: Path2D, ribbonLine: Path2D) => {
  g.save(); g.clip(path); ink(ribbonLine, { color: '#8a1236', width: 4.6 }); ink(ribbonLine, { color: '#f0306a', width: 3 }); g.restore();
};

const bauble = (x: number, y: number, color: string) => {
  dot(x, y, 4.2, color); g.globalAlpha = .85; g.fillStyle = '#fff'; g.fill(oval(x - 1.4, y - 1.6, 1.2, .8, -.6)); g.globalAlpha = 1;
};

const bell = (x: number, y: number) => {
  solid(curve([x - 4, y + 3], [[x - 4.4, y - 6], [x + 4.4, y - 6], [x + 4, y + 3]], [[x + 5, y + 4.6], [x - 5, y + 4.6], [x - 4, y + 3]]), '#f5b82e');
  dot(x, y + 5.4, 1.3, '#a0661a'); dot(x - 2, y - 6, 1.6, '#e8283f'); dot(x + 2, y - 6, 1.6, '#e8283f');
};

const miniCane = (x: number, y: number) => {
  const hook = new Path2D(); hook.moveTo(x, y); hook.lineTo(x, y - 10); hook.arc(x - 3, y - 10, 3, 0, -Math.PI, true);
  g.lineCap = 'round'; g.strokeStyle = '#6b1018'; g.lineWidth = 4.2; g.stroke(hook);
  g.strokeStyle = '#fff'; g.lineWidth = 2.6; g.stroke(hook);
  g.strokeStyle = '#e8283f'; g.setLineDash([1.8, 2.8]); g.stroke(hook); g.setLineDash([]);
};

const star = () => {
  const points = Array.from({ length: 10 }, (_, index): Point => {
    const radius = index % 2 ? 4.4 : 10, angle = -Math.PI / 2 + index * Math.PI / 5;
    return [Math.cos(angle) * radius, -121 + Math.sin(angle) * radius];
  });
  solid(poly(...points), '#ffd86b');
  stroke(line([-2.5, -123], [-2.5, -119]), '#fff', 1);
};

export const tree = () => {
  shadow(34); solid(poly([-7, 0], [7, 0], [5, -16], [-5, -16]), '#6b4128');
  const tiers: Tier[] = [{ half: 38, base: -14, apex: -56 }, { half: 30, base: -46, apex: -92 }, { half: 20, base: -80, apex: -118 }];
  const ribbons = [open([-42, -50], [[-14, -40], [16, -28], [42, -20]]), open([-32, -86], [[-10, -76], [10, -62], [32, -52]]), open([-20, -112], [[-8, -102], [4, -92], [20, -84]])];
  tiers.forEach((tierShape, index) => {
    const path = bough(tierShape);
    toon(path, { fill: GREEN, inkColor: shade(GREEN, -.7), width: 2 }, () => { shadeTier(tierShape); });
    ribbon(path, ribbons[index]);
  });
  [[-28, -24, '#ff9bb4'], [26, -30, '#2fe6a0'], [-4, -38, '#ff7a8a'], [-18, -56, '#2fe6a0'], [16, -64, '#ff9bb4'], [-2, -76, '#ff7a8a'], [8, -96, '#ff9bb4'], [-6, -104, '#2fe6a0']]
    .forEach(([x, y, color]) => { bauble(Number(x), Number(y), String(color)); });
  miniCane(-12, -22); miniCane(14, -50); miniCane(-4, -88);
  bell(-32, -18); bell(27, -50); bell(-17, -78);
  star();
};

/** The snow a prop is stuck in, like the chest's: a low drift over its foot, drawn after it. */
const snowDrift = (halfWidth: number) => {
  const hump = new Path2D(); hump.ellipse(0, 9, halfWidth, halfWidth * .17, 0, Math.PI, 0);
  g.fillStyle = '#eef5fc'; g.fill(hump); stroke(hump, '#5f7fa3', 2);
};

/** Gifts [x, y, wrap, size] scattered round the tree: some behind it, some in front. */
const GIFTS_BEHIND: number[][] = [[-28, -6, 11, .8], [26, -8, 20, .8], [-10, -11, 5, .8], [12, -12, 30, .75]];
const GIFTS_FRONT: number[][] = [[-33, 4, 17, .8], [-20, 9, 2, .8], [-6, 3, 27, .85], [8, 9, 12, .8], [22, 4, 6, .85], [34, 9, 31, .75]];

const giftsAt = (gifts: number[][]) => {
  for (const [x, y, index, size] of gifts) { g.save(); g.translate(x, y); g.scale(size * .7, size * .7); gift(index); g.restore(); }
};

/** The tree, stuck in snow with gifts scattered around it. */
export const snowyTree = () => {
  g.save(); g.translate(0, -2);
  giftsAt(GIFTS_BEHIND);
  tree();
  snowDrift(48);
  giftsAt(GIFTS_FRONT);
  g.restore();
};

const ball = (x: number, y: number, radius: number) => {
  solid(circle(x, y, radius), '#fff');
  g.save(); g.clip(circle(x, y, radius)); g.fillStyle = '#dce8f1'; g.fill(oval(x + radius * .5, y + radius * .4, radius * .9, radius * 1.1)); g.restore();
  stroke(circle(x, y, radius), '#8fb0c8', 1.2);
};

const twig = (side: number, from: Point, to: Point) => {
  stroke(line(from, to), '#8a5a2c', 2.2); stroke(line([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], [to[0] - side * 6, to[1] - 9]), '#8a5a2c', 1.6);
};

export const snowman = () => {
  shadow(22); twig(-1, [-14, -50], [-40, -58]); twig(1, [14, -52], [38, -66]);
  ball(0, -20, 21); ball(0, -50, 15.5); ball(0, -74, 12.5);
  solid(oval(0, -62, 12.5, 3.2), '#e0243f'); solid(poly([3, -61], [9, -59], [10, -46], [4, -46]), '#e0243f');
  dot(-4.6, -77, 2, '#222'); dot(4.6, -77, 2, '#222'); g.globalAlpha = .55; g.fillStyle = '#ff8aa0'; g.fill(oval(-8, -72, 2.6, 1.6)); g.fill(oval(8, -72, 2.6, 1.6)); g.globalAlpha = 1;
  solid(poly([-1, -74], [11, -71], [-1, -69]), '#ff8a1c'); stroke(open([-5.4, -68], [[-3, -63], [3, -63], [5.4, -68]]), '#222', 1.4);
  dot(0, -52, 2.4, '#ff6a3d'); dot(0, -44, 2.4, '#ff6a3d');
  solid(oval(0, -85, 14.5, 3.2), '#2b2b33'); solid(poly([-8.5, -85], [8.5, -85], [8.5, -102], [-8.5, -102]), '#2b2b33');
  solid(poly([-8.5, -91], [8.5, -91], [8.5, -94.6], [-8.5, -94.6]), '#e0243f'); solid(oval(0, -102, 8.5, 2.4), '#3a3a45');
};

  /** The snowman, stuck in snow. */
export const snowySnowman = () => {
  snowman();
};
