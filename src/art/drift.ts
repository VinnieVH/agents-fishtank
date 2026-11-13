import type { Texture } from 'pixi.js';
import type { SeasonId } from '../seasons';
import { TAU } from '../util';
import { paintTexture } from './canvas';
import { drawInto, g, poly } from './sceneryPen';
import { circle, curve, line, oval, stroke } from './shapes';

export type DriftShape = 'flake' | 'heart' | 'petal' | 'leaf' | 'spark' | 'confetti' | 'bubble' | 'bat';

/** What drifts through the water in each season: its shape, colours (tints), speed (negative rises) and size. */
export interface Drifting { shape: DriftShape; tints: number[]; fall: number; size: number }

export const DRIFT: Record<SeasonId, Drifting> = {
  lunar: { shape: 'spark', tints: [0xffd84d, 0xff4040], fall: .3, size: 9 },
  love: { shape: 'heart', tints: [0xff5c8a, 0xff9ab5, 0xff2e63], fall: -.5, size: 12 },
  spring: { shape: 'petal', tints: [0xffb7d5, 0xffffff, 0xffd0e0], fall: .45, size: 10 },
  midsummer: { shape: 'spark', tints: [0xffd24d, 0xff9a3d], fall: -.35, size: 8 },
  brewfest: { shape: 'bubble', tints: [0xffe08a, 0xfff2c0], fall: -.7, size: 11 },
  halloween: { shape: 'bat', tints: [0x2b1b3d, 0x4a2a6a], fall: .25, size: 16 },
  thanksgiving: { shape: 'leaf', tints: [0xc8641e, 0x8b4513, 0xe8a23a], fall: .5, size: 13 },
  winter: { shape: 'flake', tints: [0xffffff, 0xdff2ff], fall: .55, size: 9 },
};

const SIZE = 16, MIDDLE = SIZE / 2;

// white shapes about the middle of a SIZE box: a sprite's tint gives them their colour
const SHAPES: Record<DriftShape, () => void> = {
  flake: () => {
    for (let arm = 0; arm < 3; arm++) { g.save(); g.rotate(arm * TAU / 6); stroke(line([-6, 0], [6, 0]), '#fff', 1.6); g.restore(); }
  },
  heart: () => {
    g.fillStyle = '#fff';
    g.fill(curve([0, 6], [[-9, 0], [-7, -7], [-3, -7]], [[-1, -7], [0, -5], [0, -4]]));
    g.fill(curve([0, 6], [[9, 0], [7, -7], [3, -7]], [[1, -7], [0, -5], [0, -4]]));
  },
  petal: () => { g.fillStyle = '#fff'; g.fill(oval(0, 0, 3.4, 6.4, .5)); },
  leaf: () => {
    g.fillStyle = '#fff'; g.fill(curve([-6, 5], [[-6, -3], [1, -7], [6, -6]], [[7, 0], [1, 6], [-6, 5]]));
    stroke(line([-6, 5], [3, -3]), 'rgba(0,0,0,.35)', 1);
  },
  spark: () => { g.fillStyle = '#fff'; g.fill(poly([0, -7], [1.6, -1.6], [7, 0], [1.6, 1.6], [0, 7], [-1.6, 1.6], [-7, 0], [-1.6, -1.6])); },
  confetti: () => { g.fillStyle = '#fff'; g.fillRect(-4, -2, 8, 4); },
  bubble: () => { stroke(circle(0, 0, 5), '#fff', 1.4); g.fillStyle = 'rgba(255,255,255,.5)'; g.fill(circle(-1.8, -1.8, 1.4)); },
  bat: () => { g.fillStyle = '#fff'; g.fill(poly([0, -2], [3, -5], [8, -3], [6, 0], [4, 1], [2, 3], [0, 2], [-2, 3], [-4, 1], [-6, 0], [-8, -3], [-3, -5])); },
};

const cache = new Map<DriftShape, Texture>();

/** The shape's white texture, painted once. */
export const driftTexture = (shape: DriftShape, resolution: number): Texture => {
  const cached = cache.get(shape);
  if (cached) return cached;
  const texture = paintTexture({ w: SIZE, h: SIZE }, resolution * 2, context => {
    drawInto(context); g.translate(MIDDLE, MIDDLE); SHAPES[shape]();
  });
  cache.set(shape, texture);
  return texture;
};

/** How big the texture is, for scaling a drifting bit to the size it should show at. */
export const DRIFT_TEXTURE_SIZE = SIZE;
