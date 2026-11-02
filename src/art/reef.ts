// The coral reef on the floor: a low ridge of live rock along the back, with outcrops of it in three rows (back,
// middle, front), broken by open stretches of sand that look through to the distance. Their hard corals stay put (painted here, into the floor layer), rooted in the rock; the reefs at the
// back also grow soft corals that sway (drawn by scene/water.ts, behind the rock). Cartoon style like the fish: flat
// fills, ink outlines, a light rim and shine. Both layers use the same layout (reefLayout).
import { rng, shade, TAU } from '../util';

export type HardKind = 'staghorn' | 'table' | 'brain' | 'leather' | 'polyps' | 'zoas';
export type SoftKind = 'fan' | 'whip' | 'tree';
/** A coral at (x, y) on its rock, `s` big (its height, or for table and brain corals its width and radius). */
export interface Coral<K> { kind: K; x: number; y: number; s: number; col: string; seed: number }
/** An outcrop of live rock `w` wide and `h` tall standing on (x, y); row 0 is at the back. */
export interface Reef {
  i: number; x: number; y: number; w: number; h: number; row: 0 | 1 | 2;
  hard: Coral<HardKind>[]; soft: Coral<SoftKind>[];
}

const SPACING = 145; // px of width per reef's spot, on average
const GOLDEN = .6180339887;
const GAP_SHARE = .33; // of the spots, after the first 3, left as open sand

/** Spot i of the reefs' endless sequence, at frac(.23 + i * golden) of the width: where it is, and if it's open sand, how wide. */
const spot = (i: number, W: number) => {
  const R = rng(4409 + i * 613), open = i >= 3 && R() < GAP_SHARE;
  return { x: (.23 + i * GOLDEN) % 1 * W, gap: open ? 55 + R() * 45 : 0 };
};
const spots = (W: number) => Math.max(3, Math.round(W / SPACING));

/** The open stretches of sand between the reefs in a tank W wide, as [from, to], left to right. */
export function sandGaps(W: number): [number, number][] {
  const gaps: [number, number][] = [];
  for (let i = 0, n = spots(W); i < n; i++) { const { x, gap } = spot(i, W); if (gap) gaps.push([x - gap, x + gap]); }
  return gaps.sort((a, b) => a[0] - b[0]);
}
/** A hex colour darkened by `k` (0..1), still as hex, so the painters can shade it further. */
const dim = (hex: string, k: number) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k)).toString(16).padStart(2, '0')).join('');
const pick = <T>(R: () => number, items: [T, number][]) => {
  let r = R() * items.reduce((a, [, w]) => a + w, 0);
  for (const [item, w] of items) if ((r -= w) < 0) return item;
  return items[items.length - 1][0];
};
/** Each reef's corals share a few colours, so they look like they grew up together. */
const THEMES = [
  ['#9b6bd6', '#e07aa8', '#7fd6d0', '#d9c46a'], ['#5d8ee8', '#6fd08a', '#ffd24a', '#c9b0e0'],
  ['#e8b46a', '#ff8a3d', '#9fd07a', '#8a78c9'], ['#e07aa8', '#ff5a9a', '#b7d65a', '#7fd6d0'],
];
const SOFT_COLORS: Record<SoftKind, string[]> = {
  fan: ['#c04a8f', '#e2553a', '#e8a03a', '#9a6be0'], whip: ['#f2c23a', '#ff7a3d', '#b76be0', '#e8506a'], tree: ['#ff5a7a', '#ff8a4a', '#c46bff', '#ffd24a'],
};
/** How deep a coral's foot sits in the rock. */
const SUNK: Record<HardKind, number> = { staghorn: 6, table: 7, brain: 5, leather: 7, polyps: 4, zoas: 3 };

/** How high the rock's top is at `dx` from its middle: a dome with a few lumps. The rock is drawn along it and the corals stand on it. */
export function rockTop(r: Reef, dx: number) {
  const t = 2 * dx / r.w;
  if (Math.abs(t) >= 1) return r.y;
  return r.y - r.h * Math.sqrt(1 - t * t) * (1 + .12 * Math.sin(t * 5.5 + r.i * 1.7) + .07 * Math.sin(t * 11 + r.i * 3.1));
}

/**
 * The reefs in a tank W x H. Reef i of an endless sequence stands at spot i (any first n are spread evenly); a tank
 * gets its first W / SPACING spots. Each one always looks the same, so a wider tank keeps its reefs and adds new ones
 * between them. Some spots are open sand (sandGaps): the reefs next to one move out of it, bunching up beside it.
 * None stands in front of `clear` (the chest): those grow behind it.
 */
export function reefLayout(W: number, H: number, clear: [number, number][]): Reef[] {
  const sy = H - 70, water = sy - 40, reefs: Reef[] = [], gaps = sandGaps(W);
  for (let i = 0, n = spots(W); i < n; i++) {
    const at0 = spot(i, W);
    if (at0.gap) continue;
    const R = rng(5003 + i * 977);
    const roll = R(), size = R(), tall = R(), dy = (R() - .5) * 6;
    const make = (row: Reef['row']): Reef => {
      const [lo, hi] = [[170, 260], [130, 200], [90, 150]][row], w = lo + size * (hi - lo);
      let x = at0.x;
      for (const [a, b] of gaps) if (x + w / 2 > a && x - w / 2 < b) x = x < (a + b) / 2 ? a - w / 2 : b + w / 2;
      return { i, x, y: [sy - 26, sy - 8, sy + 10][row] + dy, w, h: w * (.28 + tall * .14), row, hard: [], soft: [] };
    };
    let reef = make((roll < .38 ? 0 : roll < .7 ? 1 : 2) as Reef['row']);
    // one that would stand in front of the chest grows behind it instead
    if (reef.row > 0 && clear.some(([a, b]) => reef.x + reef.w / 2 > a && reef.x - reef.w / 2 < b)) reef = make(0);
    const { x, w, row } = reef;
    const at = (u: number, sunk: number) => ({ x: x + u * w, y: rockTop(reef, u * w) + sunk });
    const theme = THEMES[Math.floor(R() * THEMES.length)];
    const count = [3, 3, 2][row] + Math.floor(R() * 3);
    for (let k = 0; k < count; k++) {
      const kind = pick<HardKind>(R, [['staghorn', .27], ['table', .2], ['brain', .15], ['leather', .07], ['polyps', .16], ['zoas', .15]]);
      const s = { staghorn: 40 + R() * 55, table: w * (.32 + R() * .2), brain: 18 + R() * 20, leather: 30 + R() * 28, polyps: 16 + R() * 14, zoas: 18 + R() * 16 }[kind];
      const col = kind === 'polyps' ? '#68c95a' : theme[Math.floor(R() * theme.length)];
      // spread along the top, each in its own stretch of it so they don't pile up
      const u = ((k + .5) / count - .5) * .7 + (R() - .5) * .1;
      reef.hard.push({ kind, ...at(u, SUNK[kind]), s: s * (row === 0 ? 1.1 : row === 2 ? .8 : 1), col: row === 0 ? dim(col, .14) : col, seed: R() * 1e6 | 0 });
    }
    reef.hard.sort((a, b) => a.y - b.y); // the ones further up the rock are further back
    // soft corals growing up from behind the reefs at the back, their feet deep in the rock
    for (let k = 0, n = row === 0 ? 1 + Math.floor(R() * 2) : 0; k < n; k++) {
      const kind = pick<SoftKind>(R, [['fan', .4], ['whip', .35], ['tree', .25]]);
      const [lo, hi] = { fan: [120, water * .6], whip: [150, water * .85], tree: [80, 190] }[kind];
      reef.soft.push({ kind, ...at((R() - .5) * .44, 14), s: lo + Math.pow(R(), 1.8) * (hi - lo), col: SOFT_COLORS[kind][Math.floor(R() * 4)], seed: R() * 1e6 | 0 });
    }
    reefs.push(reef);
  }
  return reefs.sort((a, b) => a.row - b.row || a.y - b.y);
}

// ---------- painting (Canvas 2D) ----------

let g: CanvasRenderingContext2D;

function ink(p: Path2D, col: string, w: number, alpha = 1) {
  g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round';
  g.stroke(p); g.globalAlpha = 1;
}
function toon(p: Path2D, fill: string, inkCol: string, w: number, inside?: () => void) {
  g.fillStyle = fill; g.fill(p);
  if (inside) { g.save(); g.clip(p); inside(); g.restore(); }
  ink(p, inkCol, w);
}
function ellipse(x: number, y: number, rx: number, ry: number, rot: number, col: string, alpha = 1) {
  g.globalAlpha = alpha; g.fillStyle = col;
  g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); g.globalAlpha = 1;
}
/** A smooth closed path through points. */
function smooth(pts: [number, number][]) {
  const p = new Path2D(), n = pts.length, mid = (i: number) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
  const m0 = mid(n - 1); p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const m = mid(i); p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  p.closePath();
  return p;
}

const ROCK: [string, string, string][] = [['#5c536c', '#3f384c', '#7a7088'], ['#776a86', '#544a63', '#988caa'], ['#85778f', '#5d5268', '#a598b0']];
const CORALLINE = ['#c0679b', '#9a5fb8', '#d98aa0', '#7a5aa8', '#e0a0b8'];

/** The crusts of pink and purple coralline algae and the holes all over live rock, inside the current clip. */
function crusts(x: number, y: number, w: number, h: number, lit: string, R: () => number) {
  for (let k = 0; k < 4 + w / 30; k++) {
    const cx = x + (R() - .5) * w * .9, cy = y - R() * h * .9, cw = 8 + R() * 16;
    const c = smooth(Array.from({ length: 7 }, (_, j) => { const a = j / 7 * TAU, q = 1 + (R() - .5) * .5; return [cx + Math.cos(a) * cw * q, cy + Math.sin(a) * cw * .6 * q] as [number, number]; }));
    g.globalAlpha = .85; g.fillStyle = CORALLINE[Math.floor(R() * CORALLINE.length)]; g.fill(c); g.globalAlpha = 1;
  }
  for (let k = 0; k < 1 + w / 90; k++) {
    const hx = x + (R() - .5) * w * .7, hy = y - R() * h * .6 - 4, hr = 2.5 + R() * 4;
    ellipse(hx, hy, hr, hr * .7, 0, '#1d1625');
    ellipse(hx - hr * .2, hy - hr * .35, hr * .6, hr * .25, 0, lit, .5);
  }
}

/** Where the sand is at x: the front sand's top edge (art/terrain.ts). */
export type Ground = (x: number) => number;
const SAND = '#e8cd96';

/**
 * Sand drifted over the foot of the rock from xa to xb, whose foot is at `foot` (or behind the edge of the front
 * sand, where that is lower down): it hides where the rock meets the ground, so the rock sits in it instead of
 * floating over it. Where the rock stands behind the sand's edge, that edge is drawn across it again.
 */
function sandOver(xa: number, xb: number, foot: (x: number) => number, ground: Ground) {
  const top: [number, number][] = [];
  for (let x = xa; x <= xb + .1; x += 5) top.push([x, Math.max(foot(x), ground(x)) + Math.sin(x * .35) * 1.2]);
  const p = new Path2D(); top.forEach(([x, y], k) => k ? p.lineTo(x, y) : p.moveTo(x, y));
  for (let k = top.length - 1; k >= 0; k--) p.lineTo(top[k][0], top[k][1] + 18);
  p.closePath();
  g.fillStyle = SAND; g.fill(p);
  g.save(); g.clip(p);
  for (const [x, y] of top) { ellipse(x + 2, y + 6, 1.2, .9, 0, '#c9a66a'); ellipse(x - 1, y + 12, 1, .8, 0, '#fbecc8'); }
  g.restore();
  // the edge of the front sand, in front of the rock where the rock stands behind it
  let run: [number, number][] = [];
  const edge = () => {
    if (run.length > 1) {
      const e = new Path2D(); run.forEach(([x, y], k) => k ? e.lineTo(x, y) : e.moveTo(x, y));
      g.save(); g.translate(0, 6); ink(e, '#f7e5b8', 6); g.restore(); ink(e, '#7a5726', 2.4);
    }
    run = [];
  };
  for (const [x] of top) { if (foot(x) < ground(x)) run.push([x, ground(x)]); else edge(); }
  edge();
}

/** A lumpy outcrop of live rock, crusted with pink and purple coralline algae and full of holes, along rockTop; its foot sunk in the sand. */
function liveRock(r: Reef, R: () => number, ground: Ground) {
  const [body, dark, lit] = ROCK[r.row], { x, y, w, h } = r, deep = (px: number) => Math.max(y, ground(px)) + 10;
  const top: [number, number][] = [];
  for (let k = 0, n = 26; k <= n; k++) { const dx = (k / n - .5) * w; top.push([x + dx, rockTop(r, dx)]); }
  const outline = new Path2D(); outline.moveTo(x - w / 2, deep(x - w / 2));
  for (const [px, py] of top) outline.lineTo(px, py);
  outline.lineTo(x + w / 2, deep(x + w / 2));
  const p = new Path2D(outline); p.closePath();
  g.fillStyle = body; g.fill(p);
  g.save(); g.clip(p);
  ellipse(x + w * .32, y - h * .1, w * .45, h * .9 + 12, 0, dark);       // shadow side
  ellipse(x - w * .2, y - h * .75, w * .3, h * .25, -.2, lit);           // lit top
  crusts(x, y, w, h, lit, R);
  ellipse(x, y + 4, w * .6, 9, 0, '#140e1a', .35);                        // shaded where it meets the sand
  g.restore();
  ink(outline, '#221a2a', 2.4); // its top and sides only: the foot is in the sand
  sandOver(x - w / 2 - 6, x + w / 2 + 6, () => y, ground);
}

/** How wide a coral's foot is, for the rock that grows up around it. */
const FOOT: Partial<Record<HardKind, (s: number) => number>> = { staghorn: s => s * .2, table: s => s * .13, leather: s => s * .22, brain: s => s * .55 };

/** A shadow on the rock under a coral, before it's painted. */
function shadowUnder(c: Coral<HardKind>) {
  const f = FOOT[c.kind]?.(c.s) ?? c.s * .5;
  ellipse(c.x + 3, c.y - 1, f * 1.6, 4 + f * .2, 0, '#140e1a', .35);
}

/** Rock growing up around a coral's foot, so it looks rooted in the reef rather than set on top of it. */
function rootIn(c: Coral<HardKind>, row: number, R: () => number) {
  const f = FOOT[c.kind]?.(c.s);
  if (!f) return; // polyps and zoanthids grow as a crust on the rock already
  const [body, dark, lit] = ROCK[row], rx = Math.max(7, f), ry = Math.max(4, f * .45);
  const p = smooth(Array.from({ length: 9 }, (_, j) => {
    const a = j / 9 * TAU, q = 1 + (R() - .5) * .3, dy = Math.sin(a) * ry * q;
    return [c.x + Math.cos(a) * rx * q, c.y + 2 + (dy > 0 ? dy * .4 : dy)] as [number, number];
  }));
  toon(p, body, '#221a2a', 1.8, () => {
    ellipse(c.x + rx * .5, c.y + 3, rx * .8, ry, 0, dark);
    ellipse(c.x - rx * .3, c.y - ry * .5, rx * .4, ry * .3, 0, lit);
    ellipse(c.x + (R() - .5) * rx, c.y + 1, rx * .35, ry * .4, 0, CORALLINE[Math.floor(R() * CORALLINE.length)], .8);
  });
}

/**
 * A low ridge of live rock along the back of the floor, so the reefs beside each other grow out of one reef instead of
 * standing alone; it's broken by the open stretches of sand (`gaps`, from sandGaps). Shaped by x itself (not the
 * width), so it stays put on a resize; `ground` is where the sand is.
 */
export function paintRidge(ctx: CanvasRenderingContext2D, W: number, sy: number, ground: Ground, gaps: [number, number][]) {
  g = ctx;
  // it sinks into the sand towards the open stretches (gaps) and leaves them open
  const TAPER = 70;
  const left = (x: number) => Math.min(1, ...gaps.map(([a, b]) => x < a ? (a - x) / TAPER : x > b ? (x - b) / TAPER : 0));
  const top = (x: number) => {
    const k = left(x), e = k * k * (3 - 2 * k), base = sy + 4;
    return base - (base - (sy - 14 - 30 * (.5 + .5 * Math.sin(x / 170 + 1.3)) * (.6 + .4 * Math.sin(x / 61 + .4)) - 6 * Math.sin(x / 23))) * e;
  };
  const [body, dark, lit] = ROCK[0];
  // the stretches of it between the gaps
  const ends = [-10, ...gaps.flat(), W + 10];
  for (let s = 0; s < ends.length; s += 2) {
    const a = Math.max(-10, ends[s]), b = Math.min(W + 10, ends[s + 1]);
    if (b - a < 20) continue;
    const outline = new Path2D(); outline.moveTo(a, top(a));
    for (let x = a; x <= b; x += 8) outline.lineTo(x, top(x));
    outline.lineTo(b, top(b));
    const p = new Path2D(outline);
    for (let x = b; x >= a; x -= 16) p.lineTo(x, ground(x) + 10);
    p.lineTo(a, ground(a) + 10);
    p.closePath();
    g.fillStyle = body; g.fill(p);
    g.save(); g.clip(p);
    g.fillStyle = dark; g.fillRect(a, sy - 22, b - a, 40);                    // in shade low down
    for (let k = Math.floor(a / 70); k * 70 < b; k++) {                        // crusts and holes, every 70 px
      const R = rng(9100 + k), x = k * 70 + R() * 50;
      ellipse(x, top(x) + 6, 16 + R() * 14, 5, 0, lit, .7);
      crusts(x, sy - 6, 70, 34, lit, R);
    }
    g.restore();
    ink(outline, '#221a2a', 2.4);
    sandOver(a, b, () => sy - 60, ground); // it stands behind the front sand's edge all along
  }
  for (let k = 0; k * 110 < W + 110; k++) { // small polyps and zoanthids crusting its top
    const R = rng(9300 + k), x = k * 110 + R() * 80;
    const c: Coral<HardKind> = { kind: R() < .5 ? 'zoas' : 'polyps', x, y: top(x) + 4, s: 12 + R() * 10, col: R() < .5 ? '#68c95a' : THEMES[k % 4][Math.floor(R() * 4)], seed: 9500 + k };
    if (left(x) > .6) HARD[c.kind](c, rng(c.seed));
  }
}

/** Branching staghorn coral, thick branches with pale, round tips. */
function staghorn(c: Coral<HardKind>, R: () => number) {
  const segs: [number, number, number, number, number][] = [];
  const grow = (x: number, y: number, len: number, ang: number, w: number, depth: number): void => {
    if (!depth || len < 5) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    segs.push([x, y, x2, y2, w]);
    grow(x2, y2, len * .76, ang - .3 - R() * .3, w * .78, depth - 1);
    if (R() < .85) grow(x2, y2, len * .76, ang + .3 + R() * .3, w * .78, depth - 1);
  };
  for (const a of [-.45, 0, .45]) grow(c.x, c.y, c.s * .3, -Math.PI / 2 + a + (R() - .5) * .2, c.s * .14, 4);
  g.lineCap = 'round';
  const pass = (col: string, extra: number, k = 1, dx = 0) => {
    g.strokeStyle = col;
    for (const [x1, y1, x2, y2, w] of segs) { g.lineWidth = w * k + extra; g.beginPath(); g.moveTo(x1 + dx * w, y1); g.lineTo(x2 + dx * w, y2); g.stroke(); }
  };
  pass(shade(c.col, -.65), 3.4); pass(c.col, 0); pass(shade(c.col, .4), 0, .3, -.25);
  const tips = new Set(segs.map(s => s[2] + ',' + s[3]));
  for (const s of segs) tips.delete(s[0] + ',' + s[1]);
  for (const [, , x2, y2, w] of segs) if (tips.has(x2 + ',' + y2)) ellipse(x2, y2, w * .45 + 1, w * .45 + 1, 0, shade(c.col, .7));
}

/** Table coral: flat, wavy-edged plates stacked on a short stalk, dotted with polyps. */
function table(c: Coral<HardKind>, R: () => number) {
  const inkC = shade(c.col, -.7);
  const stalk = new Path2D(); stalk.roundRect(c.x - c.s * .06, c.y - c.s * .3, c.s * .12, c.s * .3 + 2, 3);
  toon(stalk, shade(c.col, -.3), inkC, 2);
  for (let k = 0; k < 3; k++) {
    const cx = c.x + (R() - .5) * c.s * .15, cy = c.y - c.s * (.28 + k * .16), rw = c.s * (.5 - k * .12), rh = c.s * .09;
    const pts: [number, number][] = Array.from({ length: 18 }, (_, j) => { const a = j / 18 * TAU; return [cx + Math.cos(a) * rw * (1 + Math.sin(a * 5 + k) * .05), cy + Math.sin(a) * rh * (1 + (R() - .5) * .3)]; });
    const plate = smooth(pts), col = shade(c.col, k * .08 - .05);
    toon(plate, col, inkC, 2, () => {
      ellipse(cx, cy + rh * .6, rw, rh * .7, 0, shade(c.col, -.3));         // its underside
      ellipse(cx - rw * .2, cy - rh * .3, rw * .6, rh * .35, 0, shade(c.col, .35));
      for (let j = 0; j < rw / 4; j++) ellipse(cx + (R() - .5) * rw * 1.7, cy - R() * rh * .6, 1.2, .8, 0, shade(c.col, .55));
    });
  }
}

/** A brain coral: a dome with meandering grooves. */
function brain(c: Coral<HardKind>, R: () => number) {
  const { x, y, s: r } = c, dome = new Path2D();
  dome.arc(x, y, r, Math.PI, TAU); dome.closePath();
  toon(dome, c.col, shade(c.col, -.7), 2.4, () => {
    ellipse(x + r * .7, y, r * .7, r * 1.1, 0, shade(c.col, -.2));
    g.strokeStyle = shade(c.col, -.4); g.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      g.beginPath();
      for (let a = Math.PI; a <= TAU; a += .07) { const q = r * i / 5 + Math.sin(a * 9 + i + R() * .3) * 2.2; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
      g.stroke();
    }
    ellipse(x - r * .4, y - r * .62, r * .22, r * .1, -.5, shade(c.col, .5));
  });
}

/** A toadstool leather coral: a thick pale stalk under a wide, ruffled cap covered in tiny polyps. */
function leather(c: Coral<HardKind>, R: () => number) {
  const { x, y, s } = c, inkC = shade(c.col, -.7);
  const stalk = new Path2D(); stalk.moveTo(x - s * .16, y + 2); stalk.quadraticCurveTo(x - s * .1, y - s * .4, x - s * .14, y - s * .6);
  stalk.lineTo(x + s * .14, y - s * .6); stalk.quadraticCurveTo(x + s * .1, y - s * .4, x + s * .16, y + 2); stalk.closePath();
  toon(stalk, shade(c.col, .45), inkC, 2, () => ellipse(x + s * .1, y - s * .3, s * .08, s * .4, 0, shade(c.col, .2)));
  const cap = new Path2D(), cw = s * .55, top = y - s;
  cap.moveTo(x - cw, y - s * .58);
  cap.quadraticCurveTo(x - cw * .9, top, x, top - s * .05); cap.quadraticCurveTo(x + cw * .9, top, x + cw, y - s * .58);
  for (let k = 8; k >= 0; k--) cap.lineTo(x - cw + k / 8 * cw * 2, y - s * .58 + (k % 2 ? 6 : 0));
  cap.closePath();
  toon(cap, c.col, inkC, 2.2, () => {
    ellipse(x + cw * .45, y - s * .7, cw * .6, s * .3, 0, shade(c.col, -.22));
    ellipse(x - cw * .3, y - s * .92, cw * .45, s * .1, -.1, shade(c.col, .35));
    for (let k = 0; k < s * .8; k++) ellipse(x + (R() - .5) * cw * 1.9, y - s * (.62 + R() * .4), .9, .9, 0, shade(c.col, .55), .8);
  });
}

/** Green star polyps: a fuzzy mound with tiny bright stars all over it. */
function polyps(c: Coral<HardKind>, R: () => number) {
  const { x, y, s: r } = c;
  const mound = smooth(Array.from({ length: 10 }, (_, j) => { const a = Math.PI + j / 9 * Math.PI, q = 1 + (R() - .5) * .25; return [x + Math.cos(a) * r * 1.2 * q, y + Math.sin(a) * r * q] as [number, number]; }));
  toon(mound, c.col, shade(c.col, -.7), 2, () => {
    ellipse(x + r * .5, y, r * .8, r, 0, shade(c.col, -.25));
    for (let k = 0; k < r * 3; k++) {
      const px = x + (R() - .5) * r * 2.2, py = y - R() * r;
      for (let a = 0; a < 5; a++) ellipse(px + Math.cos(a * TAU / 5) * 1.6, py + Math.sin(a * TAU / 5) * 1.6, 1, .5, a * TAU / 5, shade(c.col, .6));
      ellipse(px, py, .9, .9, 0, shade(c.col, -.4));
    }
  });
}

/** A carpet of zoanthids: little round polyps with a bright mouth in the middle. */
function zoas(c: Coral<HardKind>, R: () => number) {
  for (let k = 0, n = 8 + Math.floor(c.s / 3); k < n; k++) {
    const a = R() * TAU, d = Math.sqrt(R()) * c.s * .6, px = c.x + Math.cos(a) * d, py = c.y - 4 + Math.sin(a) * d * .45, r = 3 + R() * 2.4;
    const disc = new Path2D(); disc.ellipse(px, py, r, r * .8, 0, 0, TAU);
    toon(disc, c.col, shade(c.col, -.7), 1.2, () => {
      ellipse(px, py, r * .55, r * .45, 0, shade(c.col, -.3));
      ellipse(px, py, r * .25, r * .2, 0, '#e8ff9a');
    });
  }
}

const HARD: Record<HardKind, (c: Coral<HardKind>, R: () => number) => void> = { staghorn, table, brain, leather, polyps, zoas };

/** Paints reefs: their rock, then the hard corals on it (soft corals are scene/water.ts's). */
export function paintReefs(ctx: CanvasRenderingContext2D, reefs: Reef[], ground: Ground) {
  g = ctx;
  for (const r of reefs) {
    const R = rng(r.i * 31 + 7);
    liveRock(r, R, ground);
    for (const c of r.hard) { shadowUnder(c); HARD[c.kind](c, rng(c.seed)); rootIn(c, r.row, R); }
  }
}
