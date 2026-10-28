import { CanvasSource, Sprite, Texture } from 'pixi.js';
import { CRAB_BOX, paintCrab, type CrabPose } from '../art/crab';
import { nightTint } from '../util';

type Mode = 'away' | 'walk' | 'pause' | 'leave';
type Act = 'look' | 'snap' | 'dance';
const ACTS: Act[] = ['look', 'snap', 'dance'];

/**
 * A little red crab that comes out to stroll along the sand when every session is idle (or there are none),
 * and scurries off as soon as one starts working or waits for you. `?crab` in the URL keeps him out.
 */
export class Crab extends Sprite {
  private canvas = document.createElement('canvas');
  private g = this.canvas.getContext('2d')!;
  private source: CanvasSource | null = null;
  private mode: Mode = 'away'; private act: Act = 'look';
  private wx = 0; private dir = 1; private until = 0; private calmSince = -1; private next = 0; private sway = 0;
  private scaredAt = 0; private spooked = false;
  private pose: CrabPose = { step: 0, walking: 0, open: 0, armL: 0, armR: 0, look: 0, brows: 0, fright: 0 };
  /** Out on the sand even while sessions are busy (the crabAlways setting, or ?crab). */
  always = false;

  constructor(private res: number) {
    super();
    this.visible = false;
  }

  /** Something new swam into the tank: if he's out, he bolts. */
  scare() { this.spooked = true; }

  update(t: number, dt: number, W: number, H: number, calm: boolean, night = 0) {
    calm ||= this.always;
    if (!calm) this.calmSince = -1; else if (this.calmSince < 0) this.calmSince = t;
    const L = W < 760 ? 56 : 80, margin = L * .8;

    if (this.mode === 'away') {
      if (!calm || t - this.calmSince < (this.always ? 300 : 8000) || t < this.next) return;
      this.dir = Math.random() < .5 ? 1 : -1;
      this.wx = this.dir > 0 ? -margin : W + margin;
      this.walk(t);
    } else if ((!calm || this.spooked) && this.mode !== 'leave') {
      // startled: a jump on the spot, then a sprint off the nearest edge
      this.mode = 'leave'; this.scaredAt = t; this.dir = this.wx < W / 2 ? -1 : 1;
    }
    this.spooked = false;

    const startle = this.mode === 'leave' ? Math.min(1, (t - this.scaredAt) / 450) : 1;
    const speed = this.mode === 'leave' ? (startle < 1 ? 0 : 7) : this.mode === 'walk' ? 1 : 0;
    if (speed) this.wx += this.dir * speed * dt;
    if (this.mode === 'walk' && t > this.until && this.wx > margin * 2 && this.wx < W - margin * 2) {
      this.mode = 'pause'; this.until = t + 2500 + Math.random() * 3500;
      this.act = ACTS[Math.floor(Math.random() * ACTS.length)];
    } else if (this.mode === 'pause' && t > this.until) {
      if (Math.random() < .25) this.dir *= -1;
      this.walk(t);
    }
    if (this.mode !== 'pause' && (this.dir > 0 ? this.wx > W + margin : this.wx < -margin)) {
      this.mode = 'away'; this.visible = false;
      this.next = t + 15000 + Math.random() * 30000;
      return;
    }

    this.animate(t, dt, speed);
    this.render(L);
    this.visible = true;
    const hop = this.mode === 'leave' ? Math.sin(startle * Math.PI) * 16
      : this.mode === 'pause' && this.act === 'dance' ? Math.abs(Math.sin(t * .008)) * 3 : 0;
    this.position.set(this.wx, H - 14 - hop);
    this.rotation = this.sway;
    this.tint = nightTint(night); // he sits in front of the night overlay
  }

  private walk(t: number) { this.mode = 'walk'; this.until = t + 3000 + Math.random() * 5000; }

  private animate(t: number, dt: number, speed: number) {
    const p = this.pose, k = Math.min(1, .15 * dt), ease = (v: number, to: number) => v + (to - v) * k;
    const pausing = this.mode === 'pause', act = pausing ? this.act : null;
    p.step += speed * .2 * dt;
    p.walking = ease(p.walking, speed ? 1 : 0);
    let open = .2 + .1 * Math.sin(p.step), armL = Math.sin(p.step) * 2, armR = -armL,     look = this.dir * .7, brows = 0, sway = 0, fright = 0;
        if (this.mode === 'leave') { open = 1; armL = armR = 14 + Math.sin(t * .03) * 3; look = this.dir; brows = -1; fright = 1; }
    else if (act === 'look') { look = Math.sin(t * .0016) > 0 ? 1 : -1; armL = armR = 0; open = .15; brows = .3; }
    else if (act === 'snap') { open = Math.max(0, Math.sin(t * .014)); armL = armR = 6; look = 0; brows = .6; }
    else if (act === 'dance') {
      const b = Math.sin(t * .008);
      armL = 7 + b * 7; armR = 7 - b * 7; open = .5 + .5 * Math.sin(t * .016); look = b; brows = 1; sway = b * .1;
    }
    p.open = ease(p.open, open); p.armL = ease(p.armL, armL); p.armR = ease(p.armR, armR);
    p.look = ease(p.look, look); p.brows = ease(p.brows, brows); this.sway = ease(this.sway, sway);
    p.fright = fright ? Math.min(1, p.fright + .35 * dt) : ease(p.fright, 0); // the fright hits at once
  }

  private render(L: number) {
    const { canvas, g, res } = this, k = L / 100, cw = CRAB_BOX.w * k, ch = CRAB_BOX.h * k;
    if (canvas.width !== Math.ceil(cw * res)) {
      canvas.width = Math.ceil(cw * res); canvas.height = Math.ceil(ch * res);
      this.source?.destroy();
      this.source = new CanvasSource({ resource: canvas, resolution: res });
      this.texture = new Texture({ source: this.source });
      this.anchor.set(CRAB_BOX.ox / CRAB_BOX.w, CRAB_BOX.oy / CRAB_BOX.h);
    }
    g.setTransform(res, 0, 0, res, 0, 0); g.clearRect(0, 0, cw, ch);
    g.save(); g.translate(CRAB_BOX.ox * k, CRAB_BOX.oy * k); paintCrab(g, L, this.pose); g.restore();
    this.source!.update();
  }
}
