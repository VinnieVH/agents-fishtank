// The coral reef on the floor: a low ridge of live rock along the back, with outcrops of it in three rows (back,
// middle, front), broken by open stretches of sand that look through to the distance. Their hard corals stay put
// (painted here, into the floor layer), rooted in the rock; the reefs at the back also grow soft corals that sway
// (drawn by scene/water.ts, behind the rock). Both layers use the same layout (reefLayout).
import { rng } from '../util';
import { paintHardCoral } from './reefCorals';
import type { Coral, HardKind, Reef } from './reefLayout';
import { THEMES } from './reefLayout';
import { crusts, paintLiveRock, rootIn, ROCK, sandOver, shadowUnder } from './reefRock';
import type { Ground } from './reefRock';
import { drawInto, ellipse, g, ink } from './sceneryPen';

export type { Coral, HardKind, Reef, SoftKind } from './reefLayout';
export { reefLayout, rockTop, sandGaps } from './reefLayout';
export type { Ground } from './reefRock';

/** The ridge along the back of a tank `width` wide; `gaps` are the open stretches of sand (sandGaps). */
interface Ridge { width: number; sandLine: number; ground: Ground; gaps: [number, number][] }

const TAPER = 70;

/** How far x is from the open stretches of sand, from 0 in one to 1 at TAPER px or more away. */
const awayFromGaps = (gaps: [number, number][], x: number) =>
  Math.min(1, ...gaps.map(([from, to]) => x < from ? (from - x) / TAPER : x > to ? (x - to) / TAPER : 0));

/** The ridge's top at x: it sinks into the sand towards the open stretches and leaves them open. */
const ridgeTop = ({ gaps, sandLine }: Ridge, x: number) => {
  const away = awayFromGaps(gaps, x), ease = away * away * (3 - 2 * away), base = sandLine + 4;
  return base - (base - (sandLine - 14 - 30 * (.5 + .5 * Math.sin(x / 170 + 1.3)) * (.6 + .4 * Math.sin(x / 61 + .4)) - 6 * Math.sin(x / 23))) * ease;
};

const paintRidgeStretch = (ridge: Ridge, [from, to]: [number, number]) => {
  const { sandLine, ground } = ridge, [body, dark, lit] = ROCK[0];
  const outline = new Path2D(); outline.moveTo(from, ridgeTop(ridge, from));
  for (let x = from; x <= to; x += 8) outline.lineTo(x, ridgeTop(ridge, x));
  outline.lineTo(to, ridgeTop(ridge, to));
  const shape = new Path2D(outline);
  for (let x = to; x >= from; x -= 16) shape.lineTo(x, ground(x) + 10);
  shape.lineTo(from, ground(from) + 10);
  shape.closePath();
  g.fillStyle = body; g.fill(shape);
  g.save(); g.clip(shape);
  g.fillStyle = dark; g.fillRect(from, sandLine - 22, to - from, 40); // in shade low down
  for (let patch = Math.floor(from / 70); patch * 70 < to; patch++) { // crusts and holes, every 70 px
    const random = rng(9100 + patch), x = patch * 70 + random() * 50;
    ellipse({ x, y: ridgeTop(ridge, x) + 6, radiusX: 16 + random() * 14, radiusY: 5, color: lit, alpha: .7 });
    crusts({ x, y: sandLine - 6, w: 70, h: 34 }, lit, random);
  }
  g.restore();
  ink(outline, { color: '#221a2a', width: 2.4 });
  sandOver([from, to], sandLine - 60, ground); // it stands behind the front sand's edge all along
};

/** Small polyps and zoanthids crusting the ridge's top. */
const paintRidgeCrust = (ridge: Ridge) => {
  for (let spot = 0; spot * 110 < ridge.width + 110; spot++) {
    const random = rng(9300 + spot), x = spot * 110 + random() * 80;
    const coral: Coral<HardKind> = {
      kind: random() < .5 ? 'zoas' : 'polyps', x, y: ridgeTop(ridge, x) + 4, size: 12 + random() * 10,
      color: random() < .5 ? '#68c95a' : THEMES[spot % 4][Math.floor(random() * 4)], seed: 9500 + spot,
    };
    if (awayFromGaps(ridge.gaps, x) > .6) paintHardCoral(coral);
  }
};

/**
 * A low ridge of live rock along the back of the floor, so the reefs beside each other grow out of one reef instead of
 * standing alone; it's broken by the open stretches of sand. Shaped by x itself (not the width), so it stays put on a
 * resize; `ground` is where the sand is.
 */
export const paintRidge = (context: CanvasRenderingContext2D, ridge: Ridge) => {
  drawInto(context);
  const ends = [-10, ...ridge.gaps.flat(), ridge.width + 10];
  for (let index = 0; index < ends.length; index += 2) {
    const from = Math.max(-10, ends[index]), to = Math.min(ridge.width + 10, ends[index + 1]);
    if (to - from >= 20) paintRidgeStretch(ridge, [from, to]);
  }
  paintRidgeCrust(ridge);
};

/** Paints reefs: their rock, then the hard corals on it (soft corals are scene/water.ts's). */
export const paintReefs = (context: CanvasRenderingContext2D, reefs: Reef[], ground: Ground) => {
  drawInto(context);
  for (const reef of reefs) {
    const random = rng(reef.index * 31 + 7);
    paintLiveRock(reef, random, ground);
    for (const coral of reef.hard) { shadowUnder(coral); paintHardCoral(coral); rootIn(coral, reef.row, random); }
  }
};
