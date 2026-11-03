import { Container, Sprite, type Texture } from 'pixi.js';
import { paintTexture } from '../art/canvas';
import { rng, TAU } from '../util';

/** One food flake, as fish see it. */
export interface Flake { x: number; y: number; eaten: boolean; gone: boolean }
/** The flakes from one click. */
export type Pinch = Flake[];

const COLORS = ['#ff9a3c', '#e8632b', '#f4c542', '#9bc53d', '#c9773a'];
const MAX_FLAKES = 80;
const FLAKE_CORNERS = 6;

/** Little toon flakes: irregular rounded chips with an ink outline and a shine dot. */
const paintFlakes = (resolution: number): Texture[] =>
  COLORS.map((color, index) => paintTexture({ w: 14, h: 14 }, resolution, g => {
    const random = rng(91 + index * 13), corners: [number, number][] = [];
    for (let corner = 0; corner < FLAKE_CORNERS; corner++) {
      const angle = corner / FLAKE_CORNERS * TAU, radius = 3.2 + random() * 2.2;
      corners.push([7 + Math.cos(angle) * radius, 7 + Math.sin(angle) * radius * .75]);
    }
    g.beginPath(); g.moveTo(corners[0][0], corners[0][1]);
    for (const [x, y] of corners.slice(1)) g.lineTo(x, y);
    g.closePath();
    g.fillStyle = color; g.fill();
    g.strokeStyle = '#3b1d0c'; g.lineWidth = 1.1; g.lineJoin = 'round'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(5.6, 5.4, 1.4, .8, -.4, 0, TAU); g.fill();
  }));

const paintPop = (resolution: number) =>
  paintTexture({ w: 24, h: 24 }, resolution, g => {
    g.strokeStyle = 'rgba(220,245,255,.9)'; g.lineWidth = 1.6;
    g.beginPath(); g.arc(12, 12, 9, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.8)';
    for (const [x, y] of [[12, 3], [20, 9], [5, 16]]) { g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill(); }
  });

interface Bit extends Flake { sprite: Sprite; vy: number; wobble: number; spin: number; landed: number }
interface Pop { sprite: Sprite; age: number }

/** Fish food dropped where you click: it sinks with a little wobble and settles on the sand, then fades away. */
export class Food extends Container {
  private bits: Bit[] = [];
  private pops: Pop[] = [];
  private textures: Texture[];
  private popTexture: Texture;

  constructor(resolution: number) {
    super();
    this.textures = paintFlakes(resolution);
    this.popTexture = paintPop(resolution);
  }

  /** Drops a pinch of flakes around (x, y). */
  drop(x: number, y: number): Pinch {
    const pinch: Bit[] = [];
    const count = 4 + Math.floor(Math.random() * 3);
    for (let index = 0; index < count; index++) {
      const sprite = new Sprite(this.textures[Math.floor(Math.random() * this.textures.length)]);
      sprite.anchor.set(.5); sprite.scale.set(1 + Math.random() * .4); sprite.rotation = Math.random() * TAU;
      const bit: Bit = { sprite, x: x + (Math.random() - .5) * 26, y: y + (Math.random() - .5) * 14, eaten: false, gone: false,
        vy: .15 + Math.random() * .2, wobble: Math.random() * TAU, spin: (Math.random() - .5) * .04, landed: 0 };
      sprite.position.set(bit.x, bit.y);
      this.addChild(sprite); this.bits.push(bit); pinch.push(bit);
    }
    while (this.bits.length > MAX_FLAKES) this.remove(this.bits[0]);
    return pinch;
  }

  update(t: number, deltaFrames: number, floor: number) {
    for (const bit of [...this.bits]) {
      if (bit.eaten) { this.pop(bit.x, bit.y); this.remove(bit); continue; }
      const rest = floor - 3 + Math.sin(bit.wobble * 3) * 3;
      if (bit.y < rest) {
        bit.wobble += .03 * deltaFrames;
        bit.y = Math.min(rest, bit.y + bit.vy * deltaFrames);
        bit.x += Math.sin(bit.wobble) * .25 * deltaFrames;
        bit.sprite.rotation += bit.spin * deltaFrames;
      } else if (!bit.landed) bit.landed = t;
      else if (t - bit.landed > 15000) {
        bit.sprite.alpha -= .01 * deltaFrames;
        if (bit.sprite.alpha <= 0) { this.remove(bit); continue; }
      }
      bit.sprite.position.set(bit.x, bit.y);
    }
    for (const pop of [...this.pops]) {
      pop.age += deltaFrames / 20;
      pop.sprite.scale.set(.4 + pop.age * .8); pop.sprite.alpha = 1 - pop.age;
      if (pop.age >= 1) { pop.sprite.destroy(); this.pops.splice(this.pops.indexOf(pop), 1); }
    }
  }

  private pop(x: number, y: number) {
    const sprite = new Sprite(this.popTexture); sprite.anchor.set(.5); sprite.position.set(x, y);
    this.addChild(sprite); this.pops.push({ sprite, age: 0 });
  }

  private remove(bit: Bit) {
    bit.gone = true; bit.sprite.destroy();
    this.bits.splice(this.bits.indexOf(bit), 1);
  }
}
