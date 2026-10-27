import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { sandY } from '../art/terrain';
import { paintTexture } from '../art/canvas';
import { rng, shade, TAU } from '../util';

interface Weed { x: number; y: number; h: number; w: number; col: string; ph: number }
interface Anemone { x: number; y: number; n: number; len: number; col: string }
interface Plankton { x: number; y: number; r: number; vx: number; vy: number; ph: number }
interface Bubble { x: number; y: number; r: number; v: number; ph: number; src: number }

function leaf(g: Graphics, cx: number, cy: number, rx: number, ry: number, rot: number) {
  const pts: number[] = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push(cx + x * c - y * s, cy + x * s + y * c);
  }
  g.poly(pts);
}

/** Everything that moves in the water: light rays, surface shimmer, weeds, anemones, bubbles, plankton. */
export class Water {
  readonly rays = new Container();
  readonly shimmer = new Graphics();
  readonly backWeeds = new Graphics();
  readonly frontWeeds = new Graphics();
  readonly anemones = new Graphics();
  readonly anemoneTips = new Graphics();
  readonly bubbles = new Graphics();
  readonly plankton = new Graphics();

  private W = 0; private H = 0;
  private weeds: Weed[] = [];
  private anemoneList: Anemone[] = [];
  private planktonList: Plankton[] = [];
  private bubbleList: Bubble[] = [];
  private rayTexture: Texture | null = null;

  constructor() {
    this.rays.blendMode = 'add';
    this.anemoneTips.blendMode = 'add';
  }

  build(W: number, H: number) {
    this.W = W; this.H = H;
    const R = rng(99), sy = sandY(H);
    this.weeds = [];
    for (const p of [.03, .05, .14, .27, .29, .45, .63, .66, .74, .9, .93, .97]) {
      const n = 2 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) this.weeds.push({ x: W * p + (R() - .5) * 26, y: sy + 6 + R() * 10, h: 90 + R() * 170, w: 5 + R() * 4,
        col: ['#1f9a52', '#2bb565', '#17803f', '#3ccf74'][Math.floor(R() * 4)], ph: R() * TAU });
    }
    this.anemoneList = [W * .12, W * .52, W * .83].map((x, i) => ({ x, y: sy + 10, n: 16, len: 26 + i * 4, col: ['#ff5edb', '#5ef2ff', '#ffe95e'][i] }));
    this.planktonList = Array.from({ length: 70 }, () => ({ x: R() * W, y: R() * H, r: .6 + R() * 1.4, vx: (R() - .5) * .15, vy: (R() - .5) * .1, ph: R() * TAU }));
    this.bubbleList = Array.from({ length: 30 }, () => ({ x: 0, y: H + R() * H, r: 1.5 + R() * 3.5, v: .4 + R() * .9, ph: R() * TAU, src: R() }));
    for (const b of this.bubbleList) b.x = this.bubbleSource(b.src);

    // one light-ray texture (a slanted trapezoid fading downwards), reused by six sprites
    const rh = H * .85;
    this.rayTexture?.destroy(true);
    this.rayTexture = paintTexture(260, rh, 1, g => {
      const lg = g.createLinearGradient(0, 0, 0, rh);
      lg.addColorStop(0, 'rgb(180,235,255)'); lg.addColorStop(1, 'rgba(180,235,255,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(0, 0); g.lineTo(70, 0); g.lineTo(260, rh); g.lineTo(120, rh); g.fill();
    });
    this.rays.removeChildren().forEach(c => c.destroy());
    for (let i = 0; i < 6; i++) this.rays.addChild(new Sprite(this.rayTexture));
  }

  update(t: number, dt: number, busy: boolean, day: number, night: number) {
    const { W, H } = this;

    this.rays.children.forEach((r, i) => {
      r.x = i * W / 6 + Math.sin(t / 5000 + i * 1.7) * 70;
      r.alpha = (.035 + Math.sin(t / 2300 + i) * .015) * (.15 + .85 * day);
    });

    const sh = this.shimmer.clear();
    for (let r = 0; r < 3; r++) {
      sh.moveTo(0, 6 + r * 7 + Math.sin(t / (600 + r * 200)) * 3);
      for (let x = 16; x <= W + 16; x += 16) sh.lineTo(x, 6 + r * 7 + Math.sin(x / 40 + t / (600 + r * 200)) * 3);
      sh.stroke({ width: 2, color: 0xc8f0ff, alpha: .12 });
    }

    this.drawWeeds(this.backWeeds, t, 0);
    this.drawWeeds(this.frontWeeds, t, 1);
    this.frontWeeds.tint = night > .02 ? shade('#ffffff', -.66 * night) : 0xffffff; // front weeds sit above the night overlay

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

  /** Bubbles rise from the treasure chest and from under the stone arch. */
  private bubbleSource(src: number) {
    return src < .6 ? this.W * .2 + 20 + Math.random() * 10 : this.W * .58 + (Math.random() - .5) * 20;
  }

  // Cartoon style like the fish: every stem is stroked three times (ink, colour, light rim) and leaves get an ink outline.
  private drawWeeds(g: Graphics, t: number, start: number) {
    g.clear();
    for (let i = start; i < this.weeds.length; i += 2) {
      const w = this.weeds[i], segs = 12, step = w.h / segs, inkC = shade(w.col, -.72);
      const pts: [number, number][] = [[w.x, w.y]];
      for (let k = 1; k <= segs; k++) pts.push([w.x + Math.sin(t / 1100 + w.ph + k * .35) * k * k * .22, w.y - k * step]);
      const stem = (dx: number) => {
        g.moveTo(pts[0][0] + dx, pts[0][1]);
        for (let k = 1; k < pts.length - 1; k++) g.quadraticCurveTo(pts[k][0] + dx, pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2 + dx, (pts[k][1] + pts[k + 1][1]) / 2);
      };
      stem(0); g.stroke({ width: w.w + 3.2, color: inkC, cap: 'round', join: 'round' });
      for (let k = 2; k < pts.length - 1; k += 2) {
        const [px, py] = pts[k], side = k % 4 ? 1 : -1, rot = side * -.5 + Math.sin(t / 900 + k) * .2;
        leaf(g, px + side * 9, py, 11, 4.2, rot);
        g.fill(w.col).stroke({ width: 1.6, color: inkC, join: 'round' });
        leaf(g, px + side * 9 - Math.cos(rot) * 2, py - 1.4 - Math.sin(rot) * 2, 5, 1.2, rot);
        g.fill({ color: shade(w.col, .45), alpha: .8 });
      }
      stem(0); g.stroke({ width: w.w, color: w.col, cap: 'round', join: 'round' });
      stem(-w.w * .22); g.stroke({ width: w.w * .3, color: shade(w.col, .45), cap: 'round', join: 'round' });
    }
  }

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
