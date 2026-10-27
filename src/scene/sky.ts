import { Container, Sprite, Texture } from 'pixi.js';
import { wrapAngle, type Light } from '../sky';
import { paintTexture } from '../art/canvas';

/** Night darkness, a warm sunrise/sunset tint, and the sun or moon shining through the surface. */
export class SkyOverlay extends Container {
  private dark = new Sprite(Texture.WHITE);
  private warm: Sprite;
  private sun: Sprite;
  private moon: Sprite;
  private W = 0;

  constructor() {
    super();
    this.dark.tint = 0x02081a;
    this.warm = new Sprite(paintTexture(4, 256, 1, g => {
      const lg = g.createLinearGradient(0, 0, 0, 256);
      lg.addColorStop(0, 'rgba(255,115,40,.34)'); lg.addColorStop(.6, 'rgba(255,115,40,.1)'); lg.addColorStop(1, 'rgba(255,115,40,0)');
      g.fillStyle = lg; g.fillRect(0, 0, 4, 256);
    }));
    const glow = paintTexture(256, 256, 1, g => {
      const rg = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    });
    this.sun = new Sprite(glow); this.moon = new Sprite(glow);
    for (const s of [this.sun, this.moon]) { s.anchor.set(.5); s.blendMode = 'add'; }
    this.moon.tint = 0xaac8ff;
    this.addChild(this.dark, this.warm, this.sun, this.moon);
  }

  resize(W: number, H: number) {
    this.W = W;
    this.dark.setSize(W, H);
    this.warm.setSize(W, H * .75);
    const r = Math.max(W, H) * .4;
    for (const s of [this.sun, this.moon]) s.setSize(2 * r, 2 * r);
  }

  update(light: Light) {
    const { night, warm, day, ha } = light;
    this.dark.alpha = .66 * night; this.dark.visible = night > .01;
    this.warm.alpha = warm; this.warm.visible = warm > .01;
    this.sun.tint = warm > .3 ? 0xffbe78 : 0xffebb4;
    this.sun.alpha = .12 * day; this.sun.x = this.W * (.5 + ha / Math.PI);
    this.moon.alpha = .14 * night; this.moon.x = this.W * (.5 + wrapAngle(ha + Math.PI) / Math.PI);
    this.sun.y = this.moon.y = 0;
  }
}
