import { Container, Sprite, Texture } from 'pixi.js';
import { paintTexture } from '../art/canvas';
import type { Credits } from '../credits';
import { nightTint, TAU } from '../util';

const INK = '#1d2a33', RED = '#c81f33', FONT = '"Segoe UI", system-ui, sans-serif';
/** Dial angle for a value 0..100: 0 at lower-left, 50 straight up, 100 at lower-right (240° sweep). */
const dialAngle = (percent: number) => (-210 + 240 * percent / 100) * Math.PI / 180;

interface DialArt { center: number; radius: number }
interface BodyArt extends DialArt { stem: number; plaque: string }
interface FaceArt extends DialArt { used: string; isRed: boolean }
interface NeedleArt { x: number; hub: number; tip: number; tail: number }
interface ToonStyle { fill: string; width: number; inside?: () => void }

const gaugeLayout = (width: number, height: number) => {
  const isMounted = width >= 760; // on narrow screens the panel sits at the bottom, so hang the gauge top-right
  const radius = isMounted ? 74 : 54, center = radius + 8;
  const centerY = isMounted ? height - radius - 52 : radius + 18, centerX = width - radius - (isMounted ? 44 : 18);
  const stem = isMounted ? height + 4 - (centerY + radius) : 0; // runs off the bottom edge of the page
  return { radius, center, left: centerX - center, top: centerY - center, stem };
};

const usedText = (credits: Credits) => credits.unlimited ? '∞' : `${Math.floor(credits.usedPct)}%`;

const plaqueText = (credits: Credits) => {
  const left = credits.unlimited ? 'unlimited' : `${credits.left.toLocaleString()} left`;
  const reset = credits.reset ? `resets ${credits.reset.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}` : '';
  return [left, reset].filter(Boolean).join(' · ');
};

/**
 * A cartoon pressure gauge mounted on a pipe coming up from the bottom of the window (in front of the tank glass),
 * showing the Copilot credits used (0..100%), with a red zone for the last 20%.
 */
export class Gauge extends Container {
  private body = new Sprite(); // bezel, pipe and plaque: darken at night like the scenery
  private face = new Sprite(); // the dial is lit, so it stays bright
  private glow = new Sprite();
  private needle = new Sprite();
  private glass = new Sprite();
  private credits: Credits | null = null;
  private tankWidth = 0; private tankHeight = 0; private radius = 60; private key = '';
  private needleValue = 0; private needleVelocity = 0;

  constructor(private resolution: number) {
    super();
    this.glow.blendMode = 'add'; this.glow.alpha = 0;
    this.addChild(this.body, this.face, this.glow, this.needle, this.glass);
    this.visible = false;
  }

  set(credits: Credits | null) { this.credits = credits; this.visible = !!credits; this.paint(); }

  layout(width: number, height: number) { this.tankWidth = width; this.tankHeight = height; this.paint(); }

  update(t: number, deltaFrames: number, night: number) {
    if (!this.credits) return;
    this.body.tint = nightTint(night); // it stands in front of the night overlay
    const target = this.credits.unlimited ? 0 : Math.min(100, Math.max(0, this.credits.usedPct)), isRed = target >= 80;
    // springy needle (sweeps up with a little overshoot on load) plus a pressure quiver, nervier in the red zone
    this.needleVelocity += (target - this.needleValue) * .02 * deltaFrames;
    this.needleVelocity *= Math.pow(.86, deltaFrames);
    this.needleValue += this.needleVelocity * deltaFrames;
    const quiver = (Math.sin(t * .013) * .25 + Math.sin(t * .031 + 1) * .15) * (isRed ? 2.5 : 1);
    this.needle.rotation = dialAngle(Math.min(101.5, Math.max(-1.5, this.needleValue + quiver))) + Math.PI / 2;
    this.glow.alpha = isRed ? .2 + .4 * (.5 + .5 * Math.sin(t * (this.credits.low ? .008 : .003))) : 0;
  }

  private paint() {
    const credits = this.credits;
    if (!credits || !this.tankWidth) return;
    const { radius, center, left, top, stem } = gaugeLayout(this.tankWidth, this.tankHeight);
    this.position.set(left, top);
    const used = usedText(credits), plaque = plaqueText(credits), isRed = credits.usedPct >= 80;
    const key = [radius, stem, used, plaque, isRed].join('|');
    if (key === this.key) return;
    const isResized = radius !== this.radius || !this.needle.texture || this.needle.texture === Texture.EMPTY;
    this.key = key; this.radius = radius;

    const size = 2 * center;
    swap(this.body, paintTexture({ w: size, h: size + stem }, this.resolution, g => paintBody(g, { center, radius, stem, plaque })));
    swap(this.face, paintTexture({ w: size, h: size }, this.resolution, g => paintFace(g, { center, radius, used, isRed })));
    if (isResized) this.paintDialParts({ center, radius });
  }

  private paintDialParts(dial: DialArt) {
    const size = 2 * dial.center;
    swap(this.glow, paintTexture({ w: size, h: size }, this.resolution, g => paintRedZone(g, dial, true)));
    swap(this.glass, paintTexture({ w: size, h: size }, this.resolution, g => paintGlass(g, dial)));
    const needleWidth = 22, tip = dial.radius * .72, tail = dial.radius * .2, needleHeight = tip + tail + 22;
    swap(this.needle, paintTexture({ w: needleWidth, h: needleHeight }, this.resolution,
      g => paintNeedle(g, { x: needleWidth / 2, hub: 11 + tip, tip, tail })));
    this.needle.anchor.set(.5, (11 + tip) / needleHeight);
    this.needle.position.set(dial.center, dial.center);
  }
}

const swap = (sprite: Sprite, texture: Texture) => {
  const old = sprite.texture;
  sprite.texture = texture;
  if (old && old !== Texture.EMPTY) old.destroy(true);
};

const circle = (x: number, y: number, radius: number) => { const path = new Path2D(); path.arc(x, y, radius, 0, TAU); return path; };

const outline = (g: CanvasRenderingContext2D, path: Path2D, width: number) => {
  g.strokeStyle = INK; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(path);
};

const toon = (g: CanvasRenderingContext2D, path: Path2D, { fill, width, inside }: ToonStyle) => {
  g.fillStyle = fill; g.fill(path);
  if (inside) { g.save(); g.clip(path); inside(); g.restore(); }
  outline(g, path, width);
};

const paintRedZone = (g: CanvasRenderingContext2D, { center, radius }: DialArt, isGlow = false) => {
  const zone = new Path2D();
  zone.arc(center, center, radius * .78, dialAngle(80), dialAngle(100));
  zone.arc(center, center, radius * .6, dialAngle(100), dialAngle(80), true); zone.closePath();
  if (isGlow) { g.shadowColor = '#ff3b4f'; g.shadowBlur = 10; g.fillStyle = '#ff6b7a'; g.fill(zone); g.fill(zone); return; }
  g.fillStyle = '#ff5a6b'; g.fill(zone);
  g.save(); g.clip(zone); g.fillStyle = '#ff8a96'; g.fill(circle(center - radius * .05, center - radius * .05, radius * .7)); g.restore(); // lit inner edge
  outline(g, zone, 1.2);
};

/** Brass stem with a hex nut and threads, running down off the bottom of the page. */
const paintStem = (g: CanvasRenderingContext2D, { center, radius, stem }: BodyArt) => {
  const pipe = new Path2D(); pipe.rect(center - 7, center + radius * .8, 14, stem + radius * .2);
  toon(g, pipe, { fill: '#d4ad52', width: 2.2, inside: () => {
    g.fillStyle = '#a77f2a'; g.fillRect(center + 2, center + radius * .8, 6, stem + radius);
    g.fillStyle = '#f3d98c'; g.fillRect(center - 5, center + radius * .8, 2.5, stem + radius);
    for (let y = center + radius + 26; y < center + radius + stem; y += 4) { g.fillStyle = 'rgba(80,55,10,.45)'; g.fillRect(center - 7, y, 14, 1.3); }
  } });
  const nut = new Path2D(); nut.roundRect(center - 13, center + radius - 3, 26, 14, 2);
  toon(g, nut, { fill: '#e2bf62', width: 2.2, inside: () => {
    g.fillStyle = '#b48b33'; g.fillRect(center + 4, center + radius - 3, 9, 14);
    g.fillStyle = '#fbe7a6'; g.fillRect(center - 10, center + radius - 3, 3, 14);
  } });
};

/** A little plaque on the stem with the credits left and the reset date. */
const paintPlaque = (g: CanvasRenderingContext2D, { center, radius, plaque }: BodyArt) => {
  g.font = `600 ${radius * .13}px ${FONT}`;
  const w = g.measureText(plaque).width + 14, plaqueY = center + radius + 17;
  const plate = new Path2D(); plate.roundRect(center - w / 2, plaqueY, w, radius * .25, 4);
  toon(g, plate, { fill: '#f1e3b5', width: 1.8, inside: () => { g.fillStyle = '#d9c588'; g.fillRect(center - w / 2, plaqueY + radius * .19, w, 6); } });
  g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(plaque, center, plaqueY + radius * .135);
};

const paintBody = (g: CanvasRenderingContext2D, art: BodyArt) => {
  const { center, radius } = art;
  if (art.stem > 0) {
    paintStem(g, art);
    if (art.plaque) paintPlaque(g, art);
  }
  // steel bezel with a shaded lower-right side and a shine on the upper-left
  toon(g, circle(center, center, radius), { fill: '#c4ced7', width: 3, inside: () => {
    g.fillStyle = '#8a9aa7'; g.fill(circle(center + radius * .2, center + radius * .22, radius * .95));
    g.fillStyle = '#c4ced7'; g.fill(circle(center - radius * .04, center - radius * .04, radius * .9));
    g.strokeStyle = '#ffffff'; g.lineWidth = radius * .06; g.lineCap = 'round';
    g.beginPath(); g.arc(center, center, radius * .93, Math.PI * 1.08, Math.PI * 1.42); g.stroke();
  } });
};

/** Ticks every 2%, long ones every 10%, numbers every 20%. */
const paintScale = (g: CanvasRenderingContext2D, { center, radius }: DialArt) => {
  g.lineCap = 'round';
  for (let percent = 0; percent <= 100; percent += 2) {
    const angle = dialAngle(percent), isMajor = percent % 10 === 0;
    const outer = radius * .78, inner = outer - (isMajor ? radius * .17 : radius * .08);
    g.strokeStyle = INK; g.lineWidth = isMajor ? 2.4 : 1.1;
    g.beginPath();
    g.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
    g.lineTo(center + Math.cos(angle) * outer, center + Math.sin(angle) * outer);
    g.stroke();
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `800 ${radius * .16}px ${FONT}`;
  for (let percent = 0; percent <= 100; percent += 20) {
    const angle = dialAngle(percent);
    g.fillStyle = percent >= 80 ? RED : INK;
    g.fillText(String(percent), center + Math.cos(angle) * radius * .5, center + Math.sin(angle) * radius * .5 + 1);
  }
};

const paintFace = (g: CanvasRenderingContext2D, art: FaceArt) => {
  const { center, radius } = art;
  toon(g, circle(center, center, radius * .85), { fill: '#fbf7ec', width: 2.2, inside: () => {
    g.fillStyle = '#e9e2cf'; g.fill(circle(center, center, radius * .85));
    g.fillStyle = '#fbf7ec'; g.fill(circle(center - radius * .05, center - radius * .06, radius * .8));
  } });
  paintRedZone(g, art);
  paintScale(g, art);
  g.fillStyle = '#5d6b76'; g.font = `700 ${radius * .095}px ${FONT}`;
  g.fillText('CREDITS USED', center, center + radius * .64);
  g.fillStyle = art.isRed ? RED : INK; g.font = `800 ${radius * .23}px ${FONT}`;
  g.fillText(art.used, center, center + radius * .43);
};

const paintNeedle = (g: CanvasRenderingContext2D, { x, hub, tip, tail }: NeedleArt) => {
  const needle = new Path2D();
  needle.moveTo(x, hub - tip); needle.lineTo(x + 4, hub); needle.lineTo(x + 2.6, hub + tail);
  needle.lineTo(x - 2.6, hub + tail); needle.lineTo(x - 4, hub); needle.closePath();
  g.save(); g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 3; g.shadowOffsetY = 2; g.fillStyle = '#2b3740'; g.fill(needle); g.restore();
  toon(g, needle, { fill: '#2b3740', width: 1.4, inside: () => { g.fillStyle = '#56656f'; g.fillRect(x - 4, hub - tip, 3, tip + tail); } });
  toon(g, circle(x, hub, 7), { fill: '#c4ced7', width: 2, inside: () => {
    g.fillStyle = '#8a9aa7'; g.fill(circle(x + 2, hub + 2, 6));
    g.fillStyle = '#ffffff'; g.fill(circle(x - 2.2, hub - 2.2, 1.8));
  } });
  g.fillStyle = INK; g.fill(circle(x, hub, 1.6));
};

/** A curved reflection on the glass, upper left, and a small glint lower right. */
const paintGlass = (g: CanvasRenderingContext2D, { center, radius }: DialArt) => {
  const shine = new Path2D();
  shine.arc(center, center, radius * .8, Math.PI * 1.02, Math.PI * 1.55);
  shine.arc(center + radius * .12, center + radius * .14, radius * .78, Math.PI * 1.5, Math.PI * 1.08, true); shine.closePath();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(shine);
  g.fillStyle = 'rgba(255,255,255,.5)';
  g.beginPath(); g.ellipse(center + radius * .5, center + radius * .45, radius * .07, radius * .035, -.8, 0, TAU); g.fill();
};
