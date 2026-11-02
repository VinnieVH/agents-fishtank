import { BlurFilter, CanvasSource, Container, Sprite, Texture } from 'pixi.js';
import { paintDolphins } from '../art/dolphins';
import { paintJellyfish, paintJellyGlow } from '../art/jellyfish';
import { paintKraken, paintKrakenGlow } from '../art/kraken';
import { paintManta } from '../art/manta';
import { paintOrca } from '../art/orca';
import { paintShark } from '../art/shark';
import { paintSubmarine, paintSubmarineGlow } from '../art/submarine';
import { paintWhale } from '../art/whale';
import { pickVisitor } from '../visitors';

type Painter = (g: CanvasRenderingContext2D, L: number, ph: number) => void;

interface Kind {
  name: string;
  paint: Painter;
  glow?: Painter; // what shines at night, shown above the night overlay
  weight: number; // how often it comes compared with the others
  alpha: number;
  length: (W: number) => number;
  box: { w: number; h: number; ox: number; oy: number }; // canvas size and body origin, as fractions of L
  speed: number; beat: number; bob: number; bobPeriod: number; tilt: number;
  depth: [number, number]; // vertical range as fractions of H
}

const KINDS: Kind[] = [
  { name: 'whale', paint: paintWhale, weight: 3, alpha: .45, length: W => Math.max(260, Math.min(460, W * .3)),
    box: { w: 1.2, h: .56, ox: .62, oy: .2 }, speed: .5, beat: .022, bob: 18, bobPeriod: 6000, tilt: .05, depth: [.14, .3] },
  { name: 'shark', paint: paintShark, weight: 3, alpha: .45, length: W => Math.max(200, Math.min(360, W * .22)),
    box: { w: 1.1, h: .5, ox: .54, oy: .27 }, speed: .8, beat: .06, bob: 8, bobPeriod: 4000, tilt: .025, depth: [.18, .36] },
  { name: 'orca', paint: paintOrca, weight: 2, alpha: .45, length: W => Math.max(240, Math.min(420, W * .27)),
    box: { w: 1.13, h: .6, ox: .61, oy: .4 }, speed: .7, beat: .05, bob: 10, bobPeriod: 5500, tilt: .03, depth: [.2, .36] },
  { name: 'manta', paint: paintManta, weight: 2.5, alpha: .45, length: W => Math.max(280, Math.min(500, W * .34)),
    box: { w: .92, h: .76, ox: .6, oy: .38 }, speed: .42, beat: .03, bob: 14, bobPeriod: 8000, tilt: .04, depth: [.22, .32] },
  { name: 'dolphins', paint: paintDolphins, weight: 2.5, alpha: .45, length: W => Math.max(280, Math.min(480, W * .34)),
    box: { w: 1.02, h: .5, ox: .51, oy: .3 }, speed: .95, beat: .08, bob: 6, bobPeriod: 5000, tilt: .02, depth: [.16, .3] },
  { name: 'jellyfish', paint: paintJellyfish, glow: paintJellyGlow, weight: 3, alpha: .6, length: W => Math.max(190, Math.min(320, W * .2)),
    box: { w: 1, h: .92, ox: .5, oy: .47 }, speed: .28, beat: .045, bob: 10, bobPeriod: 7000, tilt: .02, depth: [.16, .3] },
  // the rare one
  { name: 'submarine', paint: paintSubmarine, glow: paintSubmarineGlow, weight: .6, alpha: .45, length: W => Math.max(300, Math.min(540, W * .36)),
    box: { w: 1.16, h: .38, ox: .62, oy: .28 }, speed: .32, beat: .05, bob: 5, bobPeriod: 9000, tilt: .012, depth: [.2, .34] },
  // and the legend: about one visitor in 170, so you may wait days to see it
  { name: 'kraken', paint: paintKraken, glow: paintKrakenGlow, weight: .1, alpha: .5, length: W => Math.max(380, Math.min(640, W * .5)),
    box: { w: 1.48, h: .74, ox: .96, oy: .41 }, speed: .3, beat: .03, bob: 10, bobPeriod: 10000, tilt: .03, depth: [.3, .38] },
];

/** A sprite showing a canvas that is repainted every frame. */
class Painted extends Sprite {
  private canvas = document.createElement('canvas');
  private g = this.canvas.getContext('2d')!;
  private source: CanvasSource | null = null;

  constructor(private res: number) {
    super();
    this.visible = false;
  }

  /** Paints a cw × ch canvas, drawing from (ox, oy), which becomes the anchor. `haze` washes it into the water. */
  draw(cw: number, ch: number, ox: number, oy: number, paint: (g: CanvasRenderingContext2D) => void, haze?: string) {
    const { canvas, g, res } = this;
    if (canvas.width !== Math.ceil(cw * res)) {
      canvas.width = Math.ceil(cw * res); canvas.height = Math.ceil(ch * res);
      this.source?.destroy();
      this.source = new CanvasSource({ resource: canvas, resolution: res });
      this.texture = new Texture({ source: this.source });
    }
    g.setTransform(res, 0, 0, res, 0, 0); g.clearRect(0, 0, cw, ch);
    g.save(); g.translate(ox, oy); paint(g); g.restore();
    if (haze) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = haze; g.fillRect(0, 0, cw, ch);
      g.globalCompositeOperation = 'source-over';
    }
    this.source!.update();
    this.anchor.set(ox / cw, oy / ch);
    this.visible = true;
  }
}

/** One visitor drifting by far in the background, hazed into the water, with its night glow if it has one. */
class Passerby {
  private L = 0; private dir = 1; private ph = 0; private t0 = 0; private y0 = 0; private wx = 0;
  readonly body: Painted;
  readonly glow: Painted | null;

  constructor(readonly kind: Kind, res: number) {
    this.body = new Painted(res);
    this.body.alpha = kind.alpha;
    this.body.filters = [new BlurFilter({ strength: 1.2, quality: 2 })];
    this.glow = kind.glow ? new Painted(res) : null;
    if (this.glow) {
      this.glow.blendMode = 'add';
      this.glow.filters = [new BlurFilter({ strength: 2, quality: 2 })];
    }
  }

  start(t: number, W: number, H: number) {
    const { kind } = this;
    this.L = kind.length(W); this.dir = Math.random() < .5 ? 1 : -1;
    this.ph = 0; this.t0 = t;
    this.wx = this.dir > 0 ? -this.L * kind.box.ox : W + this.L * kind.box.ox;
    this.y0 = H * (kind.depth[0] + Math.random() * (kind.depth[1] - kind.depth[0]));
  }

  /** Returns false once it has left the screen. */
  update(t: number, dt: number, W: number, night: number) {
    const { L, dir, kind, body, glow } = this, { box } = kind;
    this.wx += dir * kind.speed * dt; this.ph += kind.beat * dt;
    if (dir > 0 ? this.wx > W + L * box.ox : this.wx < -L * box.ox) {
      body.visible = false;
      if (glow) glow.visible = false;
      return false;
    }
    const k = (t - this.t0) / kind.bobPeriod;

    const cw = L * box.w, ch = L * box.h, ox = L * box.ox, oy = L * box.oy;
    body.draw(cw, ch, ox, oy, g => kind.paint(g, L, this.ph), 'rgba(25,75,120,.35)');
    const shown = [body];
    if (glow && night > .05) {
      glow.draw(cw, ch, ox, oy, g => kind.glow!(g, L, this.ph));
      glow.alpha = night;
      shown.push(glow);
    } else if (glow) glow.visible = false;

    for (const s of shown) {
      s.position.set(this.wx, this.y0 + Math.sin(k) * kind.bob);
      s.scale.x = dir;
      s.rotation = -Math.cos(k) * kind.tilt * dir;
    }
    return true;
  }
}

/**
 * Sends a visitor past now and then, one at a time: a whale, a great white, an orca, a manta ray, a pod of dolphins, a
 * school of jellyfish, rarely an old Soviet submarine and very rarely the kraken. Its name in the URL (`?manta`, `?kraken` ...) summons that one
 * right away. With `enabled` off (the visitors setting) none come. Their night glow goes in `glows`, to sit above the night overlay.
 */
export class Passersby extends Container {
  readonly glows = new Container();
  private all: Passerby[];
  private active: Passerby | null = null;
  private last = -1;
  private next: number;
  private summon: Passerby | undefined;
  enabled = true;

  constructor(now: number, params: URLSearchParams, res: number) {
    super();
    this.all = KINDS.map(k => new Passerby(k, res));
    this.addChild(...this.all.map(p => p.body));
    this.glows.addChild(...this.all.flatMap(p => p.glow ?? []));
    this.summon = this.all.find(p => params.has(p.kind.name));
    this.next = now + (this.summon ? 500 : 25000 + Math.random() * 35000);
  }

  update(t: number, dt: number, W: number, H: number, night: number) {
    if (!this.active) {
      if (t < this.next || (!this.enabled && !this.summon)) return;
      this.active = this.summon ?? this.all[pickVisitor(KINDS.map(k => k.weight), this.last)];
      this.summon = undefined;
      this.active.start(t, W, H);
    }
    if (!this.active.update(t, dt, W, night)) {
      this.last = this.all.indexOf(this.active); this.active = null;
      this.next = t + 90000 + Math.random() * 120000;
    }
  }
}
