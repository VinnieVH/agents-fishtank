import { Container, Graphics, MeshPlane, Sprite, type Renderer, type Texture } from 'pixi.js';
import { currentAt, sandLineFor } from '../art/terrain';
import { paintTexture } from '../art/canvas';
import { FOREGROUND_ART } from '../art/foreground';
import { DEFAULT_FOREGROUND, type ForegroundId } from '../foregrounds';
import { rng, shade, TAU } from '../util';
import { drawPlant, plantsFrom, SWAY, type Soft } from './softPlants';

type Point = [number, number];
interface Anemone { x: number; y: number; tentacles: number; length: number; color: string }
interface Plankton { x: number; y: number; radius: number; vx: number; vy: number; phase: number }
interface Bubble { x: number; y: number; radius: number; speed: number; phase: number; source: number }
/** A streak flowing along the current: `along` it from 0 to 1, `offset` across it from -1 to 1. */
interface Streak { along: number; offset: number; length: number }
interface TankSize { width: number; height: number }
/** What the water needs each frame (`t` on the scenery's own clock); main.ts keeps one and refills it, so a frame allocates nothing. */
export interface WaterFrame { t: number; deltaFrames: number; isBusy: boolean; day: number; night: number }
const BAND_STEPS = 60;

/** A point across the current `along` it, `offset` from -1 (one edge) to 1 (the other). */
const acrossCurrent = (along: number, offset: number, { width, height }: TankSize): Point => {
  const here = currentAt(along, width, height), ahead = currentAt(Math.min(1, along + .01), width, height);
  const length = Math.hypot(ahead.x - here.x, ahead.y - here.y) || 1;
  return [here.x - (ahead.y - here.y) / length * offset * here.w / 2, here.y + (ahead.x - here.x) / length * offset * here.w / 2];
};

const wrapAround = (value: number, size: number) => {
  if (value < 0) return size;
  return value > size ? 0 : value;
};

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
  private flow: Streak[] = [];

  private size: TankSize = { width: 0, height: 0 };
  private plants: Soft[] = [];
  /**
   * Each soft coral is drawn once into a texture, and sways by bending that texture on a mesh: redrawing hundreds of
   * outlined branches every frame would be far too slow. The textures are kept per coral (for this tank height), so a
   * resize only draws the ones that are new.
   */
  private views: { plant: Soft; mesh: MeshPlane; rest: Float32Array; baseY: number }[] = [];
  private drawn = new Map<number, { texture: Texture; x: number; y: number }>();
  private drawnFor = '';
  private anemoneList: Anemone[] = [];
  /** Hides the anemones on the sand: a season brings its own things. */
  anemonesHidden = false;
  /** The foreground the plants (and the anemones) belong to; set before build. */
  foreground: ForegroundId = DEFAULT_FOREGROUND;
  private planktonList: Plankton[] = [];
  private bubbleList: Bubble[] = [];
  private raySprites: Sprite[] = [];
  private rayTexture: Texture | null = null;

  constructor() {
    this.current.addChild(this.band, this.streaks);
    this.current.blendMode = 'add';
    this.rays.blendMode = 'add';
    this.anemoneTips.blendMode = 'add';
  }

  build(width: number, height: number, renderer: Renderer) {
    const scaleX = width / (this.size.width || width), scaleY = height / (this.size.height || height);
    this.size.width = width; this.size.height = height;
    const random = rng(99), sandTop = sandLineFor(height);
    // the soft corals growing from the reefs at the back, behind their rock and hard corals (main.ts puts the floor in
    // front of them), the taller ones further back
    this.plants = plantsFrom(FOREGROUND_ART[this.foreground].swayers(width, height));
    this.showPlants(renderer, height);
    this.paintBand();
    if (!this.flow.length) this.flow = Array.from({ length: 120 }, () => ({ along: random(), offset: (random() - .5) * 1.5, length: .02 + random() * .03 }));
    this.anemoneList = [width * .12, width * .52, width * .83]
      .map((x, index) => ({ x, y: sandTop + 10, tentacles: 16, length: 26 + index * 4, color: ['#ff5edb', '#5ef2ff', '#ffe95e'][index] }));
    // plankton and bubbles keep drifting where they are when the tank is resized
    this.placePlankton(random, scaleX, scaleY);
    this.placeBubbles(random, scaleX, scaleY);
    this.paintRays(height);
  }

  update({ t, deltaFrames, isBusy, day, night }: WaterFrame) {
    this.moveRays(t, day);
    this.drawStreaks(deltaFrames);
    this.drawShimmer(t);
    this.swayPlants(t);
    this.drawAnemones(t);
    this.anemoneTips.alpha = night;
    this.anemoneTips.visible = night > .05;
    this.drawBubbles(deltaFrames, isBusy);
    this.drawPlankton(t, deltaFrames, night);
  }

  /** The current's band, fading out as it goes away: three bands inside each other give it soft edges. */
  private paintBand() {
    const band = this.band.clear();
    for (const spread of [1, .65, .35]) for (let step = 0; step < BAND_STEPS; step++) {
      const from = step / BAND_STEPS, to = (step + 1) / BAND_STEPS;
      band.poly([...acrossCurrent(from, -spread, this.size), ...acrossCurrent(to, -spread, this.size), ...acrossCurrent(to, spread, this.size), ...acrossCurrent(from, spread, this.size)])
        .fill({ color: 0x8fdcff, alpha: .05 * (1 - .7 * from) * Math.min(1, from * 10, (1 - from) * 8) });
    }
  }

  private placePlankton(random: () => number, scaleX: number, scaleY: number) {
    if (!this.planktonList.length) {
      this.planktonList = Array.from({ length: 70 }, () => ({ x: random() * this.size.width, y: random() * this.size.height, radius: .6 + random() * 1.4,
        vx: (random() - .5) * .15, vy: (random() - .5) * .1, phase: random() * TAU }));
      return;
    }
    for (const mote of this.planktonList) { mote.x *= scaleX; mote.y *= scaleY; }
  }

  private placeBubbles(random: () => number, scaleX: number, scaleY: number) {
    if (!this.bubbleList.length) {
      this.bubbleList = Array.from({ length: 30 }, () => ({ x: 0, y: this.size.height + random() * this.size.height, radius: 1.5 + random() * 3.5,
        speed: .4 + random() * .9, phase: random() * TAU, source: random() }));
      for (const bubble of this.bubbleList) bubble.x = this.bubbleSource(bubble.source);
      return;
    }
    for (const bubble of this.bubbleList) { bubble.x *= scaleX; bubble.y *= scaleY; }
  }

  /**
   * One light-ray texture (a slanted trapezoid fading downwards), reused by six sprites. The sprites stay: new ones
   * would show at full brightness until the next frame, and the tank is drawn right after a resize.
   */
  private paintRays(height: number) {
    const rayHeight = height * .85, old = this.rayTexture;
    const texture = paintTexture({ w: 260, h: rayHeight }, 1, g => {
      const gradient = g.createLinearGradient(0, 0, 0, rayHeight);
      gradient.addColorStop(0, 'rgb(180,235,255)'); gradient.addColorStop(1, 'rgba(180,235,255,0)');
      g.fillStyle = gradient; g.beginPath(); g.moveTo(0, 0); g.lineTo(70, 0); g.lineTo(260, rayHeight); g.lineTo(120, rayHeight); g.fill();
    });
    this.rayTexture = texture;
    if (!this.raySprites.length) {
      for (let index = 0; index < 6; index++) {
        const ray = new Sprite({ texture, alpha: 0 });
        this.raySprites.push(ray); this.rays.addChild(ray);
      }
    }
    for (const ray of this.raySprites) ray.texture = texture;
    old?.destroy(true);
  }

  private moveRays(t: number, day: number) {
    this.raySprites.forEach((ray, index) => {
      ray.x = index * this.size.width / 6 + Math.sin(t / 5000 + index * 1.7) * 70;
      ray.alpha = (.035 + Math.sin(t / 2300 + index) * .015) * (.15 + .85 * day);
    });
  }

  /** Streaks flowing along the current, slower and smaller the further away they are. */
  private drawStreaks(deltaFrames: number) {
    const streaks = this.streaks.clear();
    for (const streak of this.flow) {
      streak.along += deltaFrames * .0011 * (1 - .65 * streak.along);
      if (streak.along > 1) { streak.along = 0; streak.offset = (Math.random() - .5) * 1.5; }
      const head = acrossCurrent(streak.along, streak.offset, this.size);
      const tail = acrossCurrent(Math.max(0, streak.along - streak.length * (1 - .6 * streak.along)), streak.offset, this.size);
      const alpha = .34 * (1 - .6 * streak.along) * Math.min(1, streak.along * 15, (1 - streak.along) * 10);
      streaks.moveTo(...head).lineTo(...tail).stroke({ width: .8 + 2.4 * (1 - streak.along), color: 0xc8f2ff, alpha, cap: 'round' });
    }
  }

  private drawShimmer(t: number) {
    const shimmer = this.shimmer.clear();
    for (let row = 0; row < 3; row++) {
      shimmer.moveTo(0, 6 + row * 7 + Math.sin(t / (600 + row * 200)) * 3);
      for (let x = 16; x <= this.size.width + 16; x += 16) shimmer.lineTo(x, 6 + row * 7 + Math.sin(x / 40 + t / (600 + row * 200)) * 3);
      shimmer.stroke({ width: 2, color: 0xc8f0ff, alpha: .12 });
    }
  }

  private drawBubbles(deltaFrames: number, isBusy: boolean) {
    const sandTop = sandLineFor(this.size.height), bubbles = this.bubbles.clear();
    for (const bubble of this.bubbleList) {
      bubble.y -= bubble.speed * (isBusy ? 2.6 : .7) * deltaFrames;
      if (bubble.y < -10) { bubble.y = sandTop - 40 + Math.random() * 10; bubble.x = this.bubbleSource(bubble.source); }
      const x = bubble.x + Math.sin(bubble.y / 25 + bubble.phase) * 4;
      bubbles.circle(x, bubble.y, bubble.radius).stroke({ width: 1, color: 0xd2f5ff, alpha: .6 });
      bubbles.circle(x - bubble.radius * .35, bubble.y - bubble.radius * .35, bubble.radius * .3).fill({ color: 0xffffff, alpha: .5 });
    }
  }

  /** Plankton, bioluminescent at night. */
  private drawPlankton(t: number, deltaFrames: number, night: number) {
    const plankton = this.plankton.clear();
    this.plankton.blendMode = night > .05 ? 'add' : 'normal';
    const color = (200 - 110 * night | 0) << 16 | 255 << 8 | (240 + 15 * night | 0);
    for (const mote of this.planktonList) {
      mote.x += mote.vx * deltaFrames; mote.y += (mote.vy + Math.sin(t / 2000 + mote.phase) * .05) * deltaFrames;
      mote.x = wrapAround(mote.x, this.size.width); mote.y = wrapAround(mote.y, this.size.height);
      plankton.circle(mote.x, mote.y, mote.radius).fill({ color, alpha: Math.min(1, (.25 + Math.sin(t / 700 + mote.phase) * .15) * (1 + 1.4 * night)) });
    }
  }

  /** Bubbles rise from the treasure chest and from the reef past the middle. */
  private bubbleSource(source: number) {
    return source < .6 ? this.size.width * .2 + 20 + Math.random() * 10 : this.size.width * .58 + (Math.random() - .5) * 20;
  }

  /** Gives every plant its mesh, drawing the ones not drawn yet for this tank height and foreground. */
  private showPlants(renderer: Renderer, height: number) {
    const key = `${this.foreground}:${height}`;
    if (this.drawnFor !== key) {
      for (const art of this.drawn.values()) art.texture.destroy(true);
      this.drawn.clear(); this.drawnFor = key;
    }
    for (const view of this.views) view.mesh.destroy();
    this.views = [];
    for (const plant of this.plants) {
      const art = this.drawn.get(plant.id) ?? this.cache(plant, drawPlant(renderer, plant));
      const mesh = new MeshPlane({ texture: art.texture, verticesX: 2, verticesY: Math.max(6, Math.min(32, Math.round(plant.h / 28))) });
      mesh.position.set(plant.x + art.x, plant.y + art.y);
      this.softCorals.addChild(mesh);
      this.views.push({ plant, mesh, rest: mesh.geometry.positions.slice(), baseY: -art.y });
    }
  }

  private cache(plant: Soft, art: { texture: Texture; x: number; y: number }) {
    this.drawn.set(plant.id, art);
    return art;
  }

  /** Bends each plant in the water: further over the higher up, with a slow sway and a small ripple running up it. */
  private swayPlants(t: number) {
    for (const { plant, mesh, rest, baseY } of this.views) {
      const [amplitude, period] = SWAY[plant.kind], lean = Math.sin(t / period + plant.phase) * amplitude * plant.h;
      const positions = mesh.geometry.positions;
      for (let index = 0; index < positions.length; index += 2) {
        const rise = Math.max(0, (baseY - rest[index + 1]) / plant.h);
        positions[index] = rest[index] + lean * rise * rise + Math.sin(t / 800 + plant.phase * 1.7 + rise * 5) * 2.5 * rise;
      }
      mesh.geometry.getBuffer('aPosition').update();
    }
  }

  private drawAnemones(t: number) {
    const body = this.anemones.clear(), tips = this.anemoneTips.clear();
    if (this.anemonesHidden || !FOREGROUND_ART[this.foreground].hasAnemones) return;
    for (const anemone of this.anemoneList) {
      const ink = shade(anemone.color, -.75);
      for (let index = 0; index < anemone.tentacles; index++) {
        const baseAngle = -Math.PI + (index + .5) * Math.PI / anemone.tentacles, swing = Math.sin(t / 700 + index * .6) * .25;
        const tipX = anemone.x + Math.cos(baseAngle + swing) * anemone.length, tipY = anemone.y - 4 + Math.sin(baseAngle + swing) * anemone.length * 1.1;
        const tentacle = () => body.moveTo(anemone.x + Math.cos(baseAngle) * 8, anemone.y - 4)
          .quadraticCurveTo(anemone.x + Math.cos(baseAngle) * anemone.length * .6, anemone.y - anemone.length * .5, tipX, tipY);
        tentacle().stroke({ width: 6.4, color: ink, cap: 'round' });
        tentacle().stroke({ width: 3.8, color: shade(anemone.color, -.15), cap: 'round' });
        body.circle(tipX, tipY, 3.6).fill(anemone.color).stroke({ width: 1.4, color: ink });
        body.circle(tipX - 1, tipY - 1.1, 1.1).fill({ color: 0xffffff, alpha: .85 });
        tips.circle(tipX, tipY, 6).fill({ color: anemone.color, alpha: .35 });
        tips.circle(tipX, tipY, 3).fill(anemone.color);
      }
      body.ellipse(anemone.x, anemone.y, 17, 9).fill(shade(anemone.color, -.45)).stroke({ width: 2, color: ink });
      body.ellipse(anemone.x - 5, anemone.y - 3, 6, 2).fill({ color: shade(anemone.color, .2), alpha: .8 });
    }
  }
}
