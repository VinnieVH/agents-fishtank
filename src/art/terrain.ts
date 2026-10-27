import { rng, shade, TAU } from '../util';

export const sandY = (H: number) => H - 70;

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

/** Smooth wobbly blob; `squash` flattens the lower half so it sits on the ground. */
function blob(x: number, y: number, rx: number, ry: number, wob = .14, n = 9, squash = 1): Path2D {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, k = 1 + (R() - .5) * wob * 2, dy = Math.sin(a) * ry * k;
    pts.push([x + Math.cos(a) * rx * k, y + (dy > 0 ? dy * squash : dy)]);
  }
  const mid = (i: number) => { const a = pts[i % n], b = pts[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const p = new Path2D(), m0 = mid(n - 1);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) { const m = mid(i); p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
  p.closePath();
  return p;
}

function wavyEdge(W: number, H: number, step: number, y: (x: number) => number) {
  const top = new Path2D(), fill = new Path2D();
  fill.moveTo(0, H);
  for (let x = 0; x <= W + step; x += step) { const v = y(x); x ? top.lineTo(x, v) : top.moveTo(x, v); fill.lineTo(x, v); }
  fill.lineTo(W, H); fill.closePath();
  return { top, fill };
}

function rock(x: number, y: number, s: number, moss: boolean) {
  const ry = s * (.55 + R() * .2), p = blob(x, y - ry * .35, s, ry, .12, 9, .35);
  ellipse(x + s * .1, y + ry * .12, s * 1.05, ry * .22, 0, '#000', .25); // contact shadow
  toon(p, '#7891a1', '#17242d', 2.4, () => {
    ellipse(x + s * .55, y + ry * .1, s * 1.05, ry * 1.2, 0, '#4d6575');                     // shadow side
    ellipse(x - s * .32, y - ry * .8, s * .5, ry * .3, -.25, '#a9c0cd');                      // lit top
    ellipse(x - s * .42, y - ry * .9, s * .14, ry * .09, -.3, '#ffffff', .8);                 // shine spot
  });
  if (moss) { // moss cap
    const m = blob(x - s * .1 + (R() - .5) * s * .3, y - ry * 1.15, s * .42, ry * .2, .25, 7);
    toon(m, '#55b94e', '#1d4a22', 1.6, () => ellipse(x - s * .25, y - ry * 1.3, s * .2, ry * .07, 0, '#9be37f'));
  }
}

function coral(x: number, y: number, len: number, w: number, col: string) {
  const segs: [number, number, number, number, number][] = [];
  const grow = (x: number, y: number, len: number, ang: number, w: number, depth: number): void => {
    if (depth === 0 || len < 4) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    segs.push([x, y, x2, y2, w]);
    grow(x2, y2, len * .78, ang - .35 - R() * .25, w * .74, depth - 1);
    grow(x2, y2, len * .78, ang + .35 + R() * .25, w * .74, depth - 1);
  };
  grow(x, y, len, -Math.PI / 2 + (R() - .5) * .3, w, 5);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const pass = (col: string, extra: number, k = 1, dx = 0) => {
    g.strokeStyle = col;
    for (const [x1, y1, x2, y2, sw] of segs) { g.lineWidth = sw * k + extra; g.beginPath(); g.moveTo(x1 + dx * sw, y1); g.lineTo(x2 + dx * sw, y2); g.stroke(); }
  };
  pass(shade(col, -.65), 3.6);   // ink
  pass(col, 0);                  // body
  pass(shade(col, .45), 0, .3, -.22); // light rim on the left
  for (const [, , x2, y2, sw] of segs.slice(-8)) ellipse(x2, y2, sw * .35 + 1, sw * .35 + 1, 0, shade(col, .65));
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

  // a few coins spilled on the sand when it's well filled
  const spill = gold >= .9 ? 4 : gold >= .6 ? 2 : 0;
  for (const [x, y] of ([[Rt + 8, 4], [L - 7, 5], [Rt + 17, 2], [6, 7]] as const).slice(0, spill)) {
    const c = new Path2D(); c.ellipse(x, y, 4.2, 2.4, 0, 0, TAU);
    toon(c, '#ffe27a', goldInk, 1.1, () => { ellipse(x, y + 1.1, 4.2, 1.2, 0, '#e0a91c'); ellipse(x - 1.3, y - .7, 1.4, .6, 0, '#fffbe0'); });
  }
  g.restore();
}
/** The static backdrop: water, hills, sand, rocks, coral, arch, chest. Painted on resize and when the gold level changes. */
export function paintTerrain(ctx: CanvasRenderingContext2D, W: number, H: number, gold = 1, gems = 5) {
  g = ctx; R = rng(1337);

  // water
  const wg = g.createLinearGradient(0, 0, 0, H);
  wg.addColorStop(0, '#0b6a9e'); wg.addColorStop(.45, '#06406a'); wg.addColorStop(1, '#021a30');
  g.fillStyle = wg; g.fillRect(0, 0, W, H);

  // distant hills (3 flat layers with a soft lit crest)
  const hills: [string, number, number, number][] = [['#08385c', .62, 70, 0], ['#0a2f4c', .7, 55, 2], ['#0b2a40', .77, 40, 5]];
  for (const [col, base, amp, ph] of hills) {
    const e = wavyEdge(W, H, 20, x => H * base - Math.sin(x / 210 + ph) * amp - Math.sin(x / 77 + ph * 2) * amp * .35);
    g.fillStyle = col; g.fill(e.fill);
    ink(e.top, shade(col, .18), 2.5, .35);
  }

  // back rock silhouettes
  for (let i = 0; i < 9; i++) {
    const x = R() * W, y = H * .78 + R() * 30, s = 30 + R() * 60;
    const p = blob(x, y, s, s * .55, .12, 8, .3);
    g.fillStyle = '#0c2a42'; g.fill(p); ink(p, '#061a2b', 2, .8);
  }

  // mid dune
  const sy = sandY(H);
  const dune = wavyEdge(W, H, 15, x => sy - 25 - Math.sin(x / 160) * 18 - Math.sin(x / 53) * 5);
  g.fillStyle = '#93794a'; g.fill(dune.fill);
  ink(dune.top, '#b39963', 5, .5); ink(dune.top, '#3f2e12', 2, .7);

  // stone arch
  const ax = W * .58, ay = sy - 10, ar = Math.min(110, W * .08), t = ar * .42, ro = ar + t / 2, ri = ar - t / 2;
  const a0 = Math.PI * .99, a1 = Math.PI * 2.01;
  const arch = new Path2D(); arch.arc(ax, ay, ro, a0, a1); arch.arc(ax, ay, ri, a1, a0, true); arch.closePath();
  toon(arch, '#7b93a3', '#17242d', 2.6, () => {
    g.fillStyle = '#4f6676'; g.fillRect(ax + ar * .35, ay - ro - 2, ro, ro + 20); // shadow side
    g.strokeStyle = '#5c7484'; g.lineWidth = t * .35; g.beginPath(); g.arc(ax, ay, ri + t * .12, a0, a1); g.stroke(); // underside
    g.strokeStyle = '#b4c8d4'; g.lineWidth = t * .16; g.lineCap = 'round';
    g.beginPath(); g.arc(ax, ay, ro - t * .2, Math.PI * 1.1, Math.PI * 1.42); g.stroke(); // lit rim
    ellipse(ax - ro * .55, ay - ro * .62, t * .12, t * .07, -.8, '#ffffff', .8);
    g.strokeStyle = '#17242d'; g.lineWidth = 1.5; g.globalAlpha = .55; // cracks
    for (const a of [1.3, 1.62, 1.85]) {
      const c = Math.cos(a * Math.PI), s = Math.sin(a * Math.PI);
      g.beginPath(); g.moveTo(ax + c * ro, ay + s * ro); g.lineTo(ax + c * (ro - t * .35), ay + s * (ro - t * .35) + 3); g.stroke();
    }
    g.globalAlpha = 1;
  });
  for (const a of [1.22, 1.38, 1.55, 1.68]) { // moss on top
    const x = ax + Math.cos(a * Math.PI) * ro, y = ay + Math.sin(a * Math.PI) * ro;
    toon(blob(x, y + 2, 14 + R() * 8, 5, .25, 7), '#55b94e', '#1d4a22', 1.6);
  }

  // front sand
  const sand = wavyEdge(W, H, 12, x => sy - Math.sin(x / 120 + 1) * 10 - Math.sin(x / 37) * 3);
  g.fillStyle = '#e8cd96'; g.fill(sand.fill);
  g.save(); g.translate(0, 6); ink(sand.top, '#f7e5b8', 6); g.restore();
  ink(sand.top, '#7a5726', 2.4);
  for (let i = 0; i < W * .3; i++) { // speckles
    const r = .8 + R() * 1.3;
    ellipse(R() * W, sy + 10 + R() * (H - sy), r, r * .8, 0, R() < .55 ? '#c9a66a' : '#fbecc8');
  }
  g.strokeStyle = '#c29d5f'; g.lineWidth = 2; g.lineCap = 'round'; // ripples
  for (let i = 0; i < 22; i++) {
    const x = R() * W, y = sy + 14 + R() * (H - sy - 18), w = 24 + R() * 40;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 5, x + w, y); g.stroke();
  }

  // foreground rocks
  // A pile: the biggest boulder sits in the middle at the back, smaller ones flank it alternately left/right,
  // each a little lower (in front) and only overlapping the edge of the previous one.
  const rocks = (x: number, y: number, n: number) => {
    const sizes = Array.from({ length: n }, () => 18 + R() * 30).sort((a, b) => b - a);
    const edge = [x, x];
    sizes.forEach((s, i) => {
      if (i === 0) { rock(x, y, s, true); edge[0] = x - s; edge[1] = x + s; return; }
      const side = i % 2, dir = side ? 1 : -1, rx = edge[side] + dir * s * .55;
      rock(rx, y + 3 + i * 2, s, false);
      edge[side] = rx + dir * s;
    });
  };
  rocks(W * .08, sy + 6, 3); rocks(W * .42, sy + 8, 4); rocks(W * .86, sy + 4, 3); rocks(W * .7, sy + 10, 2);

  // branching coral
  coral(W * .33, sy + 4, 34, 9, '#ff6f91');
  coral(W * .36, sy + 8, 24, 7, '#ff9a5a');
  coral(W * .79, sy + 6, 30, 8, '#c86bff');

  // brain coral
  const bx = W * .5, by = sy + 6, br = 28;
  const brain = new Path2D(); brain.arc(bx, by, br, Math.PI, TAU); brain.closePath();
  toon(brain, '#f2b469', '#5a2e10', 2.4, () => {
    ellipse(bx + br * .7, by, br * .7, br * 1.1, 0, '#d68a45');
    g.strokeStyle = '#a85f28'; g.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      g.beginPath();
      for (let a = Math.PI; a <= TAU; a += .08) { const r = br * i / 5 + Math.sin(a * 9 + i) * 2; g.lineTo(bx + Math.cos(a) * r, by + Math.sin(a) * r); }
      g.stroke();
    }
    ellipse(bx - br * .4, by - br * .62, br * .22, br * .1, -.5, '#ffe2b5');
  });

  chest(W * .2, sy + 2, gold, gems);

  // shells and starfish
  for (let i = 0; i < 7; i++) {
    const x = R() * W, y = sy + 18 + R() * (H - sy - 26);
    if (R() < .5) {
      const col = ['#ff8a5c', '#ffb36b', '#ff6b8a'][i % 3], rot = R() * TAU, star = new Path2D();
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
