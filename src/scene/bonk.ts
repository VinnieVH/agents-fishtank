import { Container, Graphics } from 'pixi.js';

const PERIOD_MS = 1600, BONKS = [0, .22], BONK = .12, BURST = .5, BUBBLES = 7;

/**
 * A fish bonking its nose against the glass: it lunges at the viewer (`hit`, 0 to 1, for the fish to scale with), and
 * every bonk sends a ring and a burst of bubbles out from its mouth.
 */
export class Bonk {
  readonly view = new Container();
  x = 0; y = 0; size = 40; // the mouth, and how big a bubble burst is, in pixels
  hit = 0;
  private readonly art = new Graphics();

  constructor() { this.view.addChild(this.art); this.view.visible = false; }

  /** strength: 0 (not bonking) to 1 (bonking). */
  update(t: number, strength: number) {
    this.view.visible = strength > .02;
    if (!this.view.visible) { this.hit = 0; return; }
    const phase = (t % PERIOD_MS) / PERIOD_MS;
    this.hit = 0;
    this.view.alpha = strength;
    this.art.clear();
    for (const start of BONKS) {
      const since = (phase - start + 1) % 1;
      if (since < BONK) this.hit = Math.max(this.hit, Math.sin(since / BONK * Math.PI));
      if (since < BURST) this.burst(since / BURST);
    }
  }

  private burst(age: number) {
    const { art, x, y, size } = this;
    art.circle(x, y, size * (.3 + age)).stroke({ width: 3, color: 0xffffff, alpha: (1 - age) * .9 });
    for (let index = 0; index < BUBBLES; index++) {
      const angle = (index / BUBBLES) * Math.PI * 2 + index, reach = size * (.4 + age * (.6 + index % 3 * .25));
      art.circle(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach - age * size * .8, 2 + index % 3 * 1.5)
        .fill({ color: 0xffffff, alpha: (1 - age) * .35 }).stroke({ width: 1.5, color: 0xffffff, alpha: 1 - age });
    }
  }
}
