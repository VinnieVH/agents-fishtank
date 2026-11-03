import { Container, Sprite, Texture } from 'pixi.js';
import { wrapAngle, type Light } from '../sky';
import { paintTexture } from '../art/canvas';

/** Night darkness, a warm sunrise/sunset tint, and the sun or moon shining through the surface. */
export class SkyOverlay extends Container {
  private dark = new Sprite(Texture.WHITE);
  private warm: Sprite;
  private sun: Sprite;
  private moon: Sprite;
  private tankWidth = 0;

  constructor() {
    super();
    this.dark.tint = 0x02081a;
    this.warm = new Sprite(paintTexture({ w: 4, h: 256 }, 1, g => {
      const gradient = g.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, 'rgba(255,115,40,.34)'); gradient.addColorStop(.6, 'rgba(255,115,40,.1)'); gradient.addColorStop(1, 'rgba(255,115,40,0)');
      g.fillStyle = gradient; g.fillRect(0, 0, 4, 256);
    }));
    const glow = paintTexture({ w: 256, h: 256 }, 1, g => {
      const gradient = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gradient; g.fillRect(0, 0, 256, 256);
    });
    this.sun = new Sprite(glow); this.moon = new Sprite(glow);
    for (const light of [this.sun, this.moon]) { light.anchor.set(.5); light.blendMode = 'add'; }
    this.moon.tint = 0xaac8ff;
    this.addChild(this.dark, this.warm, this.sun, this.moon);
  }

  resize(width: number, height: number) {
    this.tankWidth = width;
    this.dark.setSize(width, height);
    this.warm.setSize(width, height * .75);
    const radius = Math.max(width, height) * .4;
    for (const light of [this.sun, this.moon]) light.setSize(2 * radius, 2 * radius);
  }

  update(light: Light) {
    const { night, warm, day, hourAngle } = light;
    this.dark.alpha = .66 * night; this.dark.visible = night > .01;
    this.warm.alpha = warm; this.warm.visible = warm > .01;
    this.sun.tint = warm > .3 ? 0xffbe78 : 0xffebb4;
    this.sun.alpha = .12 * day; this.sun.x = this.tankWidth * (.5 + hourAngle / Math.PI);
    this.moon.alpha = .14 * night; this.moon.x = this.tankWidth * (.5 + wrapAngle(hourAngle + Math.PI) / Math.PI);
    this.sun.y = this.moon.y = 0;
  }
}
