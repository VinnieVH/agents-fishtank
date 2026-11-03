import { type CanvasSource, Sprite, Texture } from 'pixi.js';
import { canvasSource } from '../art/canvas';
import { CRAB_BOX, paintCrab, type CrabPose } from '../art/crab';
import { nightTint } from '../util';

type Mode = 'away' | 'walk' | 'pause' | 'leave';
type Act = 'look' | 'snap' | 'dance';
const ACTS: Act[] = ['look', 'snap', 'dance'];
const SPEEDS: Record<Mode, number> = { away: 0, walk: 1, pause: 0, leave: 7 };

/** What the crab needs each frame; main.ts keeps one and refills it, so a frame allocates nothing. */
export interface CrabFrame { t: number; deltaFrames: number; width: number; height: number; calm: boolean; night: number }

type PoseAim = Pick<CrabPose, 'open' | 'leftArm' | 'rightArm' | 'look' | 'brows' | 'fright'> & { sway: number };

const ACT_AIMS: Record<Act, (aim: PoseAim, t: number) => void> = {
  look: (aim, t) => { aim.look = Math.sin(t * .0016) > 0 ? 1 : -1; aim.leftArm = aim.rightArm = 0; aim.open = .15; aim.brows = .3; },
  snap: (aim, t) => { aim.open = Math.max(0, Math.sin(t * .014)); aim.leftArm = aim.rightArm = 6; aim.look = 0; aim.brows = .6; },
  dance: (aim, t) => {
    const beat = Math.sin(t * .008);
    aim.leftArm = 7 + beat * 7; aim.rightArm = 7 - beat * 7; aim.open = .5 + .5 * Math.sin(t * .016); aim.look = beat; aim.brows = 1;
    aim.sway = beat * .1;
  },
};

/**
 * A little red crab that comes out to stroll along the sand when every session is idle (or there are none),
 * and scurries off as soon as one starts working or waits for you. `?crab` in the URL keeps him out.
 */
export class Crab extends Sprite {
  private canvas = document.createElement('canvas');
  private g = this.canvas.getContext('2d')!;
  private source: CanvasSource | null = null;
  private mode: Mode = 'away'; private act: Act = 'look';
  private sandX = 0; private direction = 1; private until = 0; private calmSince = -1; private nextVisit = 0; private sway = 0;
  private scaredAt = 0; private isSpooked = false;
  private pose: CrabPose = { step: 0, walking: 0, open: 0, leftArm: 0, rightArm: 0, look: 0, brows: 0, fright: 0 };
  private aim: PoseAim = { open: 0, leftArm: 0, rightArm: 0, look: 0, brows: 0, fright: 0, sway: 0 };
  /** Out on the sand even while sessions are busy (the crabAlways setting, or ?crab). */
  always = false;

  constructor(private resolution: number) {
    super();
    this.visible = false;
  }

  /** Something new swam into the tank: if he's out, he bolts. */
  scare() { this.isSpooked = true; }

  update({ t, deltaFrames, width, height, calm, night }: CrabFrame) {
    const isCalm = calm || this.always;
    this.trackCalm(t, isCalm);
    const length = width < 760 ? 56 : 80, margin = length * .8;

    if (this.mode === 'away') {
      if (!isCalm || !this.comeOut(t, width, margin)) return;
    } else this.startleIfNeeded(t, width, isCalm);
    this.isSpooked = false;

    const startle = this.startleProgress(t);
    const speed = this.speedFor(startle);
    if (speed) this.sandX += this.direction * speed * deltaFrames;
    this.wander(t, width, margin);
    if (this.hasWalkedOff(width, margin)) { this.goAway(t); return; }

    this.animate(t, deltaFrames, speed);
    this.render(length);
    this.visible = true;
    this.position.set(this.sandX, height - 14 - this.hop(t, startle));
    this.rotation = this.sway;
    this.tint = nightTint(night); // he sits in front of the night overlay
  }

  private trackCalm(t: number, isCalm: boolean) {
    if (!isCalm) this.calmSince = -1;
    else if (this.calmSince < 0) this.calmSince = t;
  }

  /** Returns whether he came out onto the sand. */
  private comeOut(t: number, width: number, margin: number) {
    if (t - this.calmSince < (this.always ? 300 : 8000) || t < this.nextVisit) return false;
    this.direction = Math.random() < .5 ? 1 : -1;
    this.sandX = this.direction > 0 ? -margin : width + margin;
    this.walk(t);
    return true;
  }

  /** Startled: a jump on the spot, then a sprint off the nearest edge. */
  private startleIfNeeded(t: number, width: number, isCalm: boolean) {
    if ((isCalm && !this.isSpooked) || this.mode === 'leave') return;
    this.mode = 'leave'; this.scaredAt = t; this.direction = this.sandX < width / 2 ? -1 : 1;
  }

  private startleProgress(t: number) {
    return this.mode === 'leave' ? Math.min(1, (t - this.scaredAt) / 450) : 1;
  }

  /** Stands still while jumping with fright, then sprints. */
  private speedFor(startle: number) {
    return this.mode === 'leave' && startle < 1 ? 0 : SPEEDS[this.mode];
  }

  private wander(t: number, width: number, margin: number) {
    if (this.mode === 'walk' && t > this.until && this.sandX > margin * 2 && this.sandX < width - margin * 2) {
      this.mode = 'pause'; this.until = t + 2500 + Math.random() * 3500;
      this.act = ACTS[Math.floor(Math.random() * ACTS.length)];
    } else if (this.mode === 'pause' && t > this.until) {
      if (Math.random() < .25) this.direction *= -1;
      this.walk(t);
    }
  }

  private hasWalkedOff(width: number, margin: number) {
    if (this.mode === 'pause') return false;
    return this.direction > 0 ? this.sandX > width + margin : this.sandX < -margin;
  }

  private goAway(t: number) {
    this.mode = 'away'; this.visible = false;
    this.nextVisit = t + 15000 + Math.random() * 30000;
  }

  private hop(t: number, startle: number) {
    if (this.mode === 'leave') return Math.sin(startle * Math.PI) * 16;
    return this.mode === 'pause' && this.act === 'dance' ? Math.abs(Math.sin(t * .008)) * 3 : 0;
  }

  private walk(t: number) { this.mode = 'walk'; this.until = t + 3000 + Math.random() * 5000; }

  private aimPose(t: number) {
    const { aim, pose } = this;
    aim.open = .2 + .1 * Math.sin(pose.step); aim.leftArm = Math.sin(pose.step) * 2; aim.rightArm = -aim.leftArm;
    aim.look = this.direction * .7; aim.brows = 0; aim.sway = 0; aim.fright = 0;
    if (this.mode === 'leave') {
      aim.open = 1; aim.leftArm = aim.rightArm = 14 + Math.sin(t * .03) * 3; aim.look = this.direction; aim.brows = -1; aim.fright = 1;
    } else if (this.mode === 'pause') ACT_AIMS[this.act](aim, t);
  }

  private animate(t: number, deltaFrames: number, speed: number) {
    const { aim, pose } = this, rate = Math.min(1, .15 * deltaFrames);
    const ease = (from: number, to: number) => from + (to - from) * rate;
    pose.step += speed * .2 * deltaFrames;
    pose.walking = ease(pose.walking, speed ? 1 : 0);
    this.aimPose(t);
    pose.open = ease(pose.open, aim.open); pose.leftArm = ease(pose.leftArm, aim.leftArm); pose.rightArm = ease(pose.rightArm, aim.rightArm);
    pose.look = ease(pose.look, aim.look); pose.brows = ease(pose.brows, aim.brows); this.sway = ease(this.sway, aim.sway);
    pose.fright = aim.fright ? Math.min(1, pose.fright + .35 * deltaFrames) : ease(pose.fright, 0); // the fright hits at once
  }

  private render(length: number) {
    const { canvas, g, resolution } = this, scale = length / 100;
    const canvasWidth = CRAB_BOX.w * scale, canvasHeight = CRAB_BOX.h * scale;
    if (canvas.width !== Math.ceil(canvasWidth * resolution)) {
      canvas.width = Math.ceil(canvasWidth * resolution); canvas.height = Math.ceil(canvasHeight * resolution);
      this.source?.destroy();
      this.source = canvasSource(canvas, resolution);
      this.texture = new Texture({ source: this.source });
      this.anchor.set(CRAB_BOX.originX / CRAB_BOX.w, CRAB_BOX.originY / CRAB_BOX.h);
    }
    g.setTransform(resolution, 0, 0, resolution, 0, 0); g.clearRect(0, 0, canvasWidth, canvasHeight);
    g.save(); g.translate(CRAB_BOX.originX * scale, CRAB_BOX.originY * scale); paintCrab(g, length, this.pose); g.restore();
    this.source!.update();
  }
}
