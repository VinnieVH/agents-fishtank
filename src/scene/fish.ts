import { Container, MeshRope, Point, Text } from 'pixi.js';
import { paintFish, type FishLook, type FishTextures } from '../art/fishArt';
import { SPECIES, type Species } from '../species';
import { hash, rng, TAU } from '../util';
import type { Flake, Pinch } from './food';

export type State = 'working' | 'waiting' | 'idle';

const BODY = ['#ff7a3d', '#ffcf3d', '#ff4d8d', '#3dc8ff', '#9b5cff', '#3dffa0', '#ff5c5c', '#5c7cff'];
const NEON = ['#39ff14', '#00f0ff', '#ff00e6', '#fff200', '#ff6a00', '#b026ff', '#00ffb3', '#ff2e63'];
const SPEED: Record<State, number> = { working: 3.5, waiting: .9, idle: .3 };
const TURN_COOLDOWN_MS = 3000; // minimum time between direction changes
const LEASH = 90; // max px a subagent fish strays from its parent before turning back
const ROPE_POINTS = 14;

export interface Tank { right: number; bottom: number; night: number; t: number; dt: number }

/** A session (big) or subagent (small) fish. Looks derive from the session id, so subagents match their parent. */
export class Fish {
  label = '';
  x: number; y: number;
  dir: number; face: number; vy = 0; speed = .3;
  readonly size: number;
  readonly look: FishLook;
  phase = Math.random() * TAU;
  targetY: number;
  lastTurn = performance.now();
  bob = Math.random() * TAU;
  /** Food this fish was sent after; it eats the flakes one by one, then goes back to what it was doing. */
  meal: Pinch | null = null;

  readonly body = new Container();
  private rope: MeshRope;
  private halo: MeshRope;
  private points: Point[] = [];
  private tex: FishTextures;
  private headX: number; private tailX: number; private baseY: number;

  readonly marks = new Container();
  private labelText: Text;
  private question: Text;
  private zs: Text[];

  constructor(readonly key: string, readonly sessionId: string, readonly small: boolean, species: Species,
    W: number, bottom: number, res: number, near?: Fish) {
    const h = hash(key), hs = hash(sessionId);
    this.look = {
      species, small, body: BODY[(hs >>> 3) % BODY.length], neon: NEON[hs % NEON.length],
      pattern: (hs >>> 7) % 3, variant: (hs >>> 11) % 12,
      spots: Array.from({ length: 6 }, (_, i) => { const r = rng(hs + i * 97); return { x: r() * 1.5 - .85, y: r() * .6 - .35, rx: .12 + r() * .14, ry: .08 + r() * .1, rot: r() * 3 }; }),
    };
    this.size = (small ? 15 + h % 6 : 40 + h % 5) * SPECIES[species].size;
    this.x = near ? near.x + (Math.random() - .5) * 80 : 60 + Math.random() * (W - 120);
    this.y = near ? near.y + (Math.random() < .5 ? -1 : 1) * (30 + Math.random() * 30) : 80 + Math.random() * (bottom - 160);
    this.dir = this.face = Math.random() < .5 ? -1 : 1;
    this.targetY = this.y;

    // small fish get a higher texture resolution so their ink lines stay crisp
    this.tex = paintFish(this.look, this.size, small ? res * 1.5 : res);
    const { width, originX, originY, height } = this.tex;
    for (let i = 0; i < ROPE_POINTS; i++) this.points.push(new Point(-originX + i * width / (ROPE_POINTS - 1), 0));
    const [l, , r] = SPECIES[species].bounds;
    this.headX = r * this.size * .3; this.tailX = l * this.size;
    this.baseY = height / 2 - originY;
    this.halo = new MeshRope({ texture: this.tex.halo, points: this.points });
    this.rope = new MeshRope({ texture: this.tex.body, points: this.points });
    this.body.addChild(this.halo, this.rope);
    this.body.zIndex = this.size;

    const font = 'Segoe UI, system-ui, sans-serif';
    this.labelText = new Text({ text: '', anchor: { x: .5, y: .8 }, style: {
      fontFamily: font, fontSize: small ? 10 : 11.5, fill: this.look.neon,
      dropShadow: { color: '#000000', alpha: .45, blur: 0, distance: 1.4, angle: Math.PI / 4 },
    } });
    this.question = new Text({ text: '?', anchor: { x: .5, y: .8 }, style: {
      fontFamily: 'system-ui, sans-serif', fontWeight: 'bold', fontSize: this.size * .7, fill: '#ffc94d',
      dropShadow: { color: '#ffc94d', alpha: 1, blur: 12, distance: 0, angle: 0 },
    } });
    this.zs = [0, 1, 2].map(() => new Text({ text: 'z', anchor: { x: .5, y: .8 }, style: {
      fontFamily: 'system-ui, sans-serif', fontSize: this.size * .4, fill: 'rgba(210,235,255,0.65)' } }));
    this.marks.addChild(this.labelText, this.question, ...this.zs);
  }

  get neon() { return this.look.neon; }
  get species() { return this.look.species; }

  setLabel(text: string) { if (text !== this.label) this.labelText.text = this.label = text; }

  get mouthX() { return this.x + this.face * SPECIES[this.species].bounds[2] * this.size * .85; }

  /** The nearest flake of its meal that is still there (and forgets the meal once it's all gone). */
  private nextBite(): Flake | null {
    const left = this.meal?.filter(f => !f.eaten && !f.gone) ?? [];
    if (!left.length) { this.meal = null; return null; }
    const mx = this.mouthX, d = (f: Flake) => Math.hypot(f.x - mx, f.y - this.y);
    return left.reduce((a, b) => d(a) <= d(b) ? a : b);
  }

  /** Physics step (ported 1:1 from the canvas version), then pose the rope and the marks. */
  update(tank: Tank, state: State, parent: Fish | undefined) {
    const { t, dt, right, bottom, night } = tank, sp = SPECIES[this.species];
    const food = this.nextBite(), reach = Math.max(10, this.size * .45);
    const gap = food ? Math.hypot(food.x - this.mouthX, food.y - this.y) : 0;
    const dx = parent && !food ? parent.x - this.x : 0;
    // subagents stay on a short leash and sprint to catch up when they fall behind; hungry fish dart to the food and slow down to nibble
    const target = food ? Math.min(3.2, .7 + gap * .03) * sp.speed
      : SPEED[state] * sp.speed * (this.small ? (Math.abs(dx) > LEASH ? 1.7 : 1.2) : 1);
    this.speed += (target - this.speed) * (food ? .08 : .03) * dt;
    this.phase += (.05 + this.speed * .13) * dt;
    this.x += this.dir * this.speed * dt;
    if (food) this.targetY = food.y;
    else if (parent) {
      if (Math.random() < .03 * dt || Math.abs(parent.y - this.targetY) > LEASH + parent.size)
        this.targetY = parent.y + (hash(this.key) & 1 ? 1 : -1) * ((parent.size + this.size) * sp.half + 8 + Math.random() * 25);
    } else if (Math.random() < .01 * dt) this.targetY = 70 + Math.random() * (bottom - 120);
    const floor = food ? bottom + 46 : bottom; // it may dip down to the sand for food
    this.targetY = Math.max(50, Math.min(floor - (food ? 0 : this.size), this.targetY));
    const agility = food ? 1.6 : Math.max(.35, Math.min(1.2, this.speed / 3));
    this.vy += ((this.targetY - this.y) * (food ? .006 : .0025) - this.vy * (food ? .09 : .06)) * dt * agility;
    const maxVy = Math.max(food ? 1.4 : .5, this.speed * .7);
    this.vy = Math.max(-maxVy, Math.min(maxVy, this.vy));
    this.y += (this.vy + Math.sin(t / 900 + this.bob) * .25) * dt;
    const m = this.size * 1.5;
    if (food) {
      const fdx = food.x - this.x;
      if (Math.abs(fdx) > this.size * .3 && Math.sign(fdx) !== this.dir) { this.dir = -this.dir; this.lastTurn = t; }
      if (gap < reach) food.eaten = true;
    }
    else if (this.x > right - m && this.dir > 0) { this.dir = -1; this.lastTurn = t; }
    else if (this.x < m && this.dir < 0) { this.dir = 1; this.lastTurn = t; }
    else if (parent && Math.abs(dx) > LEASH && Math.sign(dx) !== this.dir) { this.dir = -this.dir; this.lastTurn = t; }
    else if (t - this.lastTurn > TURN_COOLDOWN_MS && Math.random() < .01 * dt) {
      this.dir = -this.dir; this.lastTurn = t;
      if (!this.small) this.targetY = 70 + Math.random() * (bottom - 120);
    }
    this.y = Math.max(40, Math.min(food ? floor : Math.max(bottom, this.y - dt), this.y)); // after a meal on the sand, rise back gently
    this.face += (this.dir - this.face) * .12 * dt;
    if (Math.abs(this.face) < .05) this.face = this.dir * .05;

    // tail beat: the bend grows towards the tail and travels down the body
    const s = this.size, amp = s * (.06 + Math.min(this.speed, 5) * .022);
    for (const p of this.points) {
      const u = Math.max(0, Math.min(1, (this.headX - p.x) / (this.headX - this.tailX)));
      p.y = this.baseY + amp * u * u * Math.sin(this.phase + (1 - u) * .9);
    }
    this.body.position.set(this.x, this.y);
    this.body.scale.x = this.face;
    this.body.rotation = Math.max(-.35, Math.min(.35, this.vy * .09)) * Math.sign(this.face || 1);

    const glow = (state === 'working' ? 1 + Math.sin(t / 250 + this.phase) * .25 : state === 'waiting' ? .8 : .45) * (1 + .7 * night);
    this.halo.alpha = Math.min(1, .35 + .45 * glow);
    // darken towards the night water colour (2,8,26)
    const k = .45 * night, ch = (c: number) => Math.round(255 * (1 - k) + c * k);
    this.rope.tint = night > .02 ? ch(2) << 16 | ch(8) << 8 | ch(26) : 0xffffff;

    this.updateMarks(t, state, sp.labelY, sp.markY);
  }

  private updateMarks(t: number, state: State, labelY: number, markY: number) {
    const s = this.size;
    this.labelText.visible = !!this.label;
    this.labelText.position.set(this.x, this.y + s * labelY);
    this.question.visible = !this.small && state === 'waiting';
    if (this.question.visible) this.question.position.set(this.x, this.y - s * markY + Math.sin(t / 300) * 4);
    const sleeping = !this.small && state === 'idle' && !this.meal, k = (t / 1200) % 3;
    this.zs.forEach((z, i) => {
      z.visible = sleeping && k > i;
      z.position.set(this.x + this.face * (s * .5 + i * 7), this.y - s * (markY - .3 + i * .25));
    });
  }

  destroy() {
    this.body.destroy({ children: true });
    this.marks.destroy({ children: true });
    this.tex.body.destroy(true); this.tex.halo.destroy(true);
  }
}
