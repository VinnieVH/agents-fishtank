import { Sprite, Texture } from 'pixi.js';
import { paintTexture } from '../art/canvas';
import { FOREGROUND_ART } from '../art/foreground';
import { CONTAINER_BOX, containerSpot, paintContainerLayer, sandLineFor } from '../art/terrain';
import type { ForegroundId } from '../foregrounds';
import type { SeasonId } from '../seasons';

export interface TreasureLook { width: number; height: number; gold: number; gems: number; season?: SeasonId | null; foreground: ForegroundId }

const WIDE_OPEN = 10_000, MOVING = 4_500, SHUT = 2_500; // ms: the clam stays open, shuts slowly, stays shut a moment, opens slowly
const CYCLE = WIDE_OPEN + MOVING + SHUT + MOVING;
const ease = (x: number) => x * x * (3 - 2 * x);

/** How open the clam is at `time` ms: 1 wide open, 0 shut. */
export const openness = (time: number) => {
  const at = time % CYCLE;
  if (at < WIDE_OPEN) return 1;
  if (at < WIDE_OPEN + MOVING) return 1 - ease((at - WIDE_OPEN) / MOVING);
  if (at < WIDE_OPEN + MOVING + SHUT) return 0;
  return ease((at - WIDE_OPEN - MOVING - SHUT) / MOVING);
};

/** The chest, clam or coffer, in a small layer of its own: the clam opens and shuts slowly, which would be too much to repaint the floor for. */
export class Treasure {
  readonly sprite = new Sprite();
  private look: TreasureLook | null = null;
  private shown = 1;

  constructor(private readonly resolution: number) {}

  set(look: TreasureLook) {
    this.look = look;
    const [x, y] = containerSpot(look.width, sandLineFor(look.height));
    this.sprite.position.set(x - CONTAINER_BOX.x, y - CONTAINER_BOX.y);
    this.paint(this.shown);
  }

  update(time: number) {
    if (!this.look || FOREGROUND_ART[this.look.foreground].container !== 'clam') return;
    const open = openness(time);
    if (Math.abs(open - this.shown) > .01) this.paint(open);
  }

  private paint(open: number) {
    if (!this.look) return;
    const old = this.sprite.texture, look = this.look;
    this.shown = open;
    this.sprite.texture = paintTexture({ w: CONTAINER_BOX.w, h: CONTAINER_BOX.h }, this.resolution, g => paintContainerLayer(g, { ...look, open }));
    if (old !== Texture.EMPTY) old.destroy(true);
  }
}
