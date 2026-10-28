import { Container, Sprite, Texture } from 'pixi.js';
import { paintTexture } from '../art/canvas';
import type { Credits } from '../credits';
import { nightTint, TAU } from '../util';

// A cartoon pressure gauge mounted on a pipe coming up from the bottom of the window (in front of the tank glass), showing the Copilot credits used (0..100%), with a red zone for the last 20%.
const INK = '#1d2a33', RED = '#c81f33', FONT = '"Segoe UI", system-ui, sans-serif';
/** Dial angle for a value 0..100: 0 at lower-left, 50 straight up, 100 at lower-right (240° sweep). */
const dial = (v: number) => (-210 + 240 * v / 100) * Math.PI / 180;

export class Gauge extends Container {
  private body = new Sprite(); // bezel, pipe and plaque: darken at night like the scenery
  private face = new Sprite(); // the dial is lit, so it stays bright
  private glow = new Sprite();
  private needle = new Sprite();
  private glass = new Sprite();
  private c: Credits | null = null;
  private W = 0; private H = 0; private r = 60; private key = '';
  private v = 0; private vel = 0;

  constructor(private res: number) {
    super();
    this.glow.blendMode = 'add'; this.glow.alpha = 0;
    this.addChild(this.body, this.face, this.glow, this.needle, this.glass);
    this.visible = false;
  }

  set(c: Credits | null) { this.c = c; this.visible = !!c; this.paint(); }

  layout(W: number, H: number) { this.W = W; this.H = H; this.paint(); }

  update(t: number, dt: number, night: number) {
    if (!this.c) return;
    this.body.tint = nightTint(night); // it stands in front of the night overlay
    const target = this.c.unlimited ? 0 : Math.min(100, Math.max(0, this.c.usedPct)), red = target >= 80;
    // springy needle (sweeps up with a little overshoot on load) plus a pressure quiver, nervier in the red zone
    this.vel += (target - this.v) * .02 * dt; this.vel *= Math.pow(.86, dt); this.v += this.vel * dt;
    const quiver = (Math.sin(t * .013) * .25 + Math.sin(t * .031 + 1) * .15) * (red ? 2.5 : 1);
    this.needle.rotation = dial(Math.min(101.5, Math.max(-1.5, this.v + quiver))) + Math.PI / 2;
    this.glow.alpha = red ? .2 + .4 * (.5 + .5 * Math.sin(t * (this.c.low ? .008 : .003))) : 0;
  }

  private paint() {
    const c = this.c;
    if (!c || !this.W) return;
    const mounted = this.W >= 760; // on narrow screens the panel sits at the bottom, so hang the gauge top-right
    const r = mounted ? 74 : 54, C = r + 8;
    const cy = mounted ? this.H - r - 52 : r + 18, cx = this.W - r - (mounted ? 44 : 18);
    const stem = mounted ? this.H + 4 - (cy + r) : 0; // runs off the bottom edge of the page
    this.position.set(cx - C, cy - C);
    const used = c.unlimited ? '∞' : `${Math.floor(c.usedPct)}%`;
    const left = c.unlimited ? 'unlimited' : `${c.left.toLocaleString()} left`;
    const reset = [left, c.reset ? `resets ${c.reset.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}` : ''].filter(Boolean).join(' · ');
    const key = [r, stem, used, reset, c.usedPct >= 80].join('|');
    if (key === this.key) return;
    const geomChanged = r !== this.r || !this.needle.texture || this.needle.texture === Texture.EMPTY;
    this.key = key; this.r = r;

    const size = 2 * C, h = size + stem;
    swap(this.body, paintTexture(size, h, this.res, g => paintBody(g, C, r, stem, reset)));
    swap(this.face, paintTexture(size, size, this.res, g => paintFace(g, C, r, used, c.usedPct >= 80)));
    if (geomChanged) {
      swap(this.glow, paintTexture(size, size, this.res, g => paintRedZone(g, C, r, true)));
      swap(this.glass, paintTexture(size, size, this.res, g => paintGlass(g, C, r)));
      const nw = 22, tip = r * .72, tail = r * .2, nh = tip + tail + 22;
      swap(this.needle, paintTexture(nw, nh, this.res, g => paintNeedle(g, nw / 2, 11 + tip, tip, tail)));
      this.needle.anchor.set(.5, (11 + tip) / nh);
      this.needle.position.set(C, C);
    }
  }
}

function swap(s: Sprite, tex: Texture) {
  const old = s.texture;
  s.texture = tex;
  if (old && old !== Texture.EMPTY) old.destroy(true);
}

function circle(x: number, y: number, r: number) { const p = new Path2D(); p.arc(x, y, r, 0, TAU); return p; }
function outline(g: CanvasRenderingContext2D, p: Path2D, col: string, w: number) {
  g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(p);
}
function toon(g: CanvasRenderingContext2D, p: Path2D, fill: string, w: number, inside?: () => void) {
  g.fillStyle = fill; g.fill(p);
  if (inside) { g.save(); g.clip(p); inside(); g.restore(); }
  outline(g, p, INK, w);
}

function paintRedZone(g: CanvasRenderingContext2D, C: number, r: number, glow = false) {
  const z = new Path2D();
  z.arc(C, C, r * .78, dial(80), dial(100)); z.arc(C, C, r * .6, dial(100), dial(80), true); z.closePath();
  if (glow) { g.shadowColor = '#ff3b4f'; g.shadowBlur = 10; g.fillStyle = '#ff6b7a'; g.fill(z); g.fill(z); return; }
  g.fillStyle = '#ff5a6b'; g.fill(z);
  g.save(); g.clip(z); g.fillStyle = '#ff8a96'; g.fill(circle(C - r * .05, C - r * .05, r * .7)); g.restore(); // lit inner edge
  outline(g, z, INK, 1.2);
}

function paintBody(g: CanvasRenderingContext2D, C: number, r: number, stem: number, plaque: string) {
  // brass stem with a hex nut, threads and a little plaque with the credits left and the reset date, running down off the bottom of the page
  if (stem > 0) {
    const pipe = new Path2D(); pipe.rect(C - 7, C + r * .8, 14, stem + r * .2);
    toon(g, pipe, '#d4ad52', 2.2, () => {
      g.fillStyle = '#a77f2a'; g.fillRect(C + 2, C + r * .8, 6, stem + r);
      g.fillStyle = '#f3d98c'; g.fillRect(C - 5, C + r * .8, 2.5, stem + r);
      for (let y = C + r + 26; y < C + r + stem; y += 4) { g.fillStyle = 'rgba(80,55,10,.45)'; g.fillRect(C - 7, y, 14, 1.3); }
    });
    const nut = new Path2D(); nut.roundRect(C - 13, C + r - 3, 26, 14, 2);
    toon(g, nut, '#e2bf62', 2.2, () => { g.fillStyle = '#b48b33'; g.fillRect(C + 4, C + r - 3, 9, 14); g.fillStyle = '#fbe7a6'; g.fillRect(C - 10, C + r - 3, 3, 14); });
    if (plaque) {
      g.font = `600 ${r * .13}px ${FONT}`;
      const w = g.measureText(plaque).width + 14, py = C + r + 17;
      const plate = new Path2D(); plate.roundRect(C - w / 2, py, w, r * .25, 4);
      toon(g, plate, '#f1e3b5', 1.8, () => { g.fillStyle = '#d9c588'; g.fillRect(C - w / 2, py + r * .19, w, 6); });
      g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(plaque, C, py + r * .135);
    }
  }

  // steel bezel with a shaded lower-right side and a shine on the upper-left
  toon(g, circle(C, C, r), '#c4ced7', 3, () => {
    g.fillStyle = '#8a9aa7'; g.fill(circle(C + r * .2, C + r * .22, r * .95));
    g.fillStyle = '#c4ced7'; g.fill(circle(C - r * .04, C - r * .04, r * .9));
    g.strokeStyle = '#ffffff'; g.lineWidth = r * .06; g.lineCap = 'round';
    g.beginPath(); g.arc(C, C, r * .93, Math.PI * 1.08, Math.PI * 1.42); g.stroke();
  });
}

function paintFace(g: CanvasRenderingContext2D, C: number, r: number, used: string, red: boolean) {
  toon(g, circle(C, C, r * .85), '#fbf7ec', 2.2, () => {
    g.fillStyle = '#e9e2cf'; g.fill(circle(C, C, r * .85));
    g.fillStyle = '#fbf7ec'; g.fill(circle(C - r * .05, C - r * .06, r * .8));
  });
  paintRedZone(g, C, r);

  // ticks every 2%, long ones every 10%, numbers every 20%
  g.lineCap = 'round';
  for (let v = 0; v <= 100; v += 2) {
    const a = dial(v), major = v % 10 === 0, r1 = r * .78, r0 = r1 - (major ? r * .17 : r * .08);
    g.strokeStyle = INK; g.lineWidth = major ? 2.4 : 1.1;
    g.beginPath(); g.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0); g.lineTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1); g.stroke();
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `800 ${r * .16}px ${FONT}`;
  for (let v = 0; v <= 100; v += 20) {
    const a = dial(v);
    g.fillStyle = v >= 80 ? RED : INK;
    g.fillText(String(v), C + Math.cos(a) * r * .5, C + Math.sin(a) * r * .5 + 1);
  }

  g.fillStyle = '#5d6b76'; g.font = `700 ${r * .095}px ${FONT}`;
  g.fillText('CREDITS USED', C, C + r * .64);
  g.fillStyle = red ? RED : INK; g.font = `800 ${r * .23}px ${FONT}`;
  g.fillText(used, C, C + r * .43);
}

function paintNeedle(g: CanvasRenderingContext2D, x: number, hub: number, tip: number, tail: number) {
  const n = new Path2D();
  n.moveTo(x, hub - tip); n.lineTo(x + 4, hub); n.lineTo(x + 2.6, hub + tail); n.lineTo(x - 2.6, hub + tail); n.lineTo(x - 4, hub); n.closePath();
  g.save(); g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 3; g.shadowOffsetY = 2; g.fillStyle = '#2b3740'; g.fill(n); g.restore();
  toon(g, n, '#2b3740', 1.4, () => { g.fillStyle = '#56656f'; g.fillRect(x - 4, hub - tip, 3, tip + tail); });
  toon(g, circle(x, hub, 7), '#c4ced7', 2, () => {
    g.fillStyle = '#8a9aa7'; g.fill(circle(x + 2, hub + 2, 6));
    g.fillStyle = '#ffffff'; g.fill(circle(x - 2.2, hub - 2.2, 1.8));
  });
  g.fillStyle = INK; g.fill(circle(x, hub, 1.6));
}

function paintGlass(g: CanvasRenderingContext2D, C: number, r: number) {
  // curved reflection on the glass, upper left, and a small glint lower right
  const s = new Path2D();
  s.arc(C, C, r * .8, Math.PI * 1.02, Math.PI * 1.55);
  s.arc(C + r * .12, C + r * .14, r * .78, Math.PI * 1.5, Math.PI * 1.08, true); s.closePath();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(s);
  g.fillStyle = 'rgba(255,255,255,.5)';
  g.beginPath(); g.ellipse(C + r * .5, C + r * .45, r * .07, r * .035, -.8, 0, TAU); g.fill();
}
