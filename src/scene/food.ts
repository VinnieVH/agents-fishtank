import { Container, Sprite, Texture } from 'pixi.js';
import { paintTexture } from '../art/canvas';
import { rng, TAU } from '../util';

/** One food flake, as fish see it. */
export interface Flake { x: number; y: number; eaten: boolean; gone: boolean }
/** The flakes from one click. */
export type Pinch = Flake[];

const COLORS = ['#ff9a3c', '#e8632b', '#f4c542', '#9bc53d', '#c9773a'];
const MAX = 80;

/** Little toon flakes: irregular rounded chips with an ink outline and a shine dot. */
function paintFlakes(res: number): Texture[] {
  return COLORS.map((col, i) => paintTexture(14, 14, res, g => {
    const R = rng(91 + i * 13), n = 6, pts: [number, number][] = [];
    for (let k = 0; k < n; k++) { const a = k / n * TAU, r = 3.2 + R() * 2.2; pts.push([7 + Math.cos(a) * r, 7 + Math.sin(a) * r * .75]); }
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
    g.closePath();
    g.fillStyle = col; g.fill();
    g.strokeStyle = '#3b1d0c'; g.lineWidth = 1.1; g.lineJoin = 'round'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(5.6, 5.4, 1.4, .8, -.4, 0, TAU); g.fill();
  }));
}

function paintPop(res: number) {
  return paintTexture(24, 24, res, g => {
    g.strokeStyle = 'rgba(220,245,255,.9)'; g.lineWidth = 1.6;
    g.beginPath(); g.arc(12, 12, 9, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.8)';
    for (const [x, y] of [[12, 3], [20, 9], [5, 16]]) { g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill(); }
  });
}

interface Bit extends Flake { s: Sprite; vy: number; wob: number; spin: number; landed: number }
interface Pop { s: Sprite; age: number }

/** Fish food dropped where you click: it sinks with a little wobble and settles on the sand, then fades away. */
export class Food extends Container {
  private bits: Bit[] = [];
  private pops: Pop[] = [];
  private tex: Texture[];
  private popTex: Texture;

  constructor(res: number) {
    super();
    this.tex = paintFlakes(res);
    this.popTex = paintPop(res);
  }

  /** Drops a pinch of flakes around (x, y). */
  drop(x: number, y: number): Pinch {
    const pinch: Bit[] = [];
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = new Sprite(this.tex[Math.floor(Math.random() * this.tex.length)]);
      s.anchor.set(.5); s.scale.set(1 + Math.random() * .4); s.rotation = Math.random() * TAU;
      const b: Bit = { s, x: x + (Math.random() - .5) * 26, y: y + (Math.random() - .5) * 14, eaten: false, gone: false,
        vy: .15 + Math.random() * .2, wob: Math.random() * TAU, spin: (Math.random() - .5) * .04, landed: 0 };
      s.position.set(b.x, b.y);
      this.addChild(s); this.bits.push(b); pinch.push(b);
    }
    while (this.bits.length > MAX) this.remove(this.bits[0]);
    return pinch;
  }

  update(t: number, dt: number, floor: number) {
    for (const b of [...this.bits]) {
      if (b.eaten) { this.pop(b.x, b.y); this.remove(b); continue; }
      const rest = floor - 3 + Math.sin(b.wob * 3) * 3;
      if (b.y < rest) {
        b.wob += .03 * dt;
        b.y = Math.min(rest, b.y + b.vy * dt);
        b.x += Math.sin(b.wob) * .25 * dt;
        b.s.rotation += b.spin * dt;
      } else if (!b.landed) b.landed = t;
      else if (t - b.landed > 15000) {
        b.s.alpha -= .01 * dt;
        if (b.s.alpha <= 0) { this.remove(b); continue; }
      }
      b.s.position.set(b.x, b.y);
    }
    for (const p of [...this.pops]) {
      p.age += dt / 20;
      p.s.scale.set(.4 + p.age * .8); p.s.alpha = 1 - p.age;
      if (p.age >= 1) { p.s.destroy(); this.pops.splice(this.pops.indexOf(p), 1); }
    }
  }

  private pop(x: number, y: number) {
    const s = new Sprite(this.popTex); s.anchor.set(.5); s.position.set(x, y);
    this.addChild(s); this.pops.push({ s, age: 0 });
  }

  private remove(b: Bit) {
    b.gone = true; b.s.destroy();
    this.bits.splice(this.bits.indexOf(b), 1);
  }
}
