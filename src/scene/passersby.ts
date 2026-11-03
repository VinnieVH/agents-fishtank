import { BlurFilter, type CanvasSource, Container, Sprite, Texture } from 'pixi.js';
import { canvasSource } from '../art/canvas';
import { paintDolphins } from '../art/dolphins';
import { paintJellyfish, paintJellyGlow } from '../art/jellyfish';
import { paintKraken, paintKrakenGlow } from '../art/kraken';
import { paintManta } from '../art/manta';
import { paintOrca } from '../art/orca';
import { paintShark } from '../art/shark';
import { paintSubmarine, paintSubmarineGlow } from '../art/submarine';
import { paintWhale } from '../art/whale';
import { pickVisitor } from '../visitors';

type Painter = (g: CanvasRenderingContext2D, length: number, phase: number) => void;

interface Kind {
  name: string;
  paint: Painter;
  glow?: Painter; // what shines at night, shown above the night overlay
  weight: number; // how often it comes compared with the others
  alpha: number; // solid, except the jellyfish, which are see-through anyway: the haze (HAZE) puts them far off
  length: (width: number) => number;
  box: { w: number; h: number; ox: number; oy: number }; // canvas size and body origin, as fractions of its length
  speed: number; beat: number; bob: number; bobPeriod: number; tilt: number;
  depth: [number, number]; // vertical range as fractions of the tank height
}

/** A canvas size and the point drawing starts from, which becomes the anchor. */
interface Frame { w: number; h: number; originX: number; originY: number }

/** What the visitors need each frame; main.ts keeps one and refills it, so a frame allocates nothing. */
export interface VisitorFrame { t: number; deltaFrames: number; width: number; height: number; night: number }

const KINDS: Kind[] = [
  { name: 'whale', paint: paintWhale, weight: 3, alpha: 1, length: width => Math.max(260, Math.min(460, width * .3)),
    box: { w: 1.2, h: .56, ox: .62, oy: .2 }, speed: .5, beat: .022, bob: 18, bobPeriod: 6000, tilt: .05, depth: [.14, .3] },
  { name: 'shark', paint: paintShark, weight: 3, alpha: 1, length: width => Math.max(200, Math.min(360, width * .22)),
    box: { w: 1.1, h: .5, ox: .54, oy: .27 }, speed: .8, beat: .06, bob: 8, bobPeriod: 4000, tilt: .025, depth: [.18, .36] },
  { name: 'orca', paint: paintOrca, weight: 2, alpha: 1, length: width => Math.max(240, Math.min(420, width * .27)),
    box: { w: 1.13, h: .6, ox: .61, oy: .4 }, speed: .7, beat: .05, bob: 10, bobPeriod: 5500, tilt: .03, depth: [.2, .36] },
  { name: 'manta', paint: paintManta, weight: 2.5, alpha: 1, length: width => Math.max(280, Math.min(500, width * .34)),
    box: { w: .92, h: .76, ox: .6, oy: .38 }, speed: .42, beat: .03, bob: 14, bobPeriod: 8000, tilt: .04, depth: [.22, .32] },
  { name: 'dolphins', paint: paintDolphins, weight: 2.5, alpha: 1, length: width => Math.max(280, Math.min(480, width * .34)),
    box: { w: 1.02, h: .5, ox: .51, oy: .3 }, speed: .95, beat: .08, bob: 6, bobPeriod: 5000, tilt: .02, depth: [.16, .3] },
  { name: 'jellyfish', paint: paintJellyfish, glow: paintJellyGlow, weight: 3, alpha: .75, length: width => Math.max(190, Math.min(320, width * .2)),
    box: { w: 1, h: .92, ox: .5, oy: .47 }, speed: .28, beat: .045, bob: 10, bobPeriod: 7000, tilt: .02, depth: [.16, .3] },
  // the rare one
  { name: 'submarine', paint: paintSubmarine, glow: paintSubmarineGlow, weight: .6, alpha: 1, length: width => Math.max(300, Math.min(540, width * .36)),
    box: { w: 1.16, h: .38, ox: .62, oy: .28 }, speed: .32, beat: .05, bob: 5, bobPeriod: 9000, tilt: .012, depth: [.2, .34] },
  // and the legend: about one visitor in 170, so you may wait days to see it
  { name: 'kraken', paint: paintKraken, glow: paintKrakenGlow, weight: .1, alpha: 1, length: width => Math.max(380, Math.min(640, width * .5)),
    box: { w: 1.48, h: .74, ox: .96, oy: .41 }, speed: .3, beat: .03, bob: 10, bobPeriod: 10000, tilt: .03, depth: [.3, .38] },
];

// Far off in the water things take on its colour and lose their contrast rather than turning see-through: the
// visitors are washed with the water's deep blue, so the scenery behind them doesn't show through.
const HAZE = 'rgba(8,60,100,.58)';

/** A sprite showing a canvas that is repainted every frame. */
class Painted extends Sprite {
  private canvas = document.createElement('canvas');
  private g = this.canvas.getContext('2d')!;
  private source: CanvasSource | null = null;

  constructor(private resolution: number) {
    super();
    this.visible = false;
  }

  /** Paints the frame's canvas, drawing from its origin. `haze` washes it into the water. */
  draw(frame: Frame, paint: (g: CanvasRenderingContext2D) => void, haze?: string) {
    const { canvas, g, resolution } = this, { w, h, originX, originY } = frame;
    if (canvas.width !== Math.ceil(w * resolution)) {
      canvas.width = Math.ceil(w * resolution); canvas.height = Math.ceil(h * resolution);
      this.source?.destroy();
      this.source = canvasSource(canvas, resolution);
      this.texture = new Texture({ source: this.source });
    }
    g.setTransform(resolution, 0, 0, resolution, 0, 0); g.clearRect(0, 0, w, h);
    g.save(); g.translate(originX, originY); paint(g); g.restore();
    if (haze) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = haze; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    }
    this.source!.update();
    this.anchor.set(originX / w, originY / h);
    this.visible = true;
  }
}

/** One visitor drifting by far in the background, hazed into the water, with its night glow if it has one. */
class Passerby {
  private length = 0; private direction = 1; private phase = 0; private startedAt = 0; private baseY = 0; private x = 0;
  private frame: Frame = { w: 0, h: 0, originX: 0, originY: 0 };
  readonly body: Painted;
  readonly glow: Painted | null;

  constructor(readonly kind: Kind, resolution: number) {
    this.body = new Painted(resolution);
    this.body.alpha = kind.alpha;
    this.body.filters = [new BlurFilter({ strength: 1.2, quality: 2 })];
    this.glow = kind.glow ? new Painted(resolution) : null;
    if (this.glow) {
      this.glow.blendMode = 'add';
      this.glow.filters = [new BlurFilter({ strength: 2, quality: 2 })];
    }
  }

  start(t: number, width: number, height: number) {
    const { kind } = this, { box } = kind;
    this.length = kind.length(width); this.direction = Math.random() < .5 ? 1 : -1;
    this.phase = 0; this.startedAt = t;
    this.frame = { w: this.length * box.w, h: this.length * box.h, originX: this.length * box.ox, originY: this.length * box.oy };
    this.x = this.direction > 0 ? -this.length * box.ox : width + this.length * box.ox;
    this.baseY = height * (kind.depth[0] + Math.random() * (kind.depth[1] - kind.depth[0]));
  }

  /** Returns false once it has left the screen. */
  update({ t, deltaFrames, width, night }: VisitorFrame) {
    const { length, direction, kind, body, glow, frame } = this, { glow: paintGlow } = kind;
    this.x += direction * kind.speed * deltaFrames; this.phase += kind.beat * deltaFrames;
    if (direction > 0 ? this.x > width + frame.originX : this.x < -frame.originX) {
      body.visible = false;
      if (glow) glow.visible = false;
      return false;
    }
    const bobPhase = (t - this.startedAt) / kind.bobPeriod;

    body.draw(frame, g => kind.paint(g, length, this.phase), HAZE);
    const shown = [body];
    if (glow && paintGlow && night > .05) {
      glow.draw(frame, g => paintGlow(g, length, this.phase));
      glow.alpha = night;
      shown.push(glow);
    } else if (glow) glow.visible = false;

    for (const sprite of shown) {
      sprite.position.set(this.x, this.baseY + Math.sin(bobPhase) * kind.bob);
      sprite.scale.x = direction;
      sprite.rotation = -Math.cos(bobPhase) * kind.tilt * direction;
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

  constructor(now: number, params: URLSearchParams, resolution: number) {
    super();
    this.all = KINDS.map(kind => new Passerby(kind, resolution));
    this.addChild(...this.all.map(passerby => passerby.body));
    this.glows.addChild(...this.all.flatMap(passerby => passerby.glow ?? []));
    this.summon = this.all.find(passerby => params.has(passerby.kind.name));
    this.next = now + (this.summon ? 500 : 25000 + Math.random() * 35000);
  }

  update(frame: VisitorFrame) {
    const t = frame.t;
    if (!this.active) {
      if (t < this.next || (!this.enabled && !this.summon)) return;
      this.active = this.summon ?? this.all[pickVisitor(KINDS.map(kind => kind.weight), this.last)];
      this.summon = undefined;
      this.active.start(t, frame.width, frame.height);
    }
    if (!this.active.update(frame)) {
      this.last = this.all.indexOf(this.active); this.active = null;
      this.next = t + 90000 + Math.random() * 120000;
    }
  }
}
