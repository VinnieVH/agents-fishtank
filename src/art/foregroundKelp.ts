import { rng, shade, TAU } from '../util';
import { isClear, keepClear } from './chestSpot';
import type { ForegroundArt, Setting, Swayer } from './foregroundTypes';
import { isSnowy, sandOver, smoothOutline } from './reefRock';
import type { Ground } from './reefRock';
import { ellipse, ink, toon } from './sceneryPen';
import type { Point } from './sceneryPen';

interface Boulder { x: number; y: number; w: number; h: number; color: string; seed: number }

const GOLDEN = .6180339887;
const KELP_SPACING = 38;
const GRASS_SPACING = 60;
const BOULDER_COLORS = ['#5a6a5a', '#66705e', '#52625f', '#6d6c62'];
const KELP_COLORS = ['#7d9230', '#a08c2e', '#5f9238', '#b0822c', '#6f8f3a'];
const GRASS_COLORS = ['#5fae4a', '#7cc04f', '#4e9c5a'];
const BULB_COLORS = ['#8a6a2a', '#9a7a30', '#7a6a28'];
const RED_COLORS = ['#c0524a', '#b04a6a', '#d0704a'];
const URCHIN_COLORS = ['#6a3a8a', '#8a3a6a', '#3a3a8a'];

/** Boulders sit in three rows: small, hazy ones far back, big ones forward on the sand. */
const ROWS = [{ lift: -16, scale: .7, fade: -.18 }, { lift: 0, scale: 1, fade: 0 }, { lift: 26, scale: 1.2, fade: .06 }];

/** The boulders on the floor, back to front: spot i of an endless sequence, so a wider tank keeps its boulders and adds new ones. */
const boulders = (width: number, sandLine: number): Boulder[] => {
  const clear = keepClear(width), count = Math.max(5, Math.round(width / 120));
  return Array.from({ length: count }, (_, index): Boulder => {
    const random = rng(7100 + index * 131), row = ROWS[(index * 7 + 1) % 3], w = (80 + random() * 100) * row.scale;
    return { x: (.07 + index * GOLDEN) % 1 * width, y: sandLine - 6 + row.lift + random() * 6, w, h: w * (.34 + random() * .22), color: shade(BOULDER_COLORS[index % 4], row.fade), seed: 7300 + index };
  }).filter(boulder => isClear(clear, boulder.x - boulder.w / 2, boulder.x + boulder.w / 2)).sort((first, second) => first.y - second.y);
};

const paintMoss = (boulder: Boulder, random: () => number) => {
  const { x, y, w, h } = boulder;
  for (let patch = 0; patch < 4 + w / 30; patch++) {
    const patchX = x + (random() - .5) * w * .85, patchY = y - random() * h * .9;
    ellipse({ x: patchX, y: patchY, radiusX: 6 + random() * 12, radiusY: 3 + random() * 4, rotation: random() - .5, color: random() < .5 ? '#7fae5a' : '#4f8a4a', alpha: .8 });
  }
};

const paintBoulder = (boulder: Boulder, ground: Ground) => {
  const { x, y, w, h, color } = boulder, random = rng(boulder.seed);
  const top = Array.from({ length: 11 }, (_, step): Point => {
    const angle = Math.PI + step / 10 * Math.PI, wobble = 1 + (random() - .5) * .2;
    return [x + Math.cos(angle) * w / 2 * wobble, y + Math.sin(angle) * h * wobble];
  });
  const outline = smoothOutline([...top, [x + w / 2 + 4, y + 12], [x - w / 2 - 4, y + 12]]);
  toon(outline, { fill: color, inkColor: '#1d2a22', width: 2.4 }, () => {
    ellipse({ x: x + w * .3, y: y - h * .1, radiusX: w * .45, radiusY: h * .9 + 12, color: shade(color, -.3) });
    ellipse({ x: x - w * .2, y: y - h * .7, radiusX: w * .28, radiusY: h * .22, rotation: -.2, color: shade(color, .3) });
    paintMoss(boulder, random);
    ellipse({ x, y: y + 4, radiusX: w * .6, radiusY: 9, color: '#0e1612', alpha: .35 });
  });
  if (isSnowy()) ellipse({ x: x - w * .08, y: y - h * .78, radiusX: w * .34, radiusY: h * .2, rotation: -.08, color: '#f3f8fd' });
  sandOver([x - w / 2 - 6, x + w / 2 + 6], y, ground);
};

/** A purple sea urchin on the sand: ink-dark spines round a round body. */
const paintUrchin = ([x, y]: Point, color: string) => {
  const spines = new Path2D();
  for (let spine = 0; spine < 16; spine++) {
    const angle = spine * TAU / 16;
    spines.moveTo(x + Math.cos(angle) * 6, y + Math.sin(angle) * 5);
    spines.lineTo(x + Math.cos(angle) * 12, y + Math.sin(angle) * 10);
  }
  ink(spines, { color: shade(color, -.6), width: 2.2 });
  ink(spines, { color: shade(color, .1), width: 1 });
  const body = new Path2D(); body.ellipse(x, y, 7, 6, 0, 0, TAU);
  toon(body, { fill: color, inkColor: shade(color, -.7), width: 1.4 }, () => ellipse({ x: x - 2.4, y: y - 2.4, radiusX: 2.4, radiusY: 1.4, rotation: -.5, color: shade(color, .5) }));
};

const paintUrchins = ({ width, sandLine, ground }: Setting) => {
  const clear = keepClear(width), random = rng(8800);
  for (let index = 0; index < Math.max(3, Math.round(width / 260)); index++) {
    const x = (.19 + index * GOLDEN) % 1 * width, y = ground(x) + 16 + random() * 26;
    if (isClear(clear, x - 14, x + 14)) paintUrchin([x, Math.max(y, sandLine + 12)], URCHIN_COLORS[index % 3]);
  }
};

/** Lower growth round the boulders: bull kelp on the sand, red seaweed fans up their sides. */
const understory = (stands: Boulder[]): Swayer[] => {
  const plants: Swayer[] = [];
  stands.forEach((stand, index) => {
    const random = rng(6900 + index * 37), side = index % 2 ? 1 : -1;
    plants.push({ kind: 'bulb', x: stand.x + side * (stand.w * .5 + 10 + random() * 14), y: stand.y + 8, size: 90 + random() * 60, color: BULB_COLORS[index % 3], seed: 6950 + index });
    plants.push({ kind: 'fan', x: stand.x - side * stand.w * .2, y: stand.y - stand.h * .3, size: 70 + random() * 40, color: RED_COLORS[index % 3], seed: 6980 + index });
  });
  return plants;
};

/** Kelp growing from the boulders (their feet are hidden behind them), and clumps of eelgrass on the sand. */
const swayers = (width: number, height: number): Swayer[] => {
  const sandLine = height - 70, water = sandLine - 40, clear = keepClear(width), plants: Swayer[] = [];
  const stands = boulders(width, sandLine);
  for (let index = 0, count = Math.max(8, Math.round(width / KELP_SPACING)); index < count; index++) {
    const random = rng(6200 + index * 53), stand = stands[index % stands.length];
    const x = stand.x + (random() - .5) * stand.w * .5, y = stand.y - stand.h * .45;
    const size = 170 + Math.pow(random(), 1.3) * (water * .92 - 170);
    plants.push({ kind: 'kelp', x, y, size, color: KELP_COLORS[index % KELP_COLORS.length], seed: 6300 + index });
  }
  for (let index = 0, count = Math.max(4, Math.round(width / GRASS_SPACING)); index < count; index++) {
    const random = rng(6600 + index * 41), x = (.13 + index * GOLDEN) % 1 * width;
    if (isClear(clear, x - 20, x + 20) && stands.every(stand => Math.abs(stand.x - x) > stand.w / 2 + 22)) plants.push({ kind: 'grass', x, y: sandLine + 14 + random() * 26, size: 50 + random() * 40, color: GRASS_COLORS[index % 3], seed: 6700 + index });
  }
  return [...plants, ...understory(stands)];
};

/** The kelp forest: mossy boulders, tall swaying kelp and eelgrass, sea urchins on the sand. */
export const kelpForeground: ForegroundArt = {
  paint: setting => {
    for (const boulder of boulders(setting.width, setting.sandLine)) paintBoulder(boulder, setting.ground);
    paintUrchins(setting);
  },
  swayers,
  hasAnemones: false,
  container: 'clam',
};
