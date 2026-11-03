import { rng, TAU } from '../util';
import { g, ink } from './sceneryPen';
import type { Point } from './sceneryPen';

/** The canyon far away that the ocean current flows into: where its mouth is. */
export const canyonMouth = (width: number, height: number) => ({ x: width * .57, y: height * .46 });

// Each wall's shape, from the way through (0) out to the canyon's rim (1): [out, up] points with steep, rocky faces
// and a few ledges of different sizes at different heights, so the two sides don't mirror each other.
const WALLS: Point[][] = [
  [[0, 0], [.06, .06], [.11, .3], [.3, .34], [.34, .52], [.4, .58], [.58, .6], [.63, .8], [.7, .84], [.75, 1], [1, 1]],
  [[0, 0], [.08, .16], [.15, .19], [.21, .44], [.47, .48], [.52, .68], [.57, .72], [.62, .9], [.69, .92], [.74, 1], [1, 1]],
];

/** A mountain range: how high its peaks rise, its crags' pattern and its colours. Solid rock, so a touch darker than the water behind it, and deeper still towards its foot. */
interface Range { peak: number; crags: number; top: string; foot: string; rim: string }
// the furthest range is a little lighter, its peaks spread wider
const FAR_RANGE: Range = { peak: 70, crags: 4, top: '#09466f', foot: '#073a5e', rim: '#15608f' };
const NEAR_RANGE: Range = { peak: 140, crags: 1, top: '#083e65', foot: '#06304f', rim: '#155b8a' };

interface Canyon { width: number; mouthX: number; mouthY: number; scale: number; base: number; cut: number; floor: number; gapHalf: number }

const canyonShape = (width: number, height: number): Canyon => {
  const { x: mouthX, y: mouthY } = canyonMouth(width, height), scale = Math.min(1.2, Math.max(.7, width / 1600));
  return { width, mouthX, mouthY, scale, base: height * .74, cut: 150 * scale, floor: mouthY + 26 * scale, gapHalf: 12 * scale };
};

const crag = (x: number, pattern: number) => Math.sin(x / 37 + pattern) * .5 + Math.sin(x / 13 + pattern * 2) * .3 + Math.sin(x / 91 + pattern * 3) * .9;

const wallAt = (side: number, t: number) => {
  const wall = WALLS[side];
  for (let index = 1; index < wall.length; index++) {
    if (t > wall[index][0]) continue;
    const [from, heightFrom] = wall[index - 1], [to, heightTo] = wall[index];
    return heightFrom + (heightTo - heightFrom) * (t - from) / (to - from);
  }
  return 1;
};

/** How high the range's crest is at x: rising towards the canyon, and stepping down into it in shelves. */
const crest = (canyon: Canyon, range: Range, x: number) => {
  const { mouthX, mouthY, scale, cut, floor, gapHalf } = canyon;
  const distance = Math.abs(x - mouthX), rise = Math.exp(-Math.pow(Math.max(0, distance - cut) / (canyon.width * .2), 2));
  const top = mouthY - (34 + range.peak * rise) * scale - crag(x, range.crags) * (10 + 16 * rise) * scale;
  if (distance >= cut || !range.peak) return top;
  if (distance < gapHalf) return floor; // the narrow way through
  // the canyon's walls, along their own shapes, rough all over and jagged on the steep faces
  const side = x < mouthX ? 0 : 1, t = (distance - gapHalf) / (cut - gapHalf), height = wallAt(side, t);
  const isSteep = Math.abs(wallAt(side, t + .01) - height) > .006;
  const edge = mouthY - (34 + range.peak) * scale; // just under the canyon's rim
  const rough = isSteep
    ? Math.sin(distance * 1.7 + side) * 3 * scale + Math.sin(distance * .53 + side * 3) * 2 * scale
    : Math.sin(distance / 5 + side) * 1.1 * scale;
  return floor + (edge - floor) * height + rough;
};

const paintRange = (canyon: Canyon, range: Range) => {
  const { width, mouthY, scale, base } = canyon, body = new Path2D(), edge = new Path2D();
  for (let x = -10; x <= width + 10; x += 6) {
    const y = crest(canyon, range, x);
    if (x < -9) { body.moveTo(x, y); edge.moveTo(x, y); } else { body.lineTo(x, y); edge.lineTo(x, y); }
  }
  body.lineTo(width + 10, base); body.lineTo(-10, base); body.closePath();
  const fill = g.createLinearGradient(0, mouthY - 200 * scale, 0, base);
  fill.addColorStop(0, range.top); fill.addColorStop(1, range.foot);
  g.fillStyle = fill; g.fill(body);
  return { body, edge };
};

/** Its layers of rock, wavy and dipping a little. */
const paintRockLayers = (canyon: Canyon, body: Path2D) => {
  const { width, mouthX, mouthY, scale, base } = canyon;
  g.save(); g.clip(body);
  const random = rng(6101);
  g.strokeStyle = '#052a45'; g.lineWidth = 2.5 * scale; g.globalAlpha = .4;
  for (let layerY = mouthY - 170 * scale; layerY < base; layerY += (26 + random() * 20) * scale) {
    g.beginPath(); g.moveTo(-10, layerY + 14 * scale);
    for (let x = 0; x <= width + 60; x += 60) g.lineTo(x, layerY + Math.sin(x / 140 + layerY) * 6 * scale + (x - mouthX) / width * 16 * scale);
    g.stroke();
  }
  g.restore();
};

/** A ledge on one `side` of the canyon (-1 left, 1 right), from `near` to `far` from its middle. */
interface Ledge { side: number; near: number; far: number; isHigh: boolean; isWide: boolean }

/** A ledge's top lit, the rock below it grooved, and maybe a boulder lying on it. */
const paintLedge = (canyon: Canyon, ledge: Ledge, random: () => number) => {
  const { mouthX, scale } = canyon, { side, near, far } = ledge;
  const lit = new Path2D();
  for (let distance = near; distance <= far; distance += 2) {
    const pointX = mouthX + side * distance, pointY = crest(canyon, NEAR_RANGE, pointX) + 3 * scale;
    if (distance === near) lit.moveTo(pointX, pointY); else lit.lineTo(pointX, pointY);
  }
  ink(lit, { color: ledge.isHigh ? '#1a6698' : '#175e8e', width: 5 * scale, alpha: .9 });
  const y = crest(canyon, NEAR_RANGE, mouthX + side * (near + far) / 2);
  g.strokeStyle = '#052a45'; g.lineWidth = 1.4 * scale; g.globalAlpha = .55;
  for (const share of [.2, .5, .8]) {
    const grooveX = mouthX + side * (near + (far - near) * share);
    g.beginPath(); g.moveTo(grooveX, y + 8 * scale); g.lineTo(grooveX + side * (random() - .3) * 3 * scale, y + (22 + random() * 22) * scale); g.stroke();
  }
  g.globalAlpha = 1;
  if (!ledge.isWide || random() >= .7) return;
  // a boulder broken off higher up
  const boulderX = mouthX + side * (near + (far - near) * (.3 + random() * .4)), boulderY = crest(canyon, NEAR_RANGE, boulderX), radius = (4 + random() * 4) * scale;
  const rock = new Path2D(); rock.ellipse(boulderX, boulderY - radius * .55, radius, radius * .7, random() - .5, 0, TAU);
  g.fillStyle = '#0a4470'; g.fill(rock); ink(rock, { color: '#052a45', width: 1.2, alpha: .7 });
};

const paintLedges = (canyon: Canyon) => {
  const { cut, gapHalf } = canyon, random = rng(6300);
  WALLS.forEach((wall, sideIndex) => {
    const side = sideIndex ? 1 : -1;
    for (let index = 1; index < wall.length - 1; index++) {
      const [from, heightFrom] = wall[index - 1], [to, heightTo] = wall[index];
      if (Math.abs(heightTo - heightFrom) > .05 || to - from < .04) continue; // only the ledges
      const near = gapHalf + (cut - gapHalf) * from, far = gapHalf + (cut - gapHalf) * to;
      paintLedge(canyon, { side, near, far, isHigh: heightFrom > .5, isWide: to - from > .1 }, random);
    }
  });
};

/**
 * The mountains far away, behind the ocean current: a range along the whole horizon, low at the sides and rising to
 * its highest crags around the canyon cut through it, where the current flows in; the canyon's walls fall steeply
 * into a V at its mouth. A fainter range further still shows above it. Lit on the faces turned towards the gap, with
 * the layers of rock showing; hazier than the hills.
 */
export const paintCanyon = (width: number, height: number) => {
  const canyon = canyonShape(width, height);
  const far = paintRange(canyon, FAR_RANGE);
  ink(far.edge, { color: FAR_RANGE.rim, width: 2, alpha: .4 });
  const near = paintRange(canyon, NEAR_RANGE);
  paintRockLayers(canyon, near.body);
  ink(near.edge, { color: NEAR_RANGE.rim, width: 2, alpha: .55 });
  paintLedges(canyon);
};
