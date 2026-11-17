import { Graphics, type Renderer } from 'pixi.js';
import type { SwayKind, Swayer } from '../art/foregroundTypes';
import { rng, shade, TAU } from '../util';

/** A plant that sways (art/foregroundTypes.ts), `h` tall; `id` tells it apart from all the others. */
export interface Soft { id: number; kind: SwayKind; x: number; y: number; h: number; color: string; seed: number; phase: number }
type Point = [number, number];
interface Branch { x: number; y: number; length: number; angle: number; w: number; depth: number }
type SoftPainter = (g: Graphics, coral: Soft, random: () => number) => void;

/** How far each kind sways over (as a fraction of its height) and how slowly (ms): fans flex a little, whips and kelp a lot. */
export const SWAY: Record<SwayKind, [number, number]> = { fan: [.04, 2300], whip: [.14, 1700], tree: [.07, 1500], kelp: [.1, 2800], grass: [.09, 2000], bulb: [.12, 2400] };

/** Strokes a list of [x1, y1, x2, y2, width] segments three times: ink, colour, and a light rim on the left. */
const strokeBranches = (g: Graphics, segments: number[][], color: string) => {
  const layers = [[shade(color, -.65), 3, 1, 0], [color, 0, 1, 0], [shade(color, .45), 0, .3, -.25]] as const;
  for (const [strokeColor, extraWidth, widthScale, rimShift] of layers) {
    for (const [x1, y1, x2, y2, w] of segments) {
      g.moveTo(x1 + rimShift * w, y1).lineTo(x2 + rimShift * w, y2).stroke({ width: w * widthScale + extraWidth, color: strokeColor, cap: 'round' });
    }
  }
};

/** A leaf from `from` to `tip`, `width` across at its widest and bowed sideways by `bend`: a filled lens in ink, with a lighter midrib. */
const paintBlade = (g: Graphics, { from, tip, width, bend = 0 }: { from: Point; tip: Point; width: number; bend?: number }, color: string) => {
  const dx = tip[0] - from[0], dy = tip[1] - from[1], length = Math.hypot(dx, dy) || 1;
  const middleX = (from[0] + tip[0]) / 2 + bend, middleY = (from[1] + tip[1]) / 2;
  const sideX = -dy / length * width, sideY = dx / length * width;
  g.moveTo(...from).quadraticCurveTo(middleX + sideX, middleY + sideY, ...tip).quadraticCurveTo(middleX - sideX, middleY - sideY, ...from).closePath()
    .fill(color).stroke({ width: 1.8, color: shade(color, -.65), join: 'round' });
  g.moveTo(...from).quadraticCurveTo(middleX, middleY, ...tip).stroke({ width: 1, color: shade(color, .45), alpha: .6 });
};

/** A sea fan: one flat fan of ever finer branches, spread wide like a net. */
const paintFan: SoftPainter = (g, coral, random) => {
  const segments: number[][] = [];
  const grow = ({ x, y, length, angle, w, depth }: Branch): void => {
    if (!depth) return;
    const x2 = x + Math.cos(angle) * length, y2 = y + Math.sin(angle) * length;
    segments.push([x, y, x2, y2, w]);
    const spread = .22 + random() * .2;
    grow({ x: x2, y: y2, length: length * .78, angle: angle - spread, w: Math.max(1, w * .72), depth: depth - 1 });
    grow({ x: x2, y: y2, length: length * .78, angle: angle + spread, w: Math.max(1, w * .72), depth: depth - 1 });
  };
  grow({ x: 0, y: 0, length: coral.h * .16, angle: -Math.PI / 2, w: Math.max(3, coral.h * .022), depth: 7 });
  strokeBranches(g, segments, coral.color);
  for (const [, , x2, y2] of segments.slice(-64)) g.circle(x2, y2, 1.6).fill(shade(coral.color, .55));
};

/** Sea whips: a bunch of long, thin rods covered in little polyps. */
const paintWhip: SoftPainter = (g, coral, random) => {
  for (let rod = 0, rods = 4 + Math.floor(random() * 4); rod < rods; rod++) {
    const offset = rod / (rods - 1) - .5, length = coral.h * (.6 + random() * .4);
    const lean = offset * .5 + (random() - .5) * .15, bend = (random() - .5) * .5;
    const points: Point[] = [[offset * 10, 0]];
    for (let step = 1; step <= 14; step++) {
      const along = step / 14, angle = lean + bend * along * along, [lastX, lastY] = points[step - 1];
      points.push([lastX + Math.sin(angle) * length / 14, lastY - Math.cos(angle) * length / 14]);
    }
    const segments = points.slice(1).map(([x, y], index) => [points[index][0], points[index][1], x, y, 5.5 - 2.5 * index / 14]);
    strokeBranches(g, segments, coral.color);
    for (let index = 1; index < points.length; index++) {
      g.circle(points[index][0] + (index % 2 ? 1.6 : -1.6), points[index][1], 1.2).fill(shade(coral.color, .6));
    }
  }
};

/** A tree coral: a pale, see-through trunk branching out into clusters of bright round lobes. */
const paintTree: SoftPainter = (g, coral, random) => {
  const segments: number[][] = [], ends: Point[] = [];
  const grow = ({ x, y, length, angle, w, depth }: Branch): void => {
    const x2 = x + Math.cos(angle) * length, y2 = y + Math.sin(angle) * length;
    segments.push([x, y, x2, y2, w]);
    if (!depth) { ends.push([x2, y2]); return; }
    for (let index = 0, count = 2 + (random() < .4 ? 1 : 0); index < count; index++) {
      grow({ x: x2, y: y2, length: length * .7, angle: angle + (index - (count - 1) / 2) * .6 + (random() - .5) * .2, w: w * .65, depth: depth - 1 });
    }
  };
  grow({ x: 0, y: 0, length: coral.h * .32, angle: -Math.PI / 2, w: Math.max(4, coral.h * .06), depth: 3 });
  for (const [x1, y1, x2, y2, w] of segments) g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: w + 3, color: shade(coral.color, -.6), cap: 'round', alpha: .8 });
  for (const [x1, y1, x2, y2, w] of segments) g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: w, color: shade(coral.color, .65), cap: 'round', alpha: .85 });
  for (const [endX, endY] of ends) for (let index = 0, count = 7 + Math.floor(random() * 5); index < count; index++) {
    const angle = random() * TAU, distance = random() * 10;
    const x = endX + Math.cos(angle) * distance, y = endY + Math.sin(angle) * distance * .8, radius = 3.5 + random() * 3.5;
    g.circle(x, y, radius).fill(coral.color).stroke({ width: 1.3, color: shade(coral.color, -.65) });
    g.circle(x - radius * .3, y - radius * .3, radius * .35).fill({ color: 0xffffff, alpha: .6 });
  }
};

/** Kelp: a long, slender stalk with a wide blade at every node, each with a little gas bladder at its foot. */
const paintKelp: SoftPainter = (g, coral, random) => {
  const nodes = 14, spine: Point[] = [[0, 0]];
  for (let step = 1; step <= nodes; step++) {
    const along = step / nodes;
    spine.push([Math.sin(along * 5 + coral.seed % 7) * 12 * along, -along * coral.h]);
  }
  strokeBranches(g, spine.slice(1).map(([x, y], index) => [spine[index][0], spine[index][1], x, y, 5 - 2.4 * index / nodes]), shade(coral.color, -.25));
  for (let node = 2; node <= nodes; node++) {
    const [x, y] = spine[node], side = node % 2 ? 1 : -1, lean = .45 + random() * .6, length = (34 + random() * 40) * (1 - .25 * node / nodes);
    paintBlade(g, { from: [x, y], tip: [x + Math.sin(side * lean) * length, y - Math.cos(side * lean) * length * 1.1], width: 5 + random() * 4, bend: side * 6 }, coral.color);
    g.circle(x + side * 3, y, 3.2).fill('#e3d27a').stroke({ width: 1.2, color: shade(coral.color, -.7) });
  }
  paintBlade(g, { from: spine[nodes], tip: [spine[nodes][0], spine[nodes][1] - 52], width: 8 }, coral.color);
};

/** A clump of long, bright leaves fanning out of the ground: eelgrass, or a plastic plant. */
const paintGrass: SoftPainter = (g, coral, random) => {
  for (let leaf = 0, leaves = 5 + Math.floor(random() * 4); leaf < leaves; leaf++) {
    const across = leaf / (leaves - 1) - .5, length = coral.h * (.6 + random() * .4);
    const lean = across * length * .7 + (random() - .5) * 8;
    paintBlade(g, { from: [across * 10, 0], tip: [across * 10 + lean, -length], width: Math.max(3.5, coral.h * .045), bend: (random() - .5) * 18 }, shade(coral.color, (random() - .5) * .3));
  }
};

/** Bull kelp: a thin stalk bowing up to a gas bulb, with long strap blades streaming from it. */
const paintBulb: SoftPainter = (g, coral, random) => {
  const steps = 8, spine: Point[] = [[0, 0]], bow = (random() - .5) * coral.h * .3;
  for (let step = 1; step <= steps; step++) spine.push([bow * Math.sin(step / steps * Math.PI / 2), -step / steps * coral.h * .8]);
  strokeBranches(g, spine.slice(1).map(([x, y], index) => [spine[index][0], spine[index][1], x, y, 4 - 1.5 * index / steps]), shade(coral.color, -.25));
  const [top, topY] = spine[steps];
  for (let strap = 0, straps = 6; strap < straps; strap++) {
    const across = strap / (straps - 1) - .5, length = coral.h * (.4 + random() * .25);
    paintBlade(g, { from: [top, topY], tip: [top + across * length * 1.1, topY - length * .9], width: 5 + random() * 3, bend: across * 14 }, shade(coral.color, (random() - .5) * .25));
  }
  g.ellipse(top, topY, 7, 9).fill('#d8c46a').stroke({ width: 1.6, color: shade(coral.color, -.7) });
  g.ellipse(top - 2, topY - 3, 2, 3).fill({ color: 0xffffff, alpha: .6 });
};

// Cartoon style like the fish: branches stroked in ink, colour and a light rim; polyps and lobes with a shine.
export const SOFT_PAINTERS: Record<SwayKind, SoftPainter> = { fan: paintFan, whip: paintWhip, tree: paintTree, kelp: paintKelp, grass: paintGrass, bulb: paintBulb };

/** The plants that sway for these swayers (art/foregroundTypes.ts), the taller ones first so they stand further back. */
export const plantsFrom = (swayers: Swayer[]): Soft[] =>
  swayers.map((coral, index): Soft => ({ ...coral, id: index, h: coral.size, phase: rng(coral.seed)() * TAU })).sort((one, other) => other.h - one.h);

/** A plant drawn once into a texture, and where its top left corner is from its foot. */
export const drawPlant = (renderer: Renderer, plant: Soft) => {
  const graphics = new Graphics();
  SOFT_PAINTERS[plant.kind](graphics, { ...plant, x: 0, y: 0 }, rng(plant.seed));
  const bounds = graphics.getLocalBounds();
  const art = { texture: renderer.generateTexture({ target: graphics, resolution: renderer.resolution, antialias: true }), x: bounds.x, y: bounds.y };
  graphics.destroy();
  return art;
};
