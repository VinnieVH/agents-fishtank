import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { paintTexture } from '../art/canvas';
import { sandY } from '../art/terrain';
import type { Air, Tanks } from '../limits';
import { TAU } from '../util';

// A diver's two scuba tanks standing in the sand against the rocks on the left, showing Claude's plan usage as the air
// left in them: the big yellow one for the 5-hour window, the slim coral one leaning on it for the week. A dive slate
// in the sand says how much is left and when it refills. An almost empty tank leaks bubbles from its valve.
const INK = '#1d2a33', RED = '#c81f33', FONT = '"Segoe UI", system-ui, sans-serif';

interface Look { w: number; h: number; body: string; shade: string; light: string; label: string; tilt: number }
const BIG: Look = { w: 46, h: 112, body: '#f6c945', shade: '#d39b1c', light: '#fff0a8', label: '5H', tilt: 0 };
const SLIM: Look = { w: 34, h: 96, body: '#ff8a65', shade: '#d9583a', light: '#ffc3ab', label: 'WEEK', tilt: -.1 };

// texture layout: the tanks side by side over the slate
const CW = 176, TOP = 30, BASE = TOP + BIG.h, SLATE_Y = BASE + 10, SLATE_H = 36, CH = SLATE_Y + SLATE_H + 4;
const BIG_X = CW / 2 - 22, SLIM_X = BIG_X + BIG.w / 2 + 6 + SLIM.w / 2;
const K = 1.3; // drawn bigger than the layout units above, so the slate stays readable

interface Bubble { x: number; y: number; r: number; vy: number; phase: number }

export class AirTanks extends Container {
  private art = new Sprite();
  private leak = new Graphics();
  private tanks: Tanks | null = null;
  private W = 0; private key = '';
  private bubbles: Bubble[] = [];
  private nextBubble = 0;
  private readonly res: number;

  constructor(res: number) {
    super();
    this.res = res;
    this.addChild(this.art, this.leak);
    this.visible = false;
  }

  set(t: Tanks | null) { this.tanks = t; this.visible = !!t; this.paint(); }

  layout(W: number, H: number) {
    this.W = W;
    // in the sand by the rocks on the left; on narrow screens the panel covers the bottom, so float them top-left
    if (W >= 760) this.position.set(Math.max(4, W * .08 + 30 - CW * K / 2), sandY(H) + 18 - BASE * K);
    else this.position.set(6, 12);
    this.paint();
  }

  update(t: number, dt: number) {
    if (!this.tanks) return;
    // valves of tanks that are almost empty: a bubble every few hundred ms, wobbling up and growing
    const valves = ([[this.tanks.fiveHour, BIG_X, BIG], [this.tanks.week, SLIM_X, SLIM]] as const)
      .filter(([air]) => air?.low).map(([, x, look]) => valve(x, look));
    if (valves.length && t > this.nextBubble) {
      const [x, y] = valves[Math.floor(Math.random() * valves.length)];
      this.bubbles.push({ x: x * K + (Math.random() - .5) * 4, y: y * K, r: 1.5 + Math.random() * 2, vy: .6 + Math.random() * .5, phase: Math.random() * TAU });
      this.nextBubble = t + 250 + Math.random() * 500;
    }
    const g = this.leak.clear();
    this.bubbles = this.bubbles.filter(b => {
      b.y -= b.vy * dt; b.r += .012 * dt; b.phase += .08 * dt;
      const x = b.x + Math.sin(b.phase) * 2.5;
      g.circle(x, b.y, b.r).stroke({ width: 1.2, color: 0xd2f5ff, alpha: .75 });
      g.circle(x - b.r * .35, b.y - b.r * .35, b.r * .3).fill({ color: 0xffffff, alpha: .7 });
      return b.y > -this.y; // until it leaves the top of the screen
    });
  }

  private paint() {
    const t = this.tanks;
    if (!t || !this.W) return;
    const key = [t.fiveHour && [Math.round(t.fiveHour.left), t.fiveHour.refill], t.week && [Math.round(t.week.left), t.week.refill]].join('|');
    if (key === this.key) return;
    this.key = key;
    const old = this.art.texture;
    this.art.texture = paintTexture(CW * K, CH * K, this.res, g => {
      g.scale(K, K);
      paintTank(g, SLIM_X, BASE, SLIM, t.week); // behind, leaning on the big one
      paintTank(g, BIG_X, BASE, BIG, t.fiveHour);
      paintSlate(g, t);
    });
    if (old && old !== Texture.EMPTY) old.destroy(true);
  }
}

/** Where a tank's valve outlet is, in texture coordinates. */
function valve(cx: number, look: Look): [number, number] {
  const top = look.h + 18;
  return [cx + Math.sin(look.tilt) * top - 9, BASE - Math.cos(look.tilt) * top];
}

function airColor(air: Air) { return air.low ? '#ff5a6b' : air.warn ? '#ffc94d' : '#6fe3ff'; }

function outline(g: CanvasRenderingContext2D, p: Path2D, w: number) {
  g.strokeStyle = INK; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(p);
}
function toon(g: CanvasRenderingContext2D, p: Path2D, fill: string, w: number, inside?: () => void) {
  g.fillStyle = fill; g.fill(p);
  if (inside) { g.save(); g.clip(p); inside(); g.restore(); }
  outline(g, p, w);
}
function rect(x: number, y: number, w: number, h: number, r: number | number[]) { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; }
function circle(x: number, y: number, r: number) { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; }

/** A scuba tank standing on (cx, base), drawn upright and then tilted around its foot. */
function paintTank(g: CanvasRenderingContext2D, cx: number, base: number, look: Look, air: Air | null) {
  const { w, h } = look, L = -w / 2, top = -h;
  g.save();
  g.globalAlpha = .28; g.fillStyle = '#000'; g.beginPath(); g.ellipse(cx + 4, base + 2, w * .7, 5, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
  g.translate(cx, base); g.rotate(look.tilt);

  // valve: chrome neck and block, black handwheel on the right, outlet on the left
  const chrome = (p: Path2D, w: number) => toon(g, p, '#c4ced7', w, () => { g.fillStyle = '#8a9aa7'; g.fillRect(2, -h - 40, 20, 40); });
  chrome(rect(-6, top - 9, 12, 12, 2), 2);
  chrome(rect(-11, top - 22, 22, 14, 3), 2.2);
  chrome(rect(-17, top - 19, 7, 7, 1.5), 1.8);
  toon(g, circle(16, top - 15, 6.5), '#2b3740', 2, () => { g.fillStyle = '#56656f'; g.fill(circle(14.5, top - 16.5, 3)); });

  // body: domed shoulder, flat-ish foot, shaded right side and a shine down the left
  const body = rect(L, top, w, h, [w * .45, w * .45, 7, 7]);
  toon(g, body, look.body, 2.6, () => {
    g.fillStyle = look.shade; g.fillRect(w * .18, top, w * .4, h);
    g.fillStyle = look.light; g.fillRect(L + w * .14, top + h * .08, w * .1, h * .84);
    // white band on the shoulder with the stencilled window name
    g.fillStyle = '#f4f1e8'; g.fillRect(L, top + h * .13, w, 15);
    g.fillStyle = '#d8d2c0'; g.fillRect(w * .18, top + h * .13, w * .4, 15);
    g.fillStyle = INK; g.font = `800 ${w > 40 ? 10 : 8.5}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(look.label, 0, top + h * .13 + 8, w - 8);
  });
  const band = new Path2D(); band.moveTo(L, top + h * .13); band.lineTo(-L, top + h * .13); band.moveTo(L, top + h * .13 + 15); band.lineTo(-L, top + h * .13 + 15);
  outline(g, band, 1.4);

  // sight glass with the air left, ticks at every quarter
  const ww = w * .34, wy = top + h * .34, wh = h * .56, wx = -ww / 2;
  const glass = rect(wx, wy, ww, wh, ww / 2);
  toon(g, glass, '#173040', 2, () => {
    if (!air) return;
    const lh = wh * air.left / 100, col = airColor(air);
    g.fillStyle = col; g.fillRect(wx, wy + wh - lh, ww, lh);
    g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(wx, wy + wh - lh, ww, 2); // surface
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(wx + ww * .2, wy, ww * .18, wh); // shine
  });
  g.strokeStyle = INK; g.lineWidth = 1.4;
  for (let q = 1; q < 4; q++) { const y = wy + wh * q / 4; g.beginPath(); g.moveTo(wx + ww, y); g.lineTo(wx + ww + 4, y); g.stroke(); }
  if (!air) { g.fillStyle = '#9fb3c2'; g.font = `800 ${ww}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, wy + wh / 2); }
  g.restore();
}

/** The dive slate in the sand: a white board with a cord hole and two lines of pencil. */
function paintSlate(g: CanvasRenderingContext2D, t: Tanks) {
  const x = 6, w = CW - 12, y = SLATE_Y;
  toon(g, rect(x, y, w, SLATE_H, 5), '#eef3ef', 2, () => { g.fillStyle = '#d6ddd8'; g.fillRect(x, y + SLATE_H - 6, w, 6); });
  outline(g, circle(x + 8, y + 8, 2.4), 1.4);
  const line = (name: string, air: Air | null, ly: number) => {
    const text = !air ? `${name}  –` : `${name}  ${Math.floor(air.left)}% left${air.refill ? ` · refills ${air.refill}` : ''}`;
    g.fillStyle = air?.low ? RED : INK; g.font = `600 10.5px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(text, x + 16, ly, w - 22);
  };
  line('5h', t.fiveHour, y + 11);
  line('week', t.week, y + 25);
}
