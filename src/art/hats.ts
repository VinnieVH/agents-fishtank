import type { Texture } from 'pixi.js';
import type { SeasonId } from '../seasons';
import { paintTexture } from './canvas';
import { drawInto, ellipse, g, poly } from './sceneryPen';
import { curve, dot, open, oval, solid, stroke } from './shapes';

/** The size of a hat's drawing, for a fish this big (Fish.size): it is scaled to the fish it sits on. */
export const HAT_FISH_SIZE = 40;
const BOX = 64;

// Every hat is drawn with its bottom middle at (0, 0), up being negative y.

const santa = () => {
  const cap = curve([15, -5], [[15, -18], [10, -29], [1, -30]], [[-10, -31], [-22, -22], [-27, -12]], [[-23, -10], [-17, -8], [-14, -5]]);
  solid(cap, '#e8120f');
  g.fillStyle = '#a80f14'; g.fill(curve([15, -5], [[15, -18], [10, -29], [1, -30]], [[6, -22], [8, -12], [5, -5]]));
  stroke(open([-2, -22], [[-6, -18], [-9, -12], [-11, -8]]), '#7a0d12', 1.2);
  dot(-27, -10, 5, '#fff'); g.fillStyle = '#dbe6ea'; g.fill(curve([-25, -6], [[-22, -8], [-22, -13], [-24, -15]], [[-23, -12], [-24, -8], [-25, -6]]));
  solid(curve([-17, -3], [[-18, -9], [-8, -9], [0, -9]], [[9, -9], [19, -9], [18, -3]], [[17, 3], [8, 4], [0, 4]], [[-9, 4], [-16, 3], [-17, -3]]), '#fff');
  g.fillStyle = '#dbe6ea'; g.fill(curve([6, -8.5], [[12, -9], [18, -9], [18, -3]], [[17, 3], [8, 4], [0, 4]], [[8, 0], [9, -4], [6, -8.5]]));
};

const witch = () => {
  solid(oval(0, -3, 19, 4.5), '#2b1b3d');
  solid(curve([-9, -4], [[-5, -14], [-3, -26], [6, -37]], [[6, -26], [8, -14], [10, -4]]), '#3d2658');
  solid(poly([-8.4, -8], [9, -8], [9.6, -3.4], [-9.4, -3.4]), '#ff8a1c');
  solid(poly([-2, -8.8], [3, -8.8], [3, -3], [-2, -3]), '#ffd23d');
};

const pilgrim = () => {
  solid(oval(0, -3.5, 16, 3.6), '#262626'); solid(poly([-9.5, -4], [-8, -24], [8, -24], [9.5, -4]), '#333');
  solid(poly([-9, -10], [9, -10], [9.4, -4.6], [-9.4, -4.6]), '#8a5a2c'); solid(poly([-3, -11], [3, -11], [3, -4], [-3, -4]), '#f2c94c');
};

const brewfest = () => {
  solid(oval(0, -3.5, 16, 4), '#3b7a3b');
  solid(curve([-10, -5], [[-10, -16], [-4, -19], [0, -17]], [[4, -19], [10, -16], [10, -5]]), '#4f9a4f');
  solid(poly([-10, -10], [10, -10], [10, -6], [-10, -6]), '#8a2f2f');
  solid(curve([5, -9], [[10, -22], [16, -24], [20, -28]], [[17, -20], [12, -14], [8, -8]]), '#fff3d6');
};

const bunny = () => {
  for (const side of [-1, 1]) {
    solid(oval(side * 7, -17, 4.6, 14, side * .22), '#f5f0ef');
    ellipse({ x: side * 7.3, y: -16, radiusX: 2.2, radiusY: 10, rotation: side * .22, color: '#ff9db8' });
  }
};

const love = () => {
  solid(curve([0, -2], [[-14, -10], [-12, -22], [-5, -22]], [[-1, -22], [0, -19], [0, -18]]), '#ff4d7e');
  solid(curve([0, -2], [[14, -10], [12, -22], [5, -22]], [[1, -22], [0, -19], [0, -18]]), '#ff4d7e');
  ellipse({ x: -5.5, y: -17, radiusX: 2, radiusY: 1.2, rotation: -.6, color: '#fff', alpha: .7 });
};

const lunar = () => {
  solid(curve([-12, -3], [[-12, -17], [12, -17], [12, -3]]), '#d8232a');
  solid(poly([-13, -6], [13, -6], [13, 0], [-13, 0]), '#f5b82e'); dot(0, -15, 3, '#f5b82e');
  stroke(poly([-9, -6.5], [9, -6.5]), '#8a1218', 1);
  solid(poly([11.5, -4], [14.5, -4], [15.5, 7], [10.5, 7]), '#f5b82e');
};

const children = () => {
  solid(poly([-10, -3], [0, -32], [10, -3]), '#3dc8ff');
  g.save(); g.clip(poly([-10, -3], [0, -32], [10, -3]));
  ['#ffd23d', '#ff4d8d', '#8f5cff'].forEach((color, index) => { g.fillStyle = color; g.fillRect(-12, -25 + index * 8, 24, 3.6); });
  g.restore(); stroke(poly([-10, -3], [0, -32], [10, -3]), '#14506b', 1.6); dot(0, -33, 3.6, '#ffd23d');
};

const midsummer = () => {
  const colors = ['#ff6fa8', '#ffd23d', '#fff', '#b47cff', '#ff8a3d'];
  stroke(open([-14, -3], [[-9, -9], [9, -9], [14, -3]]), '#2d8a3a', 3);
  colors.forEach((color, index) => {
    const along = index / (colors.length - 1) * 2 - 1, x = along * 13, y = -5 - (1 - along * along) * 5;
    dot(x, y, 4.2, color); dot(x, y, 1.4, color === '#ffd23d' ? '#ff8a3d' : '#ffd23d');
  });
};

const harvest = () => {
  solid(oval(0, -4, 20, 4.8), '#e8c45a'); solid(curve([-11, -5], [[-11, -22], [11, -22], [11, -5]]), '#f0d070');
  solid(poly([-11.4, -10], [11.4, -10], [11, -5.5], [-11, -5.5]), '#a8552a');
  
};

const HATS: Record<SeasonId, () => void> = { lunar, love, spring: bunny, children, midsummer, harvest, brewfest, halloween: witch, thanksgiving: pilgrim, winter: santa };
const cache = new Map<SeasonId, Texture>();

/** The season's hat (its bottom middle is the texture's anchor, see Fish.setHat). Painted once, shared by every fish. */
export const hatTexture = (season: SeasonId, resolution: number): Texture => {
  const cached = cache.get(season);
  if (cached) return cached;
  const texture = paintTexture({ w: BOX, h: BOX }, resolution * 2, context => {
    drawInto(context); g.translate(BOX / 2, BOX - 8); HATS[season]();
  });
  cache.set(season, texture);
  return texture;
};

/** Where the bottom middle of a hat sits in its texture, as a fraction of it. */
export const HAT_ANCHOR = { x: .5, y: (BOX - 8) / BOX };
