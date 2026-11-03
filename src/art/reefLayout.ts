import { rng } from '../util';

export type HardKind = 'staghorn' | 'table' | 'brain' | 'leather' | 'polyps' | 'zoas';
export type SoftKind = 'fan' | 'whip' | 'tree';
/** A coral at (x, y) on its rock, `size` big (its height, or for table and brain corals its width and radius). */
export interface Coral<K> { kind: K; x: number; y: number; size: number; color: string; seed: number }
/** An outcrop of live rock `w` wide and `h` tall standing on (x, y); row 0 is at the back. */
export interface Reef {
  index: number; x: number; y: number; w: number; h: number; row: 0 | 1 | 2;
  hard: Coral<HardKind>[]; soft: Coral<SoftKind>[];
}

const SPACING = 145; // px of width per reef's spot, on average
const GOLDEN = .6180339887;
const GAP_SHARE = .33; // of the spots, after the first 3, left as open sand

/** Each reef's corals share a few colours, so they look like they grew up together. */
export const THEMES = [
  ['#9b6bd6', '#e07aa8', '#7fd6d0', '#d9c46a'], ['#5d8ee8', '#6fd08a', '#ffd24a', '#c9b0e0'],
  ['#e8b46a', '#ff8a3d', '#9fd07a', '#8a78c9'], ['#e07aa8', '#ff5a9a', '#b7d65a', '#7fd6d0'],
];
const SOFT_COLORS: Record<SoftKind, string[]> = {
  fan: ['#c04a8f', '#e2553a', '#e8a03a', '#9a6be0'], whip: ['#f2c23a', '#ff7a3d', '#b76be0', '#e8506a'], tree: ['#ff5a7a', '#ff8a4a', '#c46bff', '#ffd24a'],
};
const HARD_SHARES: [HardKind, number][] = [['staghorn', .27], ['table', .2], ['brain', .15], ['leather', .07], ['polyps', .16], ['zoas', .15]];
const SOFT_SHARES: [SoftKind, number][] = [['fan', .4], ['whip', .35], ['tree', .25]];
/** How deep a coral's foot sits in the rock. */
const SUNK: Record<HardKind, number> = { staghorn: 6, table: 7, brain: 5, leather: 7, polyps: 4, zoas: 3 };
const ROW_WIDTHS = [[170, 260], [130, 200], [90, 150]];
const ROW_CORALS = [3, 3, 2];
const ROW_CORAL_SCALE = [1.1, 1, .8];

/** Spot `index` of the reefs' endless sequence, at frac(.23 + index * golden) of the width: where it is, and if it's open sand, how wide. */
const spot = (index: number, width: number) => {
  const random = rng(4409 + index * 613), isOpen = index >= 3 && random() < GAP_SHARE;
  return { x: (.23 + index * GOLDEN) % 1 * width, gap: isOpen ? 55 + random() * 45 : 0 };
};
const spotCount = (width: number) => Math.max(3, Math.round(width / SPACING));

/** The open stretches of sand between the reefs in a tank `width` wide, as [from, to], left to right. */
export const sandGaps = (width: number): [number, number][] => {
  const gaps: [number, number][] = [];
  for (let index = 0, count = spotCount(width); index < count; index++) {
    const { x, gap } = spot(index, width);
    if (gap) gaps.push([x - gap, x + gap]);
  }
  return gaps.sort((first, second) => first[0] - second[0]);
};

/** A hex colour darkened by `amount` (0..1), still as hex, so the painters can shade it further. */
const dim = (hex: string, amount: number) =>
  '#' + [1, 3, 5].map(index => Math.round(parseInt(hex.slice(index, index + 2), 16) * (1 - amount)).toString(16).padStart(2, '0')).join('');

const pick = <T>(random: () => number, shares: [T, number][]) => {
  let left = random() * shares.reduce((total, [, share]) => total + share, 0);
  for (const [choice, share] of shares) if ((left -= share) < 0) return choice;
  return shares[shares.length - 1][0];
};

/** How high the rock's top is at `offset` from its middle: a dome with a few lumps. The rock is drawn along it and the corals stand on it. */
export const rockTop = (reef: Reef, offset: number) => {
  const t = 2 * offset / reef.w;
  if (Math.abs(t) >= 1) return reef.y;
  return reef.y - reef.h * Math.sqrt(1 - t * t) * (1 + .12 * Math.sin(t * 5.5 + reef.index * 1.7) + .07 * Math.sin(t * 11 + reef.index * 3.1));
};

/** The point on the reef's rock `along` its width from the middle (-.5 to .5), `sunk` px into it. */
const onRock = (reef: Reef, along: number, sunk: number) => ({ x: reef.x + along * reef.w, y: rockTop(reef, along * reef.w) + sunk });

/** Where a reef of the sequence grows, and its rolls of the dice for its size, height and how far forward it stands. */
interface Footing { index: number; x: number; sandLine: number; gaps: [number, number][]; size: number; tall: number; lift: number }

/** The reef in `row`; next to an open stretch of sand it moves out of it, bunching up beside it. */
const standReef = (footing: Footing, row: Reef['row']): Reef => {
  const [narrowest, widest] = ROW_WIDTHS[row], w = narrowest + footing.size * (widest - narrowest), sandLine = footing.sandLine;
  let x = footing.x;
  for (const [from, to] of footing.gaps) if (x + w / 2 > from && x - w / 2 < to) x = x < (from + to) / 2 ? from - w / 2 : to + w / 2;
  return { index: footing.index, x, y: [sandLine - 26, sandLine - 8, sandLine + 10][row] + footing.lift, w, h: w * (.28 + footing.tall * .14), row, hard: [], soft: [] };
};

/** Coral `index` of `count`, in the reef's colour `theme`. */
const hardCoral = (reef: Reef, { index, count, theme }: { index: number; count: number; theme: string[] }, random: () => number): Coral<HardKind> => {
  const kind = pick<HardKind>(random, HARD_SHARES);
  const w = reef.w;
  // every kind's size is rolled, whichever kind it is, so the dice that follow stay the same
  const sizes = { staghorn: 40 + random() * 55, table: w * (.32 + random() * .2), brain: 18 + random() * 20, leather: 30 + random() * 28, polyps: 16 + random() * 14, zoas: 18 + random() * 16 };
  const color = kind === 'polyps' ? '#68c95a' : theme[Math.floor(random() * theme.length)];
  // spread along the top, each in its own stretch of it so they don't pile up
  const along = ((index + .5) / count - .5) * .7 + (random() - .5) * .1;
  return { kind, ...onRock(reef, along, SUNK[kind]), size: sizes[kind] * ROW_CORAL_SCALE[reef.row], color: reef.row === 0 ? dim(color, .14) : color, seed: random() * 1e6 | 0 };
};

const growHardCorals = (reef: Reef, random: () => number) => {
  const theme = THEMES[Math.floor(random() * THEMES.length)];
  const count = ROW_CORALS[reef.row] + Math.floor(random() * 3);
  for (let index = 0; index < count; index++) reef.hard.push(hardCoral(reef, { index, count, theme }, random));
  reef.hard.sort((first, second) => first.y - second.y); // the ones further up the rock are further back
};

/** Soft corals growing up from behind the reefs at the back, their feet deep in the rock; `water` is how high the water is above the floor. */
const growSoftCorals = (reef: Reef, water: number, random: () => number) => {
  for (let index = 0, count = reef.row === 0 ? 1 + Math.floor(random() * 2) : 0; index < count; index++) {
    const kind = pick<SoftKind>(random, SOFT_SHARES);
    const [shortest, tallest] = { fan: [120, water * .6], whip: [150, water * .85], tree: [80, 190] }[kind];
    reef.soft.push({
      kind, ...onRock(reef, (random() - .5) * .44, 14), size: shortest + Math.pow(random(), 1.8) * (tallest - shortest),
      color: SOFT_COLORS[kind][Math.floor(random() * 4)], seed: random() * 1e6 | 0,
    });
  }
};

const growReef = (site: Omit<Footing, 'size' | 'tall' | 'lift'>, clear: [number, number][]) => {
  const random = rng(5003 + site.index * 977);
  const roll = random(), size = random(), tall = random(), lift = (random() - .5) * 6;
  const footing = { ...site, size, tall, lift };
  let reef = standReef(footing, roll < .38 ? 0 : roll < .7 ? 1 : 2);
  // one that would stand in front of the chest grows behind it instead
  const blocks = ([from, to]: [number, number]) => reef.x + reef.w / 2 > from && reef.x - reef.w / 2 < to;
  if (reef.row > 0 && clear.some(blocks)) reef = standReef(footing, 0);
  growHardCorals(reef, random);
  growSoftCorals(reef, site.sandLine - 40, random);
  return reef;
};

/**
 * The reefs in a tank `width` x `height`. Reef i of an endless sequence stands at spot i (any first n are spread
 * evenly); a tank gets its first width / SPACING spots. Each one always looks the same, so a wider tank keeps its reefs
 * and adds new ones between them. Some spots are open sand (sandGaps): the reefs next to one move out of it, bunching
 * up beside it. None stands in front of `clear` (the chest): those grow behind it.
 */
export const reefLayout = (width: number, height: number, clear: [number, number][]): Reef[] => {
  const sandLine = height - 70, gaps = sandGaps(width), reefs: Reef[] = [];
  for (let index = 0, count = spotCount(width); index < count; index++) {
    const place = spot(index, width);
    if (!place.gap) reefs.push(growReef({ index, x: place.x, sandLine, gaps }, clear));
  }
  return reefs.sort((first, second) => first.row - second.row || first.y - second.y);
};
