import { Container, Graphics, MeshPlane, Sprite, Texture, type Renderer } from 'pixi.js';
import { currentAt, reefs, sandY } from '../art/terrain';
import type { SoftKind } from '../art/reef';
import { paintTexture } from '../art/canvas';
import { rng, shade, TAU } from '../util';

/** A soft coral growing from a reef (art/reef.ts), swaying in the water; `i` tells it apart from all the others. */
interface Soft { i: number; kind: SoftKind; x: number; y: number; h: number; col: string; seed: number; ph: number }
type Pt = [number, number];
interface Anemone { x: number; y: number; n: number; len: number; col: string }
interface Plankton { x: number; y: number; r: number; vx: number; vy: number; ph: number }
interface Bubble { x: number; y: number; r: number; v: number; ph: number; src: number }

/** How far each kind sways over (as a fraction of its height) and how slowly (ms): fans flex a little, whips a lot. */
const SWAY: Record<SoftKind, [number, number]> = { fan: [.04, 2300], whip: [.14, 1700], tree: [.07, 1500] };

/** Strokes a list of [x1, y1, x2, y2, width] segments three times: ink, colour, and a light rim on the left. */
function branches(g: Graphics, segs: number[][], col: string) {
  for (const [colr, extra, k, dx] of [[shade(col, -.65), 3, 1, 0], [col, 0, 1, 0], [shade(col, .45), 0, .3, -.25]] as const)
    for (const [x1, y1, x2, y2, w] of segs) g.moveTo(x1 + dx * w, y1).lineTo(x2 + dx * w, y2).stroke({ width: w * k + extra, color: colr, cap: 'round' });
}

/** A sea fan: one flat fan of ever finer branches, spread wide like a net. */
function fan(g: Graphics, c: Soft, R: () => number) {
  const segs: number[][] = [];
  const grow = (x: number, y: number, len: number, ang: number, w: number, depth: number): void => {
    if (!depth) return;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    segs.push([x, y, x2, y2, w]);
    const spread = .22 + R() * .2;
    grow(x2, y2, len * .78, ang - spread, Math.max(1, w * .72), depth - 1);
    grow(x2, y2, len * .78, ang + spread, Math.max(1, w * .72), depth - 1);
  };
  grow(0, 0, c.h * .16, -Math.PI / 2, Math.max(3, c.h * .022), 7);
  branches(g, segs, c.col);
  for (const [, , x2, y2] of segs.slice(-64)) g.circle(x2, y2, 1.6).fill(shade(c.col, .55));
}

/** Sea whips: a bunch of long, thin rods covered in little polyps. */
function whip(g: Graphics, c: Soft, R: () => number) {
  for (let k = 0, n = 4 + Math.floor(R() * 4); k < n; k++) {
    const f = k / (n - 1) - .5, len = c.h * (.6 + R() * .4), lean = f * .5 + (R() - .5) * .15, bend = (R() - .5) * .5;
    const pts: Pt[] = [[f * 10, 0]];
    for (let i = 1; i <= 14; i++) { const t = i / 14, a = lean + bend * t * t, [px, py] = pts[i - 1]; pts.push([px + Math.sin(a) * len / 14, py - Math.cos(a) * len / 14]); }
    const segs = pts.slice(1).map(([x, y], i) => [pts[i][0], pts[i][1], x, y, 5.5 - 2.5 * i / 14]);
    branches(g, segs, c.col);
    for (let i = 1; i < pts.length; i++) g.circle(pts[i][0] + (i % 2 ? 1.6 : -1.6), pts[i][1], 1.2).fill(shade(c.col, .6));
  }
}

/** A tree coral: a pale, see-through trunk branching out into clusters of bright round lobes. */
function tree(g: Graphics, c: Soft, R: () => number) {
  const segs: number[][] = [], ends: Pt[] = [];
  const grow = (x: number, y: number, len: number, ang: number, w: number, depth: number): void => {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    segs.push([x, y, x2, y2, w]);
    if (!depth) { ends.push([x2, y2]); return; }
    for (let k = 0, n = 2 + (R() < .4 ? 1 : 0); k < n; k++) grow(x2, y2, len * .7, ang + (k - (n - 1) / 2) * .6 + (R() - .5) * .2, w * .65, depth - 1);
  };
  grow(0, 0, c.h * .32, -Math.PI / 2, Math.max(4, c.h * .06), 3);
  for (const [x1, y1, x2, y2, w] of segs) g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: w + 3, color: shade(c.col, -.6), cap: 'round', alpha: .8 });
  for (const [x1, y1, x2, y2, w] of segs) g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: w, color: shade(c.col, .65), cap: 'round', alpha: .85 });
  for (const [ex, ey] of ends) for (let k = 0, n = 7 + Math.floor(R() * 5); k < n; k++) {
    const a = R() * TAU, d = R() * 10, x = ex + Math.cos(a) * d, y = ey + Math.sin(a) * d * .8, r = 3.5 + R() * 3.5;
    g.circle(x, y, r).fill(c.col).stroke({ width: 1.3, color: shade(c.col, -.65) });
    g.circle(x - r * .3, y - r * .3, r * .35).fill({ color: 0xffffff, alpha: .6 });
  }
}

const SOFT: Record<SoftKind, (g: Graphics, c: Soft, R: () => number) => void> = { fan, whip, tree };

/** A point across the current at s, `v` from -1 (one edge) to 1 (the other). */
function acrossCurrent(s: number, v: number, W: number, H: number): Pt {
  const a = currentAt(s, W, H), b = currentAt(Math.min(1, s + .01), W, H), l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return [a.x - (b.y - a.y) / l * v * a.w / 2, a.y + (b.x - a.x) / l * v * a.w / 2];
}

/** Everything that moves in the water: light rays, surface shimmer, the current far off, soft corals, anemones, bubbles, plankton. */
export class Water {
  readonly rays = new Container();
  readonly shimmer = new Graphics();
  readonly softCorals = new Container();
  readonly anemones = new Graphics();
  readonly anemoneTips = new Graphics();
  readonly bubbles = new Graphics();
  readonly plankton = new Graphics();
  /** The ocean current far off: a faint band of lighter water, and the streaks flowing along it. */
  readonly current = new Container();
  private band = new Graphics();
  private streaks = new Graphics();
  private flow: { s: number; v: number; len: number }[] = [];

  private W = 0; private H = 0;
  private plants: Soft[] = [];
  /**
   * Each soft coral is drawn once into a texture, and sways by bending that texture on a mesh: redrawing hundreds of
   * outlined branches every frame would be far too slow. The textures are kept per coral (for this tank height), so a
   * resize only draws the ones that are new.
   */
  private views: { p: Soft; mesh: MeshPlane; rest: Float32Array; baseY: number }[] = [];
  private drawn = new Map<number, { texture: Texture; x: number; y: number }>();
  private drawnFor = 0;
  private anemoneList: Anemone[] = [];
  private planktonList: Plankton[] = [];
  private bubbleList: Bubble[] = [];
  private rayTexture: Texture | null = null;

  constructor() {
    this.current.addChild(this.band, this.streaks);
    this.current.blendMode = 'add';
    this.rays.blendMode = 'add';
    this.anemoneTips.blendMode = 'add';
  }

  build(W: number, H: number, renderer: Renderer) {
    const sx = W / (this.W || W), sy0 = H / (this.H || H);
    this.W = W; this.H = H;
    const R = rng(99), sy = sandY(H);
    // the soft corals growing from the reefs at the back, behind their rock and hard corals (main.ts puts the floor in
    // front of them), the taller ones further back
    this.plants = reefs(W, H).flatMap(r => r.soft.map((c, k) => ({ ...c, i: r.i * 8 + k, h: c.s, ph: rng(c.seed)() * TAU })))
      .sort((a, b) => b.h - a.h);
    this.showPlants(renderer, H);
    // the current's band, fading out as it goes away; its streaks spread along it at the start
    const band = this.band.clear();
    for (const v of [1, .65, .35]) for (let i = 0, n = 60; i < n; i++) { // three bands inside each other: soft edges
      const s0 = i / n, s1 = (i + 1) / n;
      band.poly([...acrossCurrent(s0, -v, W, H), ...acrossCurrent(s1, -v, W, H), ...acrossCurrent(s1, v, W, H), ...acrossCurrent(s0, v, W, H)])
        .fill({ color: 0x8fdcff, alpha: .05 * (1 - .7 * s0) * Math.min(1, s0 * 10, (1 - s0) * 8) });
    }
    if (!this.flow.length) this.flow = Array.from({ length: 120 }, () => ({ s: R(), v: (R() - .5) * 1.5, len: .02 + R() * .03 }));
    this.anemoneList = [W * .12, W * .52, W * .83].map((x, i) => ({ x, y: sy + 10, n: 16, len: 26 + i * 4, col: ['#ff5edb', '#5ef2ff', '#ffe95e'][i] }));
    // plankton and bubbles keep drifting where they are when the tank is resized
    if (this.planktonList.length) for (const p of this.planktonList) { p.x *= sx; p.y *= sy0; }
    else this.planktonList = Array.from({ length: 70 }, () => ({ x: R() * W, y: R() * H, r: .6 + R() * 1.4, vx: (R() - .5) * .15, vy: (R() - .5) * .1, ph: R() * TAU }));
    if (this.bubbleList.length) for (const b of this.bubbleList) { b.x *= sx; b.y *= sy0; }
    else {
      this.bubbleList = Array.from({ length: 30 }, () => ({ x: 0, y: H + R() * H, r: 1.5 + R() * 3.5, v: .4 + R() * .9, ph: R() * TAU, src: R() }));
      for (const b of this.bubbleList) b.x = this.bubbleSource(b.src);
    }

    // one light-ray texture (a slanted trapezoid fading downwards), reused by six sprites. The sprites stay: new ones
    // would show at full brightness until the next frame, and the tank is drawn right after a resize
    const rh = H * .85, old = this.rayTexture;
    this.rayTexture = paintTexture(260, rh, 1, g => {
      const lg = g.createLinearGradient(0, 0, 0, rh);
      lg.addColorStop(0, 'rgb(180,235,255)'); lg.addColorStop(1, 'rgba(180,235,255,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, 0); g.lineTo(70, 0); g.lineTo(260, rh); g.lineTo(120, rh); g.fill();
    });
    if (!this.rays.children.length) for (let i = 0; i < 6; i++) this.rays.addChild(new Sprite({ texture: this.rayTexture, alpha: 0 }));
    for (const r of this.rays.children as Sprite[]) r.texture = this.rayTexture;
    old?.destroy(true);
  }

  update(t: number, dt: number, busy: boolean, day: number, night: number) {
    const { W, H } = this;

    this.rays.children.forEach((r, i) => {
      r.x = i * W / 6 + Math.sin(t / 5000 + i * 1.7) * 70;
      r.alpha = (.035 + Math.sin(t / 2300 + i) * .015) * (.15 + .85 * day);
    });

    // streaks flowing along the current, slower and smaller the further away they are
    const st = this.streaks.clear();
    for (const f of this.flow) {
      f.s += dt * .0011 * (1 - .65 * f.s);
      if (f.s > 1) { f.s = 0; f.v = (Math.random() - .5) * 1.5; }
      const a = acrossCurrent(f.s, f.v, W, H), b = acrossCurrent(Math.max(0, f.s - f.len * (1 - .6 * f.s)), f.v, W, H);
      st.moveTo(...a).lineTo(...b).stroke({ width: .8 + 2.4 * (1 - f.s), color: 0xc8f2ff, alpha: .34 * (1 - .6 * f.s) * Math.min(1, f.s * 15, (1 - f.s) * 10), cap: 'round' });
    }

    const sh = this.shimmer.clear();
    for (let r = 0; r < 3; r++) {
      sh.moveTo(0, 6 + r * 7 + Math.sin(t / (600 + r * 200)) * 3);
      for (let x = 16; x <= W + 16; x += 16) sh.lineTo(x, 6 + r * 7 + Math.sin(x / 40 + t / (600 + r * 200)) * 3);
      sh.stroke({ width: 2, color: 0xc8f0ff, alpha: .12 });
    }

    this.swayPlants(t);

    this.drawAnemones(t);
    this.anemoneTips.alpha = night;
    this.anemoneTips.visible = night > .05;

    const sy = sandY(H), b = this.bubbles.clear();
    for (const p of this.bubbleList) {
      p.y -= p.v * (busy ? 2.6 : .7) * dt;
      if (p.y < -10) { p.y = sy - 40 + Math.random() * 10; p.x = this.bubbleSource(p.src); }
      const x = p.x + Math.sin(p.y / 25 + p.ph) * 4;
      b.circle(x, p.y, p.r).stroke({ width: 1, color: 0xd2f5ff, alpha: .6 });
      b.circle(x - p.r * .35, p.y - p.r * .35, p.r * .3).fill({ color: 0xffffff, alpha: .5 });
    }

    // plankton, bioluminescent at night
    const pl = this.plankton.clear();
    this.plankton.blendMode = night > .05 ? 'add' : 'normal';
    const color = (200 - 110 * night | 0) << 16 | 255 << 8 | (240 + 15 * night | 0);
    for (const p of this.planktonList) {
      p.x += p.vx * dt; p.y += (p.vy + Math.sin(t / 2000 + p.ph) * .05) * dt;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      pl.circle(p.x, p.y, p.r).fill({ color, alpha: Math.min(1, (.25 + Math.sin(t / 700 + p.ph) * .15) * (1 + 1.4 * night)) });
    }
  }

  /** Bubbles rise from the treasure chest and from the reef past the middle. */
  private bubbleSource(src: number) {
    return src < .6 ? this.W * .2 + 20 + Math.random() * 10 : this.W * .58 + (Math.random() - .5) * 20;
  }

  /** Gives every plant its mesh, drawing the ones not drawn yet for this tank height. */
  private showPlants(renderer: Renderer, H: number) {
    if (this.drawnFor !== H) { for (const d of this.drawn.values()) d.texture.destroy(true); this.drawn.clear(); this.drawnFor = H; }
    for (const v of this.views) v.mesh.destroy();
    this.views = [];
    for (const p of this.plants) {
      let d = this.drawn.get(p.i);
      if (!d) {
        const g = new Graphics();
        this.paintPlant(g, p);
        const b = g.getLocalBounds();
        d = { texture: renderer.generateTexture({ target: g, resolution: renderer.resolution, antialias: true }), x: b.x, y: b.y };
        g.destroy();
        this.drawn.set(p.i, d);
      }
      const mesh = new MeshPlane({ texture: d.texture, verticesX: 2, verticesY: Math.max(6, Math.min(32, Math.round(p.h / 28))) });
      mesh.position.set(p.x + d.x, p.y + d.y);
      this.softCorals.addChild(mesh);
      this.views.push({ p, mesh, rest: mesh.geometry.positions.slice(), baseY: -d.y });
    }
  }

  /** Bends each plant in the water: further over the higher up, with a slow sway and a small ripple running up it. */
  private swayPlants(t: number) {
    for (const { p, mesh, rest, baseY } of this.views) {
      const [amp, period] = SWAY[p.kind], lean = Math.sin(t / period + p.ph) * amp * p.h, pos = mesh.geometry.positions;
      for (let k = 0; k < pos.length; k += 2) {
        const s = Math.max(0, (baseY - rest[k + 1]) / p.h);
        pos[k] = rest[k] + lean * s * s + Math.sin(t / 800 + p.ph * 1.7 + s * 5) * 2.5 * s;
      }
      mesh.geometry.getBuffer('aPosition').update();
    }
  }

  // Cartoon style like the fish: branches stroked in ink, colour and a light rim; polyps and lobes with a shine.
  private paintPlant(g: Graphics, p: Soft) { SOFT[p.kind](g, { ...p, x: 0, y: 0 }, rng(p.seed)); }

  private drawAnemones(t: number) {
    const g = this.anemones.clear(), tips = this.anemoneTips.clear();
    for (const a of this.anemoneList) {
      const inkC = shade(a.col, -.75);
      for (let i = 0; i < a.n; i++) {
        const base = -Math.PI + (i + .5) * Math.PI / a.n, sw = Math.sin(t / 700 + i * .6) * .25;
        const ex = a.x + Math.cos(base + sw) * a.len, ey = a.y - 4 + Math.sin(base + sw) * a.len * 1.1;
        const tentacle = () => g.moveTo(a.x + Math.cos(base) * 8, a.y - 4).quadraticCurveTo(a.x + Math.cos(base) * a.len * .6, a.y - a.len * .5, ex, ey);
        tentacle().stroke({ width: 6.4, color: inkC, cap: 'round' });
        tentacle().stroke({ width: 3.8, color: shade(a.col, -.15), cap: 'round' });
        g.circle(ex, ey, 3.6).fill(a.col).stroke({ width: 1.4, color: inkC });
        g.circle(ex - 1, ey - 1.1, 1.1).fill({ color: 0xffffff, alpha: .85 });
        tips.circle(ex, ey, 6).fill({ color: a.col, alpha: .35 });
        tips.circle(ex, ey, 3).fill(a.col);
      }
      g.ellipse(a.x, a.y, 17, 9).fill(shade(a.col, -.45)).stroke({ width: 2, color: inkC });
      g.ellipse(a.x - 5, a.y - 3, 6, 2).fill({ color: shade(a.col, .2), alpha: .8 });
    }
  }
}
