import { Container, Sprite } from 'pixi.js';
import { DRIFT, DRIFT_TEXTURE_SIZE, driftTexture } from '../art/drift';
import type { SeasonId } from '../seasons';
import { TAU } from '../util';

const BITS = 34;

interface Bit { sprite: Sprite; speed: number; sway: number; phase: number; spin: number }

/** What drifts through the water in a season: snow, hearts, petals, leaves... Behind the fish. */
export class Drift extends Container {
  private bits: Bit[] = [];
  private season: SeasonId | null = null;
  private tankWidth = 0; private tankHeight = 0;

  private resolution: number;

  constructor(resolution: number) { super(); this.resolution = resolution; this.eventMode = 'none'; }

  /** Starts a season's bits (none for null), scattered over a tank this size. */
  set(season: SeasonId | null, width: number, height: number) {
    this.season = season; this.tankWidth = width; this.tankHeight = height;
    for (const child of this.removeChildren()) child.destroy();
    this.bits = [];
    if (!season) return;
    const { shape, tints, size } = DRIFT[season], texture = driftTexture(shape, this.resolution);
    for (let index = 0; index < BITS; index++) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(.5); sprite.scale.set(size / DRIFT_TEXTURE_SIZE * (.7 + Math.random() * .6));
      sprite.tint = tints[index % tints.length]; sprite.alpha = .55 + Math.random() * .4;
      sprite.position.set(Math.random() * width, Math.random() * height);
      this.bits.push({ sprite, speed: .7 + Math.random() * .6, sway: .2 + Math.random() * .5, phase: Math.random() * TAU, spin: (Math.random() - .5) * .04 });
      this.addChild(sprite);
    }
  }

  update(t: number, deltaFrames: number) {
    if (!this.season) return;
    const { fall } = DRIFT[this.season], margin = 16;
    for (const { sprite, speed, sway, phase, spin } of this.bits) {
      sprite.y += fall * speed * deltaFrames;
      sprite.x += Math.sin(t / 900 + phase) * sway * deltaFrames;
      sprite.rotation += spin * deltaFrames;
      if (fall > 0 && sprite.y > this.tankHeight + margin) { sprite.y = -margin; sprite.x = Math.random() * this.tankWidth; }
      if (fall < 0 && sprite.y < -margin) { sprite.y = this.tankHeight + margin; sprite.x = Math.random() * this.tankWidth; }
    }
  }
}
