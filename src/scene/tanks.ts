import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { paintTexture } from '../art/canvas';
import { sandLineFor } from '../art/terrain';
import type { Air, Tanks } from '../limits';
import { NARROW_WIDTH, nightTint, TAU } from '../util';

// A diver's two scuba tanks standing forward on the sand by the rocks on the left, with Claude's plan usage as the air
// left in them: the big yellow one for the 5-hour window, the slim coral one leaning on it for the week. An almost
// empty tank leaks bubbles from its valve. The exact numbers and refill times are in the side panel.
// (Copilot's credits gauge has the bottom-right corner, so both can show at once.)
const INK = '#1d2a33', FONT = '"Segoe UI", system-ui, sans-serif';

interface Look { w: number; h: number; body: string; shade: string; light: string; label: string; tilt: number }
const BIG: Look = { w: 46, h: 112, body: '#f6c945', shade: '#d39b1c', light: '#fff0a8', label: '5H', tilt: 0 };
const SLIM: Look = { w: 34, h: 96, body: '#ff8a65', shade: '#d9583a', light: '#ffc3ab', label: 'WEEK', tilt: -.1 };

// texture layout: the tanks side by side, standing on BASE
const CANVAS_WIDTH = 116, TOP = 30, BASE = TOP + BIG.h, CANVAS_HEIGHT = BASE + 10;
const BIG_X = 34, SLIM_X = BIG_X + BIG.w / 2 + 6 + SLIM.w / 2;
const SCALE = 1.3; // drawn bigger than the layout units above

/** A tank standing at x on BASE. */
interface Stand { x: number; look: Look }
const BIG_TANK: Stand = { x: BIG_X, look: BIG };
const SLIM_TANK: Stand = { x: SLIM_X, look: SLIM };

interface Bubble { x: number; y: number; radius: number; vy: number; phase: number }
interface Box { x: number; y: number; w: number; h: number }
interface ToonStyle { fill: string; width: number; inside?: () => void }

export class AirTanks extends Container {
  private art = new Sprite();
  private leak = new Graphics();
  private tanks: Tanks | null = null;
  private tankWidth = 0; private key = '';
  private bubbles: Bubble[] = [];
  private nextBubble = 0;
  private readonly resolution: number;

  constructor(resolution: number) {
    super();
    this.resolution = resolution;
    this.addChild(this.art, this.leak);
    this.visible = false;
  }

  set(tanks: Tanks | null) { this.tanks = tanks; this.showIfRoom(); this.paint(); }

  // well forward on the sand by the rocks on the left; on a phone the panel covers the sand, and has the numbers
  layout(width: number, height: number) {
    this.tankWidth = width;
    this.position.set(Math.max(16, width * .08 + 30 - CANVAS_WIDTH * SCALE / 2), sandLineFor(height) + 48 - BASE * SCALE);
    this.showIfRoom();
    this.paint();
  }

  private showIfRoom() { this.visible = !!this.tanks && this.tankWidth >= NARROW_WIDTH; }

  update(t: number, deltaFrames: number, night: number) {
    if (!this.tanks) return;
    this.tint = nightTint(night); // they stand in front of the night overlay
    this.leakBubbles(t, this.tanks);
    const g = this.leak.clear();
    this.bubbles = this.bubbles.filter(bubble => {
      bubble.y -= bubble.vy * deltaFrames; bubble.radius += .012 * deltaFrames; bubble.phase += .08 * deltaFrames;
      const x = bubble.x + Math.sin(bubble.phase) * 2.5;
      g.circle(x, bubble.y, bubble.radius).stroke({ width: 1.2, color: 0xd2f5ff, alpha: .75 });
      g.circle(x - bubble.radius * .35, bubble.y - bubble.radius * .35, bubble.radius * .3).fill({ color: 0xffffff, alpha: .7 });
      return bubble.y > -this.y; // until it leaves the top of the screen
    });
  }

  /** Valves of tanks that are almost empty: a bubble every few hundred ms, wobbling up and growing. */
  private leakBubbles(t: number, tanks: Tanks) {
    const valves = ([[tanks.fiveHour, BIG_TANK], [tanks.week, SLIM_TANK]] as const)
      .filter(([air]) => air?.low).map(([, stand]) => valve(stand));
    if (!valves.length || t <= this.nextBubble) return;
    const [x, y] = valves[Math.floor(Math.random() * valves.length)];
    this.bubbles.push({ x: x * SCALE + (Math.random() - .5) * 4, y: y * SCALE, radius: 1.5 + Math.random() * 2, vy: .6 + Math.random() * .5, phase: Math.random() * TAU });
    this.nextBubble = t + 250 + Math.random() * 500;
  }

  private paint() {
    const tanks = this.tanks;
    if (!tanks || !this.tankWidth) return;
    const key = [tanks.fiveHour && Math.round(tanks.fiveHour.left), tanks.week && Math.round(tanks.week.left)].join('|');
    if (key === this.key) return;
    this.key = key;
    const old = this.art.texture;
    this.art.texture = paintTexture({ w: CANVAS_WIDTH * SCALE, h: CANVAS_HEIGHT * SCALE }, this.resolution, g => {
      g.scale(SCALE, SCALE);
      paintTank(g, SLIM_TANK, tanks.week); // behind, leaning on the big one
      paintTank(g, BIG_TANK, tanks.fiveHour);
      paintSandDrift(g);
    });
    if (old && old !== Texture.EMPTY) old.destroy(true);
  }
}

/** Where a tank's valve outlet is, in texture coordinates. */
const valve = ({ x, look }: Stand): [number, number] => {
  const top = look.h + 18;
  return [x + Math.sin(look.tilt) * top - 9, BASE - Math.cos(look.tilt) * top];
};

const airColor = (air: Air) => {
  if (air.low) return '#ff5a6b';
  return air.warn ? '#ffc94d' : '#6fe3ff';
};

const outline = (g: CanvasRenderingContext2D, path: Path2D, width: number) => {
  g.strokeStyle = INK; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(path);
};
const toon = (g: CanvasRenderingContext2D, path: Path2D, { fill, width, inside }: ToonStyle) => {
  g.fillStyle = fill; g.fill(path);
  if (inside) { g.save(); g.clip(path); inside(); g.restore(); }
  outline(g, path, width);
};
const roundedRect = ({ x, y, w, h }: Box, radius: number | number[]) => { const path = new Path2D(); path.roundRect(x, y, w, h, radius); return path; };
const circle = (x: number, y: number, radius: number) => { const path = new Path2D(); path.arc(x, y, radius, 0, TAU); return path; };

/** Sunk into the sand like the chest: a drift over the feet of both tanks, heaped up a little against each. */
const paintSandDrift = (g: CanvasRenderingContext2D) => {
  const top = new Path2D(), base = BASE, big = BIG_X + BIG.w / 2, slim = SLIM_X + SLIM.w / 2 + 2;
  top.moveTo(2, base + 7); top.quadraticCurveTo(8, base - 2, 16, base - 4); top.quadraticCurveTo(BIG_X, base - 8, big, base - 5);
  top.quadraticCurveTo(big + 4, base - 3, big + 7, base - 5); top.quadraticCurveTo(SLIM_X, base - 8, slim, base - 4);
  top.quadraticCurveTo(slim + 8, base - 1, CANVAS_WIDTH - 2, base + 7);
  const drift = new Path2D(top); drift.closePath();
  g.fillStyle = '#e8cd96'; g.fill(drift);
  g.strokeStyle = '#7a5726'; g.lineWidth = 2; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(top);
  g.fillStyle = '#c9a66a';
  for (const [x, y] of [[12, base + 2], [30, base - 1], [52, base + 1], [72, base - 1], [92, base + 1], [106, base + 3]]) {
    g.beginPath(); g.ellipse(x, y, 1.3, 1, 0, 0, TAU); g.fill();
  }
};

/** Chrome neck and block, black handwheel on the right, outlet on the left. */
const paintValve = (g: CanvasRenderingContext2D, { h }: Look) => {
  const top = -h;
  const chrome = (path: Path2D, width: number) =>
    toon(g, path, { fill: '#c4ced7', width, inside: () => { g.fillStyle = '#8a9aa7'; g.fillRect(2, -h - 40, 20, 40); } });
  chrome(roundedRect({ x: -6, y: top - 9, w: 12, h: 12 }, 2), 2);
  chrome(roundedRect({ x: -11, y: top - 22, w: 22, h: 14 }, 3), 2.2);
  chrome(roundedRect({ x: -17, y: top - 19, w: 7, h: 7 }, 1.5), 1.8);
  toon(g, circle(16, top - 15, 6.5), { fill: '#2b3740', width: 2, inside: () => { g.fillStyle = '#56656f'; g.fill(circle(14.5, top - 16.5, 3)); } });
};

/** Domed shoulder, flat-ish foot, shaded right side, a shine down the left and a white band with the window's name. */
const paintBody = (g: CanvasRenderingContext2D, look: Look) => {
  const { w, h } = look, left = -w / 2, top = -h, bandY = top + h * .13;
  toon(g, roundedRect({ x: left, y: top, w, h }, [w * .45, w * .45, 7, 7]), { fill: look.body, width: 2.6, inside: () => {
    g.fillStyle = look.shade; g.fillRect(w * .18, top, w * .4, h);
    g.fillStyle = look.light; g.fillRect(left + w * .14, top + h * .08, w * .1, h * .84);
    g.fillStyle = '#f4f1e8'; g.fillRect(left, bandY, w, 15);
    g.fillStyle = '#d8d2c0'; g.fillRect(w * .18, bandY, w * .4, 15);
    g.fillStyle = INK; g.font = `800 ${w > 40 ? 10 : 8.5}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(look.label, 0, bandY + 8, w - 8);
  } });
  const band = new Path2D(); band.moveTo(left, bandY); band.lineTo(-left, bandY); band.moveTo(left, bandY + 15); band.lineTo(-left, bandY + 15);
  outline(g, band, 1.4);
};

/** The sight glass with the air left, and ticks at every quarter. */
const paintSightGlass = (g: CanvasRenderingContext2D, { w, h }: Look, air: Air | null) => {
  const top = -h, glass: Box = { x: -w * .34 / 2, y: top + h * .34, w: w * .34, h: h * .56 };
  toon(g, roundedRect(glass, glass.w / 2), { fill: '#173040', width: 2, inside: () => {
    if (!air) return;
    const level = glass.h * air.left / 100;
    g.fillStyle = airColor(air); g.fillRect(glass.x, glass.y + glass.h - level, glass.w, level);
    g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(glass.x, glass.y + glass.h - level, glass.w, 2); // surface
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(glass.x + glass.w * .2, glass.y, glass.w * .18, glass.h); // shine
  } });
  g.strokeStyle = INK; g.lineWidth = 1.4;
  for (let quarter = 1; quarter < 4; quarter++) {
    const y = glass.y + glass.h * quarter / 4;
    g.beginPath(); g.moveTo(glass.x + glass.w, y); g.lineTo(glass.x + glass.w + 4, y); g.stroke();
  }
  if (air) return;
  g.fillStyle = '#9fb3c2'; g.font = `800 ${glass.w}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('?', 0, glass.y + glass.h / 2);
};

/** A scuba tank standing on BASE at x, drawn upright and then tilted around its foot. */
const paintTank = (g: CanvasRenderingContext2D, { x, look }: Stand, air: Air | null) => {
  g.save();
  g.translate(x, BASE); g.rotate(look.tilt);
  paintValve(g, look);
  paintBody(g, look);
  paintSightGlass(g, look, air);
  g.restore();
};
