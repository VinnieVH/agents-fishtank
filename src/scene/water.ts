import { Container, Graphics, MeshPlane, Sprite, type Renderer, type Texture } from 'pixi.js';
import { currentAt, reefs, sandLineFor } from '../art/terrain';
import type { SoftKind } from '../art/reef';
import { paintTexture } from '../art/canvas';
import { rng, shade, TAU } from '../util';

/** A soft coral growing from a reef (art/reef.ts), swaying in the water; `id` tells it apart from all the others. */
interface Soft { id: number; kind: SoftKind; x: number; y: number; h: number; color: string; seed: number; phase: number }
type Point = [number, number];
interface Branch { x: number; y: number; length: number; angle: number; w: number; depth: number }
interface Anemone { x: number; y: number; tentacles: number; length: number; color: string }
interface Plankton { x: number; y: number; radius: number; vx: number; vy: number; phase: number }
interface Bubble { x: number; y: number; radius: number; speed: number; phase: number; source: number }
/** A streak flowing along the current: `along` it from 0 to 1, `offset` across it from -1 to 1. */
interface Streak { along: number; offset: number; length: number }
interface TankSize { width: number; height: number }
/** What the water needs each frame (`t` on the scenery's own clock); main.ts keeps one and refills it, so a frame allocates nothing. */
export interface WaterFrame { t: number; deltaFrames: number; isBusy: boolean; day: number; night: number }
type SoftPainter = (g: Graphics, coral: Soft, random: () => number) => void;

/** How far each kind sways over (as a fraction of its height) and how slowly (ms): fans flex a little, whips a lot. */
const SWAY: Record<SoftKind, [number, number]> = { fan: [.04, 2300], whip: [.14, 1700], tree: [.07, 1500] };
const BAND_STEPS = 60;

/** Strokes a list of [x1, y1, x2, y2, width] segments three times: ink, colour, and a light rim on the left. */
const strokeBranches = (g: Graphics, segments: number[][], color: string) => {
  const layers = [[shade(color, -.65), 3, 1, 0], [color, 0, 1, 0], [shade(color, .45), 0, .3, -.25]] as const;
  for (const [strokeColor, extraWidth, widthScale, rimShift] of layers) {
    for (const [x1, y1, x2, y2, w] of segments) {
      g.moveTo(x1 + rimShift * w, y1).lineTo(x2 + rimShift * w, y2).stroke({ width: w * widthScale + extraWidth, color: strokeColor, cap: 'round' });
    }
  }
};

/** A sea fan: one flat fan of ever finer branches, spread wide like a net. */
const paintFan: SoftPainter = (g, coral, random) => {
  const segments: number[][] = [];
  const grow = ({ x, y, length, angle, w, depth }: Branch): void => {
    if (!depth) return;
    const x2 = x + Math.cos(angle) * length, y2 = y + Math.sin(angle) * length;
    segments.push([x, y, x2, y2, w]);
    const spread = .22 + random() * .2;
    grow({ x: x2, y: y2, length: length * .78, angle: angle - spread, w: Math.max(1, w * .72), depth: depth - 1 });
    grow({ x: x2, y: y2, length: length * .78, angle: angle + spread, w: Math.max(1, w * .72), depth: depth - 1 });
  };
  grow({ x: 0, y: 0, length: coral.h * .16, angle: -Math.PI / 2, w: Math.max(3, coral.h * .022), depth: 7 });
  strokeBranches(g, segments, coral.color);
  for (const [, , x2, y2] of segments.slice(-64)) g.circle(x2, y2, 1.6).fill(shade(coral.color, .55));
};

/** Sea whips: a bunch of long, thin rods covered in little polyps. */
const paintWhip: SoftPainter = (g, coral, random) => {
  for (let rod = 0, rods = 4 + Math.floor(random() * 4); rod < rods; rod++) {
    const offset = rod / (rods - 1) - .5, length = coral.h * (.6 + random() * .4);
    const lean = offset * .5 + (random() - .5) * .15, bend = (random() - .5) * .5;
    const points: Point[] = [[offset * 10, 0]];
    for (let step = 1; step <= 14; step++) {
      const along = step / 14, angle = lean + bend * along * along, [lastX, lastY] = points[step - 1];
      points.push([lastX + Math.sin(angle) * length / 14, lastY - Math.cos(angle) * length / 14]);
    }
    const segments = points.slice(1).map(([x, y], index) => [points[index][0], points[index][1], x, y, 5.5 - 2.5 * index / 14]);
    strokeBranches(g, segments, coral.color);
    for (let index = 1; index < points.length; index++) {
      g.circle(points[index][0] + (index % 2 ? 1.6 : -1.6), points[index][1], 1.2).fill(shade(coral.color, .6));
    }
  }
};

/** A tree coral: a pale, see-through trunk branching out into clusters of bright round lobes. */
const paintTree: SoftPainter = (g, coral, random) => {
  const segments: number[][] = [], ends: Point[] = [];
  const grow = ({ x, y, length, angle, w, depth }: Branch): void => {
    const x2 = x + Math.cos(angle) * length, y2 = y + Math.sin(angle) * length;
    segments.push([x, y, x2, y2, w]);
    if (!depth) { ends.push([x2, y2]); return; }
    for (let index = 0, count = 2 + (random() < .4 ? 1 : 0); index < count; index++) {
      grow({ x: x2, y: y2, length: length * .7, angle: angle + (index - (count - 1) / 2) * .6 + (random() - .5) * .2, w: w * .65, depth: depth - 1 });
    }
  };
  grow({ x: 0, y: 0, length: coral.h * .32, angle: -Math.PI / 2, w: Math.max(4, coral.h * .06), depth: 3 });
  for (const [x1, y1, x2, y2, w] of segments) g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: w + 3, color: shade(coral.color, -.6), cap: 'round', alpha: .8 });
  for (const [x1, y1, x2, y2, w] of segments) g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: w, color: shade(coral.color, .65), cap: 'round', alpha: .85 });
  for (const [endX, endY] of ends) for (let index = 0, count = 7 + Math.floor(random() * 5); index < count; index++) {
    const angle = random() * TAU, distance = random() * 10;
    const x = endX + Math.cos(angle) * distance, y = endY + Math.sin(angle) * distance * .8, radius = 3.5 + random() * 3.5;
    g.circle(x, y, radius).fill(coral.color).stroke({ width: 1.3, color: shade(coral.color, -.65) });
    g.circle(x - radius * .3, y - radius * .3, radius * .35).fill({ color: 0xffffff, alpha: .6 });
  }
};

// Cartoon style like the fish: branches stroked in ink, colour and a light rim; polyps and lobes with a shine.
const SOFT_PAINTERS: Record<SoftKind, SoftPainter> = { fan: paintFan, whip: paintWhip, tree: paintTree };

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
  private drawnFor = 0;
  private anemoneList: Anemone[] = [];
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
    this.plants = reefs(width, height)
      .flatMap(reef => reef.soft.map((coral, index) => ({ ...coral, id: reef.index * 8 + index, h: coral.size, phase: rng(coral.seed)() * TAU })))
      .sort((one, other) => other.h - one.h);
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

  /** Gives every plant its mesh, drawing the ones not drawn yet for this tank height. */
  private showPlants(renderer: Renderer, height: number) {
    if (this.drawnFor !== height) {
      for (const art of this.drawn.values()) art.texture.destroy(true);
      this.drawn.clear(); this.drawnFor = height;
    }
    for (const view of this.views) view.mesh.destroy();
    this.views = [];
    for (const plant of this.plants) {
      const art = this.drawn.get(plant.id) ?? this.drawPlant(renderer, plant);
      const mesh = new MeshPlane({ texture: art.texture, verticesX: 2, verticesY: Math.max(6, Math.min(32, Math.round(plant.h / 28))) });
      mesh.position.set(plant.x + art.x, plant.y + art.y);
      this.softCorals.addChild(mesh);
      this.views.push({ plant, mesh, rest: mesh.geometry.positions.slice(), baseY: -art.y });
    }
  }

  private drawPlant(renderer: Renderer, plant: Soft) {
    const graphics = new Graphics();
    SOFT_PAINTERS[plant.kind](graphics, { ...plant, x: 0, y: 0 }, rng(plant.seed));
    const bounds = graphics.getLocalBounds();
    const art = { texture: renderer.generateTexture({ target: graphics, resolution: renderer.resolution, antialias: true }), x: bounds.x, y: bounds.y };
    graphics.destroy();
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
