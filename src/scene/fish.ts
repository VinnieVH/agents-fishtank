import { Container, MeshRope, Point, Sprite, Text } from 'pixi.js';
import { paintFish, type FishLook, type FishTextures } from '../art/fishArt';
import { SPECIES, type Look } from '../species';
import { hash, rng, TAU } from '../util';
import type { State } from '../../shared/types';
import type { Flake, Pinch } from './food';

export type { State } from '../../shared/types';

const BODY = ['#ff7a3d', '#ffcf3d', '#ff4d8d', '#3dc8ff', '#9b5cff', '#3dffa0', '#ff5c5c', '#5c7cff'];
const SPEED: Record<State, number> = { working: 3.5, waiting: .9, idle: .3 };
const TURN_COOLDOWN_MS = 3000;
const LEASH = 90; // max px a subagent fish strays from its parent before turning back
const ROPE_POINTS = 14;
const LABEL_FONT = 'Segoe UI, system-ui, sans-serif';
const MARK_FONT = 'system-ui, sans-serif';

export interface Tank { right: number; bottom: number; night: number; t: number; deltaFrames: number }

/** A new fish: `near` is the parent a subagent fish starts next to. */
export interface FishOptions {
  key: string; sessionId: string; small: boolean; look: Look; tankWidth: number; bottom: number; resolution: number; near?: Fish;
}

const spotsFor = (sessionHash: number) => Array.from({ length: 6 }, (_, index) => {
  const random = rng(sessionHash + index * 97);
  return { x: random() * 1.5 - .85, y: random() * .6 - .35, rx: .12 + random() * .14, ry: .08 + random() * .1, rot: random() * 3 };
});

const makeLabel = (isSmall: boolean, neon: string) => new Text({ text: '', anchor: { x: .5, y: .8 }, style: {
  fontFamily: LABEL_FONT, fontSize: isSmall ? 10 : 11.5, fill: neon,
  dropShadow: { color: '#000000', alpha: .45, blur: 0, distance: 1.4, angle: Math.PI / 4 },
} });

const makeQuestion = (size: number) => new Text({ text: '?', anchor: { x: .5, y: .8 }, style: {
  fontFamily: MARK_FONT, fontWeight: 'bold', fontSize: size * .7, fill: '#ffc94d',
  dropShadow: { color: '#ffc94d', alpha: 1, blur: 12, distance: 0, angle: 0 },
} });

const makeSleepZ = (size: number) => new Text({ text: 'z', anchor: { x: .5, y: .8 }, style: {
  fontFamily: MARK_FONT, fontSize: size * .4, fill: 'rgba(210,235,255,0.65)' } });

/** A session (big) or subagent (small) fish. Looks derive from the session id, so subagents match their parent. */
export class Fish {
  key: string; sessionId: string;
  readonly small: boolean;
  label = '';
  x: number; y: number;
  direction: number; face: number; vy = 0; speed = .3;
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
  private fin: Sprite | null = null;
  private points: Point[] = [];
  private textures: FishTextures;
  private headX: number; private tailX: number; private baseY: number;

  readonly marks = new Container();
  private labelText: Text;
  private question: Text;
  private sleepZs: Text[];

  // key and sessionId change when the session carries on under a new id (see Session.was)
  constructor({ key, sessionId, small, look: { species, neon }, tankWidth, bottom, resolution, near }: FishOptions) {
    this.key = key; this.sessionId = sessionId; this.small = small;
    const keyHash = hash(key), sessionHash = hash(sessionId);
    this.look = {
      species, small, body: BODY[(sessionHash >>> 3) % BODY.length], neon,
      pattern: (sessionHash >>> 7) % 3, variant: (sessionHash >>> 11) % 12, spots: spotsFor(sessionHash),
    };
    this.size = (small ? 15 + keyHash % 6 : 40 + keyHash % 5) * SPECIES[species].size;
    this.x = near ? near.x + (Math.random() - .5) * 80 : 60 + Math.random() * (tankWidth - 120);
    this.y = near ? near.y + (Math.random() < .5 ? -1 : 1) * (30 + Math.random() * 30) : 80 + Math.random() * (bottom - 160);
    this.direction = this.face = Math.random() < .5 ? -1 : 1;
    this.targetY = this.y;

    // small fish get a higher texture resolution so their ink lines stay crisp
    this.textures = paintFish(this.look, this.size, small ? resolution * 1.5 : resolution);
    const { width, originX, originY, height } = this.textures;
    for (let index = 0; index < ROPE_POINTS; index++) this.points.push(new Point(-originX + index * width / (ROPE_POINTS - 1), 0));
    const [left, , right] = SPECIES[species].bounds;
    this.headX = right * this.size * .3; this.tailX = left * this.size;
    this.baseY = height / 2 - originY;
    this.halo = new MeshRope({ texture: this.textures.halo, points: this.points });
    this.rope = new MeshRope({ texture: this.textures.body, points: this.points });
    this.body.addChild(this.halo);
    if (this.textures.fin) { // a fin it swims with, behind the body
      const { texture, anchorX, anchorY, x, y } = this.textures.fin;
      this.fin = new Sprite(texture); this.fin.anchor.set(anchorX, anchorY); this.fin.position.set(x, y);
      this.body.addChild(this.fin);
    }
    this.body.addChild(this.rope);
    this.body.zIndex = this.size;

    this.labelText = makeLabel(small, this.look.neon);
    this.question = makeQuestion(this.size);
    this.sleepZs = [0, 1, 2].map(() => makeSleepZ(this.size));
    this.marks.addChild(this.labelText, this.question, ...this.sleepZs);
  }

  get neon() { return this.look.neon; }
  get species() { return this.look.species; }

  setLabel(text: string) { if (text !== this.label) this.labelText.text = this.label = text; }

  /** Whether (x, y) is on the fish, or on the question mark above it, with a few pixels to spare. */
  hit(x: number, y: number) {
    const traits = SPECIES[this.species], [left, top, right, bottom] = traits.bounds, size = this.size, pad = 6;
    const dx = (x - this.x) * Math.sign(this.face), dy = y - this.y;
    return dx >= left * size - pad && dx <= right * size + pad
      && dy >= Math.min(top, -traits.markY - .5) * size - pad && dy <= bottom * size + pad;
  }

  get mouthX() { return this.x + this.face * SPECIES[this.species].bounds[2] * this.size * .85; }

  /** The nearest flake of its meal that is still there (and forgets the meal once it's all gone). */
  private nextBite(): Flake | null {
    const left = this.meal?.filter(flake => !flake.eaten && !flake.gone) ?? [];
    if (!left.length) { this.meal = null; return null; }
    const mouthX = this.mouthX, distance = (flake: Flake) => Math.hypot(flake.x - mouthX, flake.y - this.y);
    return left.reduce((nearest, flake) => distance(nearest) <= distance(flake) ? nearest : flake);
  }

  /** Physics step (ported 1:1 from the canvas version), then pose the rope and the marks. */
  update(tank: Tank, state: State, parent: Fish | undefined) {
    const { t, deltaFrames } = tank, traits = SPECIES[this.species];
    const food = this.nextBite();
    const gap = food ? Math.hypot(food.x - this.mouthX, food.y - this.y) : 0;
    const leashX = parent && !food ? parent.x - this.x : 0;
    // hungry fish dart to the food and slow down to nibble
    const target = food ? Math.min(3.2, .7 + gap * .03) * traits.speed : this.cruiseSpeed(state, leashX);
    this.speed += (target - this.speed) * (food ? .08 : .03) * deltaFrames;
    this.phase += (.05 + this.speed * .13) * deltaFrames;
    this.x += this.direction * this.speed * deltaFrames;
    this.pickTargetY(tank, parent, food);
    this.swimVertically(tank, food);
    if (food) this.chase(food, gap, t);
    else this.turnAround(tank, parent, leashX);
    this.settle(tank, food);
    this.bendBody();
    this.shine(t, state, tank.night);
    this.updateMarks(t, state);
  }

  /** Subagents stay on a short leash and sprint to catch up when they fall behind. */
  private cruiseSpeed(state: State, leashX: number) {
    return SPEED[state] * SPECIES[this.species].speed * (this.small ? (Math.abs(leashX) > LEASH ? 1.7 : 1.2) : 1);
  }

  private pickTargetY(tank: Tank, parent: Fish | undefined, food: Flake | null) {
    if (food) { this.targetY = food.y; return; }
    if (parent) { this.followParentDepth(tank.deltaFrames, parent); return; }
    if (Math.random() < .01 * tank.deltaFrames) this.targetY = 70 + Math.random() * (tank.bottom - 120);
  }

  private followParentDepth(deltaFrames: number, parent: Fish) {
    if (Math.random() < .03 * deltaFrames || Math.abs(parent.y - this.targetY) > LEASH + parent.size) {
      const side = hash(this.key) & 1 ? 1 : -1;
      this.targetY = parent.y + side * ((parent.size + this.size) * SPECIES[this.species].half + 8 + Math.random() * 25);
    }
  }

  private swimVertically(tank: Tank, food: Flake | null) {
    const { t, deltaFrames, bottom } = tank;
    const floor = food ? bottom + 46 : bottom; // it may dip down to the sand for food
    this.targetY = Math.max(50, Math.min(floor - (food ? 0 : this.size), this.targetY));
    const agility = food ? 1.6 : Math.max(.35, Math.min(1.2, this.speed / 3));
    this.vy += ((this.targetY - this.y) * (food ? .006 : .0025) - this.vy * (food ? .09 : .06)) * deltaFrames * agility;
    const maxVy = Math.max(food ? 1.4 : .5, this.speed * .7);
    this.vy = Math.max(-maxVy, Math.min(maxVy, this.vy));
    this.y += (this.vy + Math.sin(t / 900 + this.bob) * .25) * deltaFrames;
  }

  private chase(food: Flake, gap: number, t: number) {
    const foodDx = food.x - this.x;
    if (Math.abs(foodDx) > this.size * .3 && Math.sign(foodDx) !== this.direction) this.turn(-this.direction, t);
    if (gap < Math.max(10, this.size * .45)) food.eaten = true;
  }

  private turnAround(tank: Tank, parent: Fish | undefined, leashX: number) {
    const { t, deltaFrames } = tank, wall = this.wallAhead(tank.right);
    if (wall) { this.turn(-wall, t); return; }
    if (parent && Math.abs(leashX) > LEASH && Math.sign(leashX) !== this.direction) { this.turn(-this.direction, t); return; }
    if (t - this.lastTurn > TURN_COOLDOWN_MS && Math.random() < .01 * deltaFrames) {
      this.turn(-this.direction, t);
      if (!this.small) this.targetY = 70 + Math.random() * (tank.bottom - 120);
    }
  }

  /** 1 when it is swimming into the right wall, -1 into the left one, else 0. */
  private wallAhead(right: number) {
    const margin = this.size * 1.5;
    if (this.x > right - margin && this.direction > 0) return 1;
    if (this.x < margin && this.direction < 0) return -1;
    return 0;
  }

  private turn(direction: number, t: number) { this.direction = direction; this.lastTurn = t; }

  private settle(tank: Tank, food: Flake | null) {
    const { deltaFrames, bottom } = tank;
    // after a meal on the sand, rise back gently
    this.y = Math.max(40, Math.min(food ? bottom + 46 : Math.max(bottom, this.y - deltaFrames), this.y));
    this.face += (this.direction - this.face) * .12 * deltaFrames;
    if (Math.abs(this.face) < .05) this.face = this.direction * .05;
  }

  /**
   * Tail beat: the bend grows towards the tail and travels down the body. Creatures that swim with a fin keep their
   * body straight and flutter the fin instead.
   */
  private bendBody() {
    const size = this.size, amplitude = SPECIES[this.species].stiff ? 0 : size * (.06 + Math.min(this.speed, 5) * .022);
    if (this.fin) this.fin.scale.x = .45 + .55 * Math.abs(Math.sin(this.phase * 2.5));
    for (const point of this.points) {
      const along = Math.max(0, Math.min(1, (this.headX - point.x) / (this.headX - this.tailX)));
      point.y = this.baseY + amplitude * along * along * Math.sin(this.phase + (1 - along) * .9);
    }
    this.body.position.set(this.x, this.y);
    this.body.scale.x = this.face;
    this.body.rotation = Math.max(-.35, Math.min(.35, this.vy * .09)) * Math.sign(this.face || 1);
  }

  private shine(t: number, state: State, night: number) {
    const glow = (state === 'working' ? 1 + Math.sin(t / 250 + this.phase) * .25 : state === 'waiting' ? .8 : .45) * (1 + .7 * night);
    this.halo.alpha = Math.min(1, .35 + .45 * glow);
    // darken towards the night water colour (2,8,26)
    const darkness = .45 * night, toNight = (channel: number) => Math.round(255 * (1 - darkness) + channel * darkness);
    this.rope.tint = night > .02 ? toNight(2) << 16 | toNight(8) << 8 | toNight(26) : 0xffffff;
  }

  private updateMarks(t: number, state: State) {
    const size = this.size, { labelY, markY } = SPECIES[this.species];
    this.labelText.visible = !!this.label;
    this.labelText.position.set(this.x, this.y + size * labelY);
    this.question.visible = !this.small && state === 'waiting';
    if (this.question.visible) this.question.position.set(this.x, this.y - size * markY + Math.sin(t / 300) * 4);
    const isSleeping = !this.small && state === 'idle' && !this.meal, shownZs = (t / 1200) % 3;
    this.sleepZs.forEach((letter, index) => {
      letter.visible = isSleeping && shownZs > index;
      letter.position.set(this.x + this.face * (size * .5 + index * 7), this.y - size * (markY - .3 + index * .25));
    });
  }

  destroy() {
    this.body.destroy({ children: true });
    this.marks.destroy({ children: true });
    this.textures.body.destroy(true); this.textures.halo.destroy(true); this.textures.fin?.texture.destroy(true);
  }
}
