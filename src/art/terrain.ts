import { rng, shade, TAU } from '../util';
import { paintReefs, paintRidge, reefLayout } from './reef';

export const sandY = (H: number) => H - 70;
/** The canyon far away that the ocean current flows into: where its mouth is. */
const canyonMouth = (W: number, H: number) => ({ x: W * .57, y: H * .46 });

/**
 * The ocean current far off (drawn by scene/water.ts): its middle at s (0 near, 1 far away) and how wide it is
 * there. It comes in wide from the left, high in the water, and slaloms off into the distance, its turns dying out
 * as it heads into the canyon's mouth, where it fades away.
 */
export function currentAt(s: number, W: number, H: number) {
  const mouth = canyonMouth(W, H), e = 1 - Math.pow(1 - s, 1.6);
  return {
    x: -.05 * W + (mouth.x + .05 * W) * e + Math.sin(s * Math.PI * 2.4) * W * .14 * Math.pow(1 - s, 1.2),
    y: .18 * H + (mouth.y - .18 * H) * e,
    w: 6 + 110 * Math.pow(1 - s, 1.5),
  };
}

/** The front sand's wavy top edge. */
const sandTop = (x: number, sy: number) => sy - Math.sin(x / 120 + 1) * 10 - Math.sin(x / 37) * 3;
/** How far above the sand line the floor's things reach: paintFloor paints from there down. */
export const FLOOR_REACH = 300;

/** Where the chest sits. */
const landmarks = (W: number) => ({ chest: W * .2 });

/** The stretches of the floor kept free of reefs in front (art/reef.ts), so the chest (the Copilot credits) stays in sight. */
export function keepClear(W: number): [number, number][] {
  const { chest } = landmarks(W);
  return [[chest - 52, chest + 74]];
}

/** The reefs in a tank W x H (art/reef.ts): the floor layer paints them, scene/water.ts adds their soft corals. */
export const reefs = (W: number, H: number) => reefLayout(W, H, keepClear(W));

// Cartoon style to match the fish: flat cel-shaded fills, ink outlines, light rims and shine spots.
let g: CanvasRenderingContext2D;
let R: () => number;

function ink(p: Path2D, col: string, w: number, alpha = 1) {
  g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round';
  g.stroke(p); g.globalAlpha = 1;
}

/** Fill a shape, then paint shading inside it (clipped) and outline it. */
function toon(p: Path2D, fill: string, inkCol: string, w: number, inside?: () => void) {
  g.fillStyle = fill; g.fill(p);
  if (inside) { g.save(); g.clip(p); inside(); g.restore(); }
  ink(p, inkCol, w);
}

function ellipse(x: number, y: number, rx: number, ry: number, rot = 0, col: string, alpha = 1) {
  g.globalAlpha = alpha; g.fillStyle = col;
  g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); g.globalAlpha = 1;
}

function wavyEdge(W: number, H: number, step: number, y: (x: number) => number) {
  const top = new Path2D(), fill = new Path2D();
  fill.moveTo(0, H);
  for (let x = 0; x <= W + step; x += step) { const v = y(x); x ? top.lineTo(x, v) : top.moveTo(x, v); fill.lineTo(x, v); }
  fill.lineTo(W, H); fill.closePath();
  return { top, fill };
}

/** Bits of broken coral and shell, scattered over the front sand. */
const PEBBLES = ['#efe6d8', '#e8c9c2', '#d9d3e8', '#f2dcc0', '#cfc6b8', '#e7b8a8', '#c9dce0'];
function pebbles(W: number, H: number, sy: number) {
  const PR = rng(555); // own RNG and a fixed number, so they stay put as the width changes
  for (let i = 0; i < 70; i++) {
    const x = PR() * W, y = sy + 16 + PR() * (H - sy - 20), r = 2.4 + PR() * 3.2, col = PEBBLES[Math.floor(PR() * PEBBLES.length)];
    const p = new Path2D(); p.ellipse(x, y, r * 1.25, r * .85, PR() - .5, 0, TAU);
    toon(p, col, shade(col, -.7), 1.1, () => ellipse(x - r * .35, y - r * .35, r * .4, r * .22, -.4, shade(col, .5)));
  }
}

function chest(cx: number, cy: number, gold: number, gems: number) {
  // 3/4 view: front face, right side face and the open top, with the lid hinged at the back and tipped open
  const cw = 64, ch = 36, L = -cw / 2, Rt = cw / 2, top = -ch, dx = 18, dy = -14, lidH = 30, lx = 7;
  const inkC = '#2a1405', brass = '#e0ac35', brassLight = '#ffe08a', goldInk = '#7a4f00';
  const poly = (...pts: [number, number][]) => { const p = new Path2D(); pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); return p; };
  const band = (p: Path2D, w: number) => { ink(p, inkC, w + 2.6); ink(p, brass, w); ink(p, brassLight, w * .3); };
  const line = (x1: number, y1: number, x2: number, y2: number) => { const p = new Path2D(); p.moveTo(x1, y1); p.lineTo(x2, y2); return p; };
  const by = top + dy; // back rim / hinge line
  g.save(); g.translate(cx, cy);
  const shadow = poly([L - 4, 3], [Rt + 4, 3], [Rt + dx + 6, dy + 2], [L + dx, dy + 2]);
  g.globalAlpha = .28; g.fillStyle = '#000'; g.fill(shadow); g.globalAlpha = 1;

  // lid, seen from the inside, with its domed end on the right
  const p0: [number, number] = [L + dx, by], p1: [number, number] = [Rt + dx, by];
  const p2: [number, number] = [Rt + dx + lx, by - lidH], p3: [number, number] = [L + dx + lx, by - lidH];
  const lidIn = poly(p0, p1, p2, p3);
  toon(lidIn, '#4a2810', inkC, 2.4, () => {
    for (let i = 1; i < 4; i++) { const k = i / 4; ink(line(p0[0] + lx * k, by - lidH * k, p1[0] + lx * k, by - lidH * k), '#2e1608', 1.4); }
    g.fillStyle = '#5e341a'; g.fill(poly(p3, p2, [p2[0] - 2, p2[1] + 7], [p3[0] - 2, p3[1] + 7]));
  });
  const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2, rr = Math.hypot(lx, lidH) / 2, ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  const dome = new Path2D(); dome.ellipse(mx, my, rr, rr * .55, ang, Math.PI, TAU, true); dome.closePath();
  toon(dome, '#8a5428', inkC, 2.2, () => ellipse(mx + 6, my, rr * .4, rr * .8, ang, '#6a3d1a'));
  band(dome, 2.6); band(lidIn, 3);

  // inside of the box: dark well with the inner back wall
  const opening = poly([L, top], [Rt, top], [Rt + dx, by], [L + dx, by]);
  toon(opening, '#2a1407', inkC, 2, () => { g.fillStyle = '#5a3216'; g.fill(poly([L + dx, by], [Rt + dx, by], [Rt + dx, by + 9], [L + dx, by + 9])); });

  // the gold: its level shows the Copilot credits left (gold = 0..1). Low = a layer down in the box, full = a heap.
  if (gold > 0) {
    const CR = rng(4242); // own RNG so the rest of the scenery doesn't shift with the gold
    const z = Math.max(0, .4 - gold) / .4 * 8, h = Math.max(0, gold - .25) * 30;
    const surf = new Path2D();
    surf.moveTo(L, top + z); surf.lineTo(L + dx, by + z);
    surf.quadraticCurveTo(dx, by + z - h * 2, Rt + dx, by + z); surf.lineTo(Rt, top + z); surf.closePath();
    g.save(); g.clip(poly([L, top], [Rt, top], [Rt + dx, by], [Rt + dx, by - 80], [L - 4, by - 80], [L - 4, top]));
    g.save(); g.shadowColor = '#ffd34d'; g.shadowBlur = 6 + 12 * gold; g.fillStyle = '#f2c230'; g.fill(surf); g.restore();
    ink(surf, goldInk, 1.6);
    const at = (u: number, v: number): [number, number] => [L + dx * v + u * cw, top + z + dy * v - h * 4 * u * (1 - u) * v * .95 - 1];
    for (let i = 0, n = 6 + Math.round(16 * gold); i < n; i++) {
      const [x, y] = at(.08 + CR() * .84, .15 + CR() * .8);
      const c = new Path2D(); c.ellipse(x, y, 4, 2.6, CR() * .6 - .3, 0, TAU);
      toon(c, '#ffe27a', goldInk, 1, () => { ellipse(x, y + 1.2, 4, 1.3, 0, '#e0a91c'); ellipse(x - 1.2, y - .8, 1.4, .7, 0, '#fffbe0'); });
    }
    if (gold >= .5) for (const [u, v, s] of [[.5, .7, 5], [.22, .4, 3.5]] as const) { // sparkles
      const [x, y] = at(u, v), sp = new Path2D();
      sp.moveTo(x, y - s - 4); sp.quadraticCurveTo(x, y - 4, x + s, y - 4); sp.quadraticCurveTo(x, y - 4, x, y + s - 4);
      sp.quadraticCurveTo(x, y - 4, x - s, y - 4); sp.quadraticCurveTo(x, y - 4, x, y - s - 4); g.fillStyle = '#fffbe0'; g.fill(sp);
    }
    g.restore();
  }

  // precious stones on top of the gold: one per started 20% of credits left. The diamond is the last one to go.
  if (gems > 0) {
    const z = Math.max(0, .4 - gold) / .4 * 8, h = Math.max(0, gold - .25) * 30;
    const at = (u: number, v: number): [number, number] => [L + dx * v + u * cw, top + z + dy * v - h * 4 * u * (1 - u) * v * .95 - 2];
    const stones = [
      { u: .5, v: .55, col: '#e6fbff', inkCol: '#3d7591', glow: '#bff4ff' }, // diamond
      { u: .26, v: .45, col: '#ff2d55', inkCol: '#6b0016', glow: '#ff6b88' }, // ruby
      { u: .74, v: .5, col: '#2f6bff', inkCol: '#0a1f66', glow: '#6f9bff' },  // sapphire
      { u: .38, v: .85, col: '#ff2d55', inkCol: '#6b0016', glow: '#ff6b88' }, // ruby
      { u: .64, v: .85, col: '#2f6bff', inkCol: '#0a1f66', glow: '#6f9bff' }, // sapphire
    ];
    for (const st of stones.slice(0, Math.min(5, gems)).reverse()) {
      const [x, y] = at(st.u, st.v), s = 5.5;
      const cut = poly([x - s, y - s * .2], [x - s * .55, y - s * .75], [x + s * .55, y - s * .75], [x + s, y - s * .2], [x, y + s]);
      g.save(); g.shadowColor = st.glow; g.shadowBlur = 8; g.fillStyle = st.col; g.fill(cut); g.restore();
      toon(cut, st.col, st.inkCol, 1.3, () => {
        g.fillStyle = shade(st.col, -.35); g.fill(poly([x, y - s * .2], [x + s, y - s * .2], [x, y + s]));     // shaded right pavilion
        g.fillStyle = shade(st.col, .4); g.fill(poly([x - s * .55, y - s * .75], [x + s * .55, y - s * .75], [x + s * .3, y - s * .2], [x - s * .3, y - s * .2])); // table
        ink(line(x - s, y - s * .2, x + s, y - s * .2), st.inkCol, .8, .6);
        ink(line(x - s * .3, y - s * .2, x, y + s), st.inkCol, .6, .4);
        ellipse(x - s * .35, y - s * .5, s * .22, s * .12, -.4, '#ffffff', .95);
      });
    }
  }

  // right side face (in shade) and the front face with planks
  const side = poly([Rt, top], [Rt + dx, by], [Rt + dx, dy], [Rt, 0]);
  toon(side, '#6a3d1a', inkC, 2.4, () => {
    for (let i = 1; i < 3; i++) { const k = i / 3; ink(line(Rt, top + ch * k, Rt + dx, by + ch * k), '#3e2210', 1.4); }
  });
  const front = poly([L, top], [Rt, top], [Rt, 0], [L, 0]);
  toon(front, '#8a5428', inkC, 2.4, () => {
    g.fillStyle = '#6a3d1a'; g.fillRect(L, top + ch * .72, cw, ch * .3);
    for (let i = 0; i < 3; i++) {
      const y = top + ch * i / 3;
      g.fillStyle = '#a86a36'; g.fillRect(L, y + 2, cw, 2);
      if (i) { g.fillStyle = '#4a2810'; g.fillRect(L, y - 1, cw, 1.6); }
    }
  });
  band(front, 3.5); band(side, 3);
  for (const x of [-cw / 4, cw / 4]) band(line(x, top, x, 0), 4);
  band(line(Rt + dx * .5, top + dy * .5, Rt + dx * .5, dy * .5), 3);
  for (const [x, y] of [[L, top], [L, 0], [Rt, top], [Rt, 0], [Rt + dx, by], [Rt + dx, dy]]) {
    const r = new Path2D(); r.arc(x, y, 2.6, 0, TAU); toon(r, brass, inkC, 1.2);
  }
  const lock = new Path2D(); lock.roundRect(-6.5, top - 1, 13, 15, 3);
  toon(lock, brass, inkC, 1.8, () => ellipse(-2.5, top + 2.5, 2.2, 1.4, 0, brassLight));
  g.fillStyle = inkC; g.beginPath(); g.arc(0, top + 6, 2, 0, TAU); g.fill(); g.fillRect(-.9, top + 6, 1.8, 4.5);

  // sunk into the sand: a drift over the foot of its front and up its side to the back corner
  const drift = new Path2D();
  drift.moveTo(L - 16, 7); drift.quadraticCurveTo(L - 6, -3, L + 8, -2); drift.quadraticCurveTo(cw * .2, 1, Rt - 4, -3);
  drift.quadraticCurveTo(Rt + dx * .5, dy * .45 - 4, Rt + dx + 3, dy - 1); drift.quadraticCurveTo(Rt + dx + 14, dy + 4, Rt + dx + 22, 7);
  drift.closePath();
  g.fillStyle = '#e8cd96'; g.fill(drift);
  const driftTop = new Path2D();
  driftTop.moveTo(L - 16, 7); driftTop.quadraticCurveTo(L - 6, -3, L + 8, -2); driftTop.quadraticCurveTo(cw * .2, 1, Rt - 4, -3);
  driftTop.quadraticCurveTo(Rt + dx * .5, dy * .45 - 4, Rt + dx + 3, dy - 1); driftTop.quadraticCurveTo(Rt + dx + 14, dy + 4, Rt + dx + 22, 7);
  ink(driftTop, '#7a5726', 2);
  for (const [x, y] of [[L - 4, 2], [cw * .1, 3], [Rt + 6, 0], [Rt + dx - 2, dy + 6]]) ellipse(x, y, 1.3, 1, 0, '#c9a66a');

  // a few coins spilled on the sand when it's well filled
  const spill = gold >= .9 ? 4 : gold >= .6 ? 2 : 0;
  for (const [x, y] of ([[Rt + 8, 4], [L - 7, 5], [Rt + 17, 2], [6, 7]] as const).slice(0, spill)) {
    const c = new Path2D(); c.ellipse(x, y, 4.2, 2.4, 0, 0, TAU);
    toon(c, '#ffe27a', goldInk, 1.1, () => { ellipse(x, y + 1.1, 4.2, 1.2, 0, '#e0a91c'); ellipse(x - 1.3, y - .7, 1.4, .6, 0, '#fffbe0'); });
  }
  g.restore();
}
/**
 * The mountains far away, behind the ocean current: a range along the whole horizon, low at the sides and rising to
 * its highest crags around the canyon cut through it, where the current flows in; the canyon's walls fall steeply
 * into a V at its mouth. A fainter range further still shows above it. Lit on the faces turned towards the gap, with
 * the layers of rock showing; hazier than the hills.
 */
function canyon(W: number, H: number) {
  const { x: mx, y: my } = canyonMouth(W, H), u = Math.min(1.2, Math.max(.7, W / 1600)), base = H * .74, cut = 150 * u;
  const crag = (x: number, k: number) => Math.sin(x / 37 + k) * .5 + Math.sin(x / 13 + k * 2) * .3 + Math.sin(x / 91 + k * 3) * .9;
  const floor = my + 26 * u, gapHalf = 12 * u;
  // each wall's shape, from the way through (0) out to the canyon's rim (1): [out, up] points with steep, rocky faces
  // and a few ledges of different sizes at different heights, so the two sides don't mirror each other
  const WALLS: [number, number][][] = [
    [[0, 0], [.06, .06], [.11, .3], [.3, .34], [.34, .52], [.4, .58], [.58, .6], [.63, .8], [.7, .84], [.75, 1], [1, 1]],
    [[0, 0], [.08, .16], [.15, .19], [.21, .44], [.47, .48], [.52, .68], [.57, .72], [.62, .9], [.69, .92], [.74, 1], [1, 1]],
  ];
  const wallAt = (side: number, t: number) => {
    const w = WALLS[side];
    for (let i = 1; i < w.length; i++) if (t <= w[i][0]) { const [a, ha] = w[i - 1], [b, hb] = w[i]; return ha + (hb - ha) * (t - a) / (b - a); }
    return 1;
  };
  /** How high the range's crest is at x: rising towards the canyon, and stepping down into it in shelves. */
  const crest = (x: number, peak: number, k: number) => {
    const d = Math.abs(x - mx), rise = Math.exp(-Math.pow(Math.max(0, d - cut) / (W * .2), 2));
    const top = my - (34 + peak * rise) * u - crag(x, k) * (10 + 16 * rise) * u;
    if (d >= cut || !peak) return top;
    if (d < gapHalf) return floor; // the narrow way through
    // the canyon's walls, along their own shapes, rough all over and jagged on the steep faces
    const side = x < mx ? 0 : 1, t = (d - gapHalf) / (cut - gapHalf), h = wallAt(side, t), steep = Math.abs(wallAt(side, t + .01) - h) > .006;
    const edge = my - (34 + peak) * u; // just under the canyon's rim
    const rough = steep ? Math.sin(d * 1.7 + side) * 3 * u + Math.sin(d * .53 + side * 3) * 2 * u : Math.sin(d / 5 + side) * 1.1 * u;
    return floor + (edge - floor) * h + rough;
  };
  // solid rock, so a touch darker than the water behind it, and deeper still towards its foot
  const range = (peak: number, k: number, top: string, foot: string, rim: string) => {
    const p = new Path2D(), edge = new Path2D();
    for (let x = -10; x <= W + 10; x += 6) { const y = crest(x, peak, k); x < -9 ? (p.moveTo(x, y), edge.moveTo(x, y)) : (p.lineTo(x, y), edge.lineTo(x, y)); }
    p.lineTo(W + 10, base); p.lineTo(-10, base); p.closePath();
    const fill = g.createLinearGradient(0, my - 200 * u, 0, base);
    fill.addColorStop(0, top); fill.addColorStop(1, foot);
    g.fillStyle = fill; g.fill(p);
    return { p, edge, rim };
  };
  // the furthest range first, a little lighter, its peaks spread wider
  const far = range(70, 4, '#09466f', '#073a5e', '#15608f');
  ink(far.edge, far.rim, 2, .4);
  const near = range(140, 1, '#083e65', '#06304f', '#155b8a');
  g.save(); g.clip(near.p);
  const CR = rng(6101);
  g.strokeStyle = '#052a45'; g.lineWidth = 2.5 * u; g.globalAlpha = .4;           // its layers of rock, wavy and dipping a little
  for (let ly = my - 170 * u; ly < base; ly += (26 + CR() * 20) * u) {
    g.beginPath(); g.moveTo(-10, ly + 14 * u);
    for (let x = 0; x <= W + 60; x += 60) g.lineTo(x, ly + Math.sin(x / 140 + ly) * 6 * u + (x - mx) / W * 16 * u);
    g.stroke();
  }
  g.restore();
  ink(near.edge, near.rim, 2, .55);
  // the ledges of the canyon's walls: their tops lit, the rock below them grooved, a boulder lying on some
  const BR = rng(6300);
  WALLS.forEach((w, si) => {
    const side = si ? 1 : -1;
    for (let i = 1; i < w.length - 1; i++) {
      const [a, ha] = w[i - 1], [b, hb] = w[i];
      if (Math.abs(hb - ha) > .05 || b - a < .04) continue; // only the ledges
      const d0 = gapHalf + (cut - gapHalf) * a, d1 = gapHalf + (cut - gapHalf) * b;
      const lit = new Path2D();
      for (let d = d0; d <= d1; d += 2) { const px = mx + side * d, py = crest(px, 140, 1) + 3 * u; d === d0 ? lit.moveTo(px, py) : lit.lineTo(px, py); }
      ink(lit, ha > .5 ? '#1a6698' : '#175e8e', 5 * u, .9);
      const y = crest(mx + side * (d0 + d1) / 2, 140, 1);
      g.strokeStyle = '#052a45'; g.lineWidth = 1.4 * u; g.globalAlpha = .55;
      for (const f of [.2, .5, .8]) { const gx = mx + side * (d0 + (d1 - d0) * f); g.beginPath(); g.moveTo(gx, y + 8 * u); g.lineTo(gx + side * (BR() - .3) * 3 * u, y + (22 + BR() * 22) * u); g.stroke(); }
      g.globalAlpha = 1;
      if (b - a > .1 && BR() < .7) { // a boulder broken off higher up
        const bx = mx + side * (d0 + (d1 - d0) * (.3 + BR() * .4)), by = crest(bx, 140, 1), r = (4 + BR() * 4) * u;
        const rock = new Path2D(); rock.ellipse(bx, by - r * .55, r, r * .7, BR() - .5, 0, TAU);
        g.fillStyle = '#0a4470'; g.fill(rock); ink(rock, '#052a45', 1.2, .7);
      }
    }
  });
}

/** A far-off outcrop of rock, a hazy silhouette standing w wide and h tall on (x, y), with a faint lit rim along its top. */
function farRock(x: number, y: number, w: number, h: number, col: string, rim: string, OR: () => number) {
  const top = new Path2D(), n = 7, pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, bump = .75 + OR() * .5, peak = Math.pow(Math.sin(Math.PI * t), .6);
    pts.push([x - w / 2 + t * w, y - h * peak * (i === 0 || i === n ? 0 : bump)]);
  }
  top.moveTo(...pts[0]);
  for (let i = 1; i < pts.length - 1; i++) top.quadraticCurveTo(...pts[i], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  top.lineTo(...pts[n]);
  const body = new Path2D(top); body.lineTo(x + w / 2, y + 40); body.lineTo(x - w / 2, y + 40); body.closePath();
  g.fillStyle = col; g.fill(body);
  ink(top, rim, 2, .4);
}

/**
 * An old sailing ship sunk long ago, far off, in three tones of the distance's blue (its body, shadow and a faint lit
 * edge) and a little see-through. It lists steeply into the hill: the bow, facing left, raised out of it with a long
 * pole sticking up, the stern sunk in. Its deck is broken open, its main mast stands with three yards of torn sails,
 * a second mast leans over to the right, and loose rigging hangs down. It lies on the crest of the hill (`top` is its
 * top edge) nearest x = cx, its keel just under the surface.
 */
function shipwreck(cx: number, top: (x: number) => number, u: number, col: string, rim: string) {
  let x = cx;
  for (let t = cx - 120; t <= cx + 120; t += 4) if (top(t) < top(x)) x = t;
  const dark = shade(col, -.32);
  // drawn on a canvas of its own first, then laid over the hill faded all at once
  const res = g.getTransform().a, L = -300, T = -400, w = 620, h = 520;
  const off = document.createElement('canvas'); off.width = Math.ceil(w * u * res); off.height = Math.ceil(h * u * res);
  const o = off.getContext('2d')!;
  o.scale(u * res, u * res); o.translate(-L, -T); o.rotate(.34);
  o.lineJoin = 'round'; o.lineCap = 'round';
  const fill = (d: string, c: string) => { o.fillStyle = c; o.fill(new Path2D(d)); };
  const line = (d: string, wd: number, c: string, alpha = 1) => { o.globalAlpha = alpha; o.strokeStyle = c; o.lineWidth = wd; o.stroke(new Path2D(d)); o.globalAlpha = 1; };
  /** A sail in rags hanging from a yard from (x1, y1) to (x2, y2), d deep: long torn strips with gaps between. */
  const rags = (x1: number, y1: number, x2: number, y2: number, d: number) => {
    let p = `M${x1} ${y1}`;
    for (let k = 0, n = 6; k < n; k++) {
      const a = k / n, b = (k + .55) / n, c = (k + 1) / n, len = d * (.45 + ((k * 7) % 5) / 6);
      const ax = x1 + (x2 - x1) * a, ay = y1 + (y2 - y1) * a, bx = x1 + (x2 - x1) * b, by = y1 + (y2 - y1) * b, cx2 = x1 + (x2 - x1) * c, cy = y1 + (y2 - y1) * c;
      p += ` L${ax + 2} ${ay + len * .7} L${(ax + bx) / 2 + 3} ${ay + len} L${bx} ${by + len * .5} L${(bx + cx2) / 2} ${by + 6} L${cx2} ${cy}`;
    }
    fill(p + ' Z', dark);
  };
  /** A pole from (x1, y1) to (x2, y2), w thick at the foot, with a lit edge. */
  const pole = (x1: number, y1: number, x2: number, y2: number, wd: number) => {
    line(`M${x1} ${y1} L${x2} ${y2}`, wd, col); line(`M${x1 - wd * .3} ${y1} L${x2 - wd * .3} ${y2}`, 1.4, rim, .5);
  };

  // the second mast, leaning over to the right behind the hull, its yards across it and their sails torn
  pole(40, -40, 170, -250, 7);
  for (const [t, yw] of [[.55, 120], [.85, 90]]) {
    const mx = 40 + 130 * t, my = -40 - 210 * t, dx = Math.cos(-.55) * yw / 2, dy = Math.sin(-.55) * yw / 2;
    pole(mx - dx, my - dy, mx + dx, my + dy, 4); rags(mx - dx, my - dy, mx + dx, my + dy, 46);
  }
  // the main mast, standing, with three yards of torn sails and a crossbar at the top
  pole(-20, -40, -24, -330, 8);
  for (const [y, yw] of [[-300, 70], [-238, 118], [-168, 150]]) { pole(-22 - yw / 2, y, -22 + yw / 2, y + 4, 4.5); rags(-22 - yw / 2, y + 2, -22 + yw / 2, y + 6, 58); }
  line('M-24 -330 L-152 -192 M-24 -330 L100 -168 M-30 -238 Q-60 -150 -48 -96 M30 -236 Q44 -170 32 -120', 1.3, dark, .8); // loose rigging
  // the long pole sticking up from the raised bow
  pole(-136, -78, -236, -250, 7);
  line('M-236 -250 L-24 -330', 1.3, dark, .8);
  // the hull: the bow raised on the left, its deck broken open along the middle, the stern sunk in on the right
  const hull = new Path2D(`M150 70 L152 -10 L140 -42 L118 -34 L104 -50 L86 -32 L68 -46 L46 -28 L24 -42 L4 -30
    L-50 -44 Q-96 -50 -116 -62 L-122 -82 L-152 -84 Q-170 -62 -162 -30 Q-142 22 -80 52 L60 70 Z`);
  o.fillStyle = col; o.fill(hull);
  o.save(); o.clip(hull);
  fill('M140 -42 L118 -34 L104 -50 L86 -32 L68 -46 L46 -28 L24 -42 L4 -30 L-50 -44 L-50 -24 L150 -16 Z', dark); // its open inside
  line('M-156 -40 Q-40 -18 152 -4 M-146 -10 Q-40 8 152 18', 3, dark, .8);                                       // planking
  fill('M-70 -10 L-54 -18 L-40 -8 L-46 6 L-64 4 Z', dark);                                                       // a hole in its side
  o.restore();
  line('M-116 -62 L-122 -82 L-152 -84 Q-170 -62 -162 -30', 2, rim, .55);                                         // a faint lit edge on the bow
  line('M-50 -44 Q-96 -50 -116 -62', 2, rim, .55);

  g.save(); g.translate(x, top(x) + 4 * u);
  g.globalAlpha = .82; g.drawImage(off, L * u, T * u, w * u, h * u); g.globalAlpha = 1;
  g.restore();
}

/** The open water at the very back, from light at the top to deep blue, and the canyon far away in it. Behind the current (scene/water.ts). */
export function paintWater(ctx: CanvasRenderingContext2D, W: number, H: number) {
  g = ctx;
  const wg = g.createLinearGradient(0, 0, 0, H);
  wg.addColorStop(0, '#0b6a9e'); wg.addColorStop(.45, '#06406a'); wg.addColorStop(1, '#021a30');
  g.fillStyle = wg; g.fillRect(0, 0, W, H);
  canyon(W, H);
}

/** The static backdrop in front of the open water (paintWater) and the current far off: hills, the wreck, sand, gravel, shells and starfish. Painted on resize. */
export function paintTerrain(ctx: CanvasRenderingContext2D, W: number, H: number) {
  g = ctx; R = rng(1337);

  // distant hills (3 flat layers with a soft lit crest), with rocks rising out of each and, far off, a shipwreck.
  // Each hill is filled after what stands on it, so its own slope hides their feet.
  const hills: [string, number, number, number][] = [['#08385c', .62, 70, 0], ['#0a2f4c', .7, 55, 2], ['#0b2a40', .77, 40, 5]];
  hills.forEach(([col, base, amp, ph], k) => {
    const top = (x: number) => H * base - Math.sin(x / 210 + ph) * amp - Math.sin(x / 77 + ph * 2) * amp * .35;
    // rocky outcrops, at their own spots along the floor so they stay put on a resize; smaller further away
    for (let j = 0; j * 300 < W + 300; j++) {
      const OR = rng(7700 + k * 100 + j);
      if (OR() < .35) continue;
      const x = j * 300 + OR() * 200, w = (40 + OR() * 70) * (.7 + k * .15), h = (22 + OR() * 50) * (.7 + k * .15);
      farRock(x, top(x) + 14, w, h, shade(col, .06), shade(col, .2), OR);
    }
    if (k === 1) shipwreck(W * .7, top, Math.min(1, Math.max(.6, W / 1800)), shade(col, .1), shade(col, .32));
    const e = wavyEdge(W, H, 20, top);
    g.fillStyle = col; g.fill(e.fill);
    ink(e.top, shade(col, .18), 2.5, .35);
  });

  // mid dune
  const sy = sandY(H);
  const dune = wavyEdge(W, H, 15, x => sy - 25 - Math.sin(x / 160) * 18 - Math.sin(x / 53) * 5);
  g.fillStyle = '#93794a'; g.fill(dune.fill);
  ink(dune.top, '#b39963', 5, .5); ink(dune.top, '#3f2e12', 2, .7);

  // front sand
  const sand = wavyEdge(W, H, 12, x => sandTop(x, sy));
  g.fillStyle = '#e8cd96'; g.fill(sand.fill);
  g.save(); g.translate(0, 6); ink(sand.top, '#f7e5b8', 6); g.restore();
  ink(sand.top, '#7a5726', 2.4);
  // speckles, as many as the width allows: with their own RNG, so the rest of the floor stays put as the width changes
  const SR = rng(2024);
  for (let i = 0; i < W * .3; i++) {
    const r = .8 + SR() * 1.3;
    ellipse(SR() * W, sy + 10 + SR() * (H - sy), r, r * .8, 0, SR() < .55 ? '#c9a66a' : '#fbecc8');
  }
  g.strokeStyle = '#c29d5f'; g.lineWidth = 2; g.lineCap = 'round'; // ripples
  for (let i = 0; i < 22; i++) {
    const x = R() * W, y = sy + 14 + R() * (H - sy - 18), w = 24 + R() * 40;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 5, x + w, y); g.stroke();
  }

  pebbles(W, H, sy);

  // shells and starfish
  for (let i = 0; i < 7; i++) {
    const x = R() * W, y = sy + 18 + R() * (H - sy - 26);
    if (R() < .5) {
      const col = ['#ef4a2e', '#ff8a5c', '#ff6b8a'][i % 3], rot = R() * TAU, star = new Path2D();
      for (let k = 0; k < 10; k++) { const a = k * TAU / 10 - Math.PI / 2 + rot, r = k % 2 ? 4.5 : 11; star.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      star.closePath();
      toon(star, col, shade(col, -.6), 1.6, () => {
        for (let k = 0; k < 5; k++) { const a = k * TAU / 5 - Math.PI / 2 + rot; ellipse(x + Math.cos(a) * 5.5, y + Math.sin(a) * 5.5, 1, 1, 0, shade(col, .55)); }
      });
    } else {
      const shell = new Path2D(); shell.ellipse(x, y, 8, 6.5, 0, Math.PI, TAU); shell.closePath();
      toon(shell, '#f7e8d6', '#8a5a3a', 1.4, () => {
        g.strokeStyle = '#d2a986'; g.lineWidth = 1.2;
        for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + k * 3.2, y - 6); g.stroke(); }
      });
    }
  }
}

/**
 * The floor's things, in a layer of their own above the soft corals at the back (scene/water.ts) and below the fish:
 * the reefs with their hard corals, and the chest. Painted from FLOOR_REACH above the sand
 * line down, on resize and when the gold level changes.
 */
export function paintFloor(ctx: CanvasRenderingContext2D, W: number, H: number, gold = 1, gems = 5) {
  g = ctx; R = rng(4321);
  const sy = sandY(H), marks = landmarks(W), all = reefs(W, H);
  g.save(); g.translate(0, FLOOR_REACH - sy);
  const ground = (x: number) => sandTop(x, sy);
  paintRidge(g, W, sy, ground);
  paintReefs(g, all, ground);
  chest(marks.chest, sy + 30, gold, gems); // well forward on the sand, in front of the reef
  g.restore();
}
