import { BlurFilter, CanvasSource, Container, Sprite, Texture } from 'pixi.js';
import { paintWhale } from '../art/whale';

interface Kind {
  name: string;
  paint: (g: CanvasRenderingContext2D, L: number, ph: number) => void;
  length: (W: number) => number;
  box: { w: number; h: number; ox: number; oy: number }; // canvas size and body origin, as fractions of L
  speed: number; beat: number; bob: number; bobPeriod: number; tilt: number;
  depth: [number, number]; // vertical range as fractions of H
}

const KINDS: Kind[] = [
  { name: 'whale', paint: paintWhale, length: W => Math.max(260, Math.min(460, W * .3)),
    box: { w: 1.2, h: .56, ox: .62, oy: .2 }, speed: .5, beat: .022, bob: 18, bobPeriod: 6000, tilt: .05, depth: [.14, .3] },
];

/** One big animal drifting by far in the background, hazed into the water. */
class Passerby extends Sprite {
  private L = 0; private dir = 1; private ph = 0; private t0 = 0; private y0 = 0; private wx = 0;
  private canvas = document.createElement('canvas');
  private g = this.canvas.getContext('2d')!;
  private source: CanvasSource | null = null;

  constructor(readonly kind: Kind, private res: number) {
    super();
    this.alpha = .45;
    this.filters = [new BlurFilter({ strength: 1.2, quality: 2 })];
    this.visible = false;
  }

  start(t: number, W: number, H: number) {
    const { kind } = this;
    this.L = kind.length(W); this.dir = Math.random() < .5 ? 1 : -1;
    this.ph = 0; this.t0 = t;
    this.wx = this.dir > 0 ? -this.L * kind.box.ox : W + this.L * kind.box.ox;
    this.y0 = H * (kind.depth[0] + Math.random() * (kind.depth[1] - kind.depth[0]));
  }

  /** Returns false once it has left the screen. */
  update(t: number, dt: number, W: number) {
    const { L, dir, kind } = this, { box } = kind;
    this.wx += dir * kind.speed * dt; this.ph += kind.beat * dt;
    if (dir > 0 ? this.wx > W + L * box.ox : this.wx < -L * box.ox) { this.visible = false; return false; }
    const k = (t - this.t0) / kind.bobPeriod;

    const cw = L * box.w, ch = L * box.h, ox = L * box.ox, oy = L * box.oy, { canvas, g, res } = this;
    if (canvas.width !== Math.ceil(cw * res)) {
      canvas.width = Math.ceil(cw * res); canvas.height = Math.ceil(ch * res);
      this.source?.destroy();
      this.source = new CanvasSource({ resource: canvas, resolution: res });
      this.texture = new Texture({ source: this.source });
    }
    g.setTransform(res, 0, 0, res, 0, 0); g.clearRect(0, 0, cw, ch);
    g.save(); g.translate(ox, oy); kind.paint(g, L, this.ph); g.restore();
    g.globalCompositeOperation = 'source-atop'; // haze it into the water
    g.fillStyle = 'rgba(25,75,120,.35)'; g.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = 'source-over';
    this.source!.update();

    this.visible = true;
    this.anchor.set(ox / cw, oy / ch);
    this.position.set(this.wx, this.y0 + Math.sin(k) * kind.bob);
    this.scale.x = dir;
    this.rotation = -Math.cos(k) * kind.tilt * dir;
    return true;
  }
}

/**
 * Sends a whale past now and then. `?whale` in the URL summons it right away.
 */
export class Passersby extends Container {
  private all: Passerby[];
  private active: Passerby | null = null;
  private next: number;
  private summon: Passerby | undefined;

  constructor(now: number, params: URLSearchParams, res: number) {
    super();
    this.all = KINDS.map(k => new Passerby(k, res));
    this.addChild(...this.all);
    this.summon = this.all.find(p => params.has(p.kind.name));
    this.next = now + (this.summon ? 500 : 25000 + Math.random() * 35000);
  }

  update(t: number, dt: number, W: number, H: number) {
    if (!this.active) {
      if (t < this.next) return;
      this.active = this.summon ?? this.all[Math.floor(Math.random() * this.all.length)];
      this.summon = undefined;
      this.active.start(t, W, H);
    }
    if (!this.active.update(t, dt, W)) {
      this.active = null;
      this.next = t + 90000 + Math.random() * 120000;
    }
  }
}
