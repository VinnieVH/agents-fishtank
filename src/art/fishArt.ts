import type { Texture } from 'pixi.js';
import type { Species } from '../species';
import { SPECIES } from '../species';
import { shade, TAU } from '../util';
import { canvasTexture, makeCanvas } from './canvas';

/** Everything that decides how a fish looks (derived from its session). */
export interface FishLook {
  species: Species;
  body: string;
  neon: string;
  pattern: number;
  variant: number;
  small: boolean;
  spots: { x: number; y: number; rx: number; ry: number; rot: number }[];
}

// Painters draw with Canvas 2D into this context; the result becomes a texture that a MeshRope bends while swimming.
let ctx: CanvasRenderingContext2D;

// ---------- cartoon style: ink outlines, big glossy eyes, shine spots ----------
function ink(col: string, s: number, alpha = 1, k = 1) {
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.1, s * .045) * k; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.globalAlpha = alpha; ctx.stroke(); ctx.globalAlpha = 1;
}
function shape(path: () => void, fill: string | CanvasGradient, inkCol: string, s: number) { path(); ctx.fillStyle = fill; ctx.fill(); ink(inkCol, s); }
function streaks(col: string, s: number, segs: number[][]) { // darker brush strokes on fins
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(.7, s * .025); ctx.lineCap = 'round'; ctx.globalAlpha = .55;
  ctx.beginPath(); for (const [x0, y0, x1, y1] of segs) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); } ctx.stroke();
  ctx.globalAlpha = 1;
}
function eye(x: number, y: number, r: number, inkCol: string) {
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = inkCol; ctx.lineWidth = Math.max(.8, r * .14); ctx.stroke();
  const ix = x + r * .2, iy = y + r * .06, ig = ctx.createRadialGradient(ix, iy, 0, ix, iy, r * .68);
  ig.addColorStop(0, '#fff7a8'); ig.addColorStop(.55, '#ffd21a'); ig.addColorStop(1, '#d99a00');
  ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, iy, r * .68, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1c2457'; ctx.beginPath(); ctx.arc(x + r * .3, y + r * .08, r * .4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + r * .14, y - r * .14, r * .17, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * .48, y + r * .3, r * .08, 0, TAU); ctx.fill();
}
function shine(x: number, y: number, rx: number, ry: number, rot: number, dots: number[][]) { // glossy highlight plus a few little sparkle spots
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  for (const [dx, dy, r] of dots) { ctx.beginPath(); ctx.arc(dx, dy, r, 0, TAU); ctx.fill(); }
}
function bodyFill(top: string, mid: string, bottom: string, y0: number, y1: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top); g.addColorStop(.5, mid); g.addColorStop(1, bottom);
  return g;
}
function pout(x: number, y: number, s: number, inkCol: string) { // small pouty mouth
  ctx.beginPath(); ctx.moveTo(x - s * .1, y + s * .02); ctx.quadraticCurveTo(x - s * .03, y + s * .07, x, y);
  ink(inkCol, s, .85, .8);
}

// Tropical fish
function tropicalBody(s: number) {
  ctx.beginPath();
  ctx.moveTo(s, 0);
  ctx.bezierCurveTo(s * .92, -s * .5, s * .2, -s * .64, -s * .42, -s * .4);
  ctx.quadraticCurveTo(-s * .78, -s * .22, -s * .9, 0);
  ctx.quadraticCurveTo(-s * .78, s * .22, -s * .42, s * .4);
  ctx.bezierCurveTo(s * .2, s * .58, s * .92, s * .46, s, 0);
  ctx.closePath();
}
function tropicalTail(s: number, w: number) {
  ctx.beginPath();
  ctx.moveTo(-s * .82, 0);
  ctx.quadraticCurveTo(-s * 1.15, -s * .1 + w * .5, -s * 1.5, -s * .58 + w);
  ctx.quadraticCurveTo(-s * 1.28, w * .7, -s * 1.5, s * .58 + w);
  ctx.quadraticCurveTo(-s * 1.15, s * .1 + w * .5, -s * .82, 0);
  ctx.closePath();
}
function drawTropical(f: FishLook, s: number, w: number, sway: number, ph: number) {
  const c = f.body, inkC = shade(c, -.62), fin = shade(c, -.1), str = shade(c, -.5);
  shape(() => { ctx.beginPath(); ctx.moveTo(-s * .38, -s * .38); ctx.quadraticCurveTo(-s * .2 + sway, -s * .98, s * .12 + sway, -s * .84);
    ctx.quadraticCurveTo(s * .3, -s * .64, s * .4, -s * .5); ctx.closePath(); }, fin, inkC, s);
  streaks(str, s, [[-s * .22, -s * .45, -s * .2 + sway, -s * .8], [-s * .02, -s * .5, s * .02 + sway, -s * .82], [s * .18, -s * .52, s * .16 + sway, -s * .72]]);
  shape(() => { ctx.beginPath(); ctx.moveTo(-s * .05, s * .44); ctx.quadraticCurveTo(-s * .35 - sway, s * .82, -s * .34 - sway, s * .8);
    ctx.quadraticCurveTo(-s * .05, s * .64, s * .18, s * .48); ctx.closePath(); }, fin, inkC, s);
  shape(() => tropicalTail(s, w), fin, inkC, s);
  streaks(str, s, [[-s * 1.0, -s * .1 + w * .5, -s * 1.38, -s * .45 + w], [-s * 1.0, 0 + w * .5, -s * 1.32, -s * .15 + w * .8], [-s * 1.0, w * .5, -s * 1.32, s * .15 + w * .8], [-s * 1.0, s * .1 + w * .5, -s * 1.38, s * .45 + w]]);

  ctx.fillStyle = bodyFill(shade(c, .3), c, shade(c, -.22), -s * .6, s * .55); tropicalBody(s); ctx.fill();
  ctx.save(); tropicalBody(s); ctx.clip();
  if (f.pattern === 0) {
    for (const bx of [s * .3, -s * .3]) {
      ctx.beginPath(); ctx.ellipse(bx, 0, s * .1, s * .7, 0, 0, TAU);
      ctx.fillStyle = '#fffaf0'; ctx.fill(); ink(inkC, s, .9, .8);
    }
  } else if (f.pattern === 1) {
    ctx.fillStyle = shade(c, -.4);
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-s * .6 + i * s * .2, -s * .2 + (i % 2) * s * .16, s * .06, 0, TAU); ctx.fill(); }
  } else {
    ctx.fillStyle = shade(c, .45); ctx.beginPath(); ctx.ellipse(-s * .1, s * .3, s * .8, s * .14, 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = shade(c, -.35); ctx.globalAlpha = .35; ctx.beginPath(); ctx.ellipse(0, s * .55, s, s * .16, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  shine(s * .12, -s * .3, s * .3, s * .08, -.18, [[-s * .3, -s * .18, s * .05], [-s * .42, -s * .06, s * .035], [-s * .2, -s * .02, s * .025]]);
  ctx.restore();
  tropicalBody(s); ink(inkC, s);

  ctx.beginPath(); ctx.arc(s * .3, 0, s * .3, -.9, .9); ink(inkC, s, .55, .8);
  ctx.save(); ctx.translate(s * .2, s * .16); ctx.rotate(.5 + Math.sin(ph * 1.6) * .35);
  shape(() => { ctx.beginPath(); ctx.ellipse(-s * .14, 0, s * .2, s * .085, 0, 0, TAU); }, fin, inkC, s); ctx.restore();
  eye(s * .56, -s * .13, s * .19, inkC);
  pout(s * .99, s * .06, s, inkC);
}

// Koi: long body, patterned, whiskers, flowing tail
const KOI = [
  { base: '#f6f1e7', spots: ['#e8452c'] },                       // kohaku
  { base: '#f6f1e7', spots: ['#e8452c', '#e8452c', '#1b1b1f'] }, // sanke
  { base: '#f5b82e', spots: [] },                                // yamabuki (gold)
  { base: '#1e1e24', spots: ['#e8452c', '#f6f1e7'] },            // showa
];
function koiBody(s: number) {
  ctx.beginPath(); ctx.moveTo(s, 0);
  ctx.bezierCurveTo(s * .95, -s * .32, s * .45, -s * .45, -s * .15, -s * .38);
  ctx.quadraticCurveTo(-s * .65, -s * .3, -s * .95, -s * .07);
  ctx.lineTo(-s * .95, s * .07);
  ctx.quadraticCurveTo(-s * .65, s * .28, -s * .15, s * .34);
  ctx.bezierCurveTo(s * .45, s * .42, s * .95, s * .3, s, 0);
  ctx.closePath();
}
function koiTail(s: number, w: number) {
  ctx.beginPath(); ctx.moveTo(-s * .9, 0);
  ctx.bezierCurveTo(-s * 1.15, -s * .1 + w * .4, -s * 1.4, -s * .35 + w * .8, -s * 1.75, -s * .55 + w);
  ctx.quadraticCurveTo(-s * 1.45, -s * .15 + w * .8, -s * 1.42, w * .8);
  ctx.quadraticCurveTo(-s * 1.45, s * .15 + w * .8, -s * 1.75, s * .55 + w);
  ctx.bezierCurveTo(-s * 1.4, s * .35 + w * .8, -s * 1.15, s * .1 + w * .4, -s * .9, 0);
  ctx.closePath();
}
function drawKoi(f: FishLook, s: number, w: number, sway: number, ph: number) {
  const v = KOI[f.variant % KOI.length], dark = v.base === '#1e1e24';
  const inkC = dark ? '#0b0b10' : v.spots.length ? '#5b3a30' : shade(v.base, -.62);
  const fin = dark ? '#4a4a55' : v.spots.length ? '#f3e6d6' : shade(v.base, .2), str = dark ? '#22222a' : shade(v.spots[0] || v.base, -.2);
  ctx.globalAlpha = .9; shape(() => koiTail(s, w), fin, inkC, s); ctx.globalAlpha = 1;
  streaks(str, s, [[-s * 1.05, -s * .05 + w * .5, -s * 1.62, -s * .45 + w], [-s * 1.05, w * .5, -s * 1.48, -s * .15 + w * .85], [-s * 1.05, w * .5, -s * 1.48, s * .15 + w * .85], [-s * 1.05, s * .05 + w * .5, -s * 1.62, s * .45 + w]]);
  shape(() => { ctx.beginPath(); ctx.moveTo(-s * .55, -s * .32); ctx.quadraticCurveTo(-s * .3 + sway, -s * .64, s * .2 + sway, -s * .52);
    ctx.lineTo(s * .28, -s * .4); ctx.closePath(); }, fin, inkC, s);
  shape(() => { ctx.beginPath(); ctx.moveTo(-s * .05, s * .32); ctx.quadraticCurveTo(-s * .25 - sway, s * .62, -s * .3 - sway, s * .56);
    ctx.quadraticCurveTo(-s * .15, s * .42, -s * .2, s * .33); ctx.closePath(); }, fin, inkC, s);

  ctx.fillStyle = bodyFill(shade(v.base, dark ? .15 : .25), v.base, shade(v.base, -.18), -s * .44, s * .4); koiBody(s); ctx.fill();
  ctx.save(); koiBody(s); ctx.clip();
  if (v.spots.length) f.spots.forEach((p, i) => {
    ctx.fillStyle = v.spots[i % v.spots.length];
    ctx.beginPath(); ctx.ellipse(p.x * s, p.y * s, p.rx * s, p.ry * s, p.rot, 0, TAU); ctx.fill();
  });
  ctx.fillStyle = '#000'; ctx.globalAlpha = .12; ctx.beginPath(); ctx.ellipse(0, s * .42, s, s * .14, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  shine(s * .2, -s * .22, s * .38, s * .07, -.08, [[-s * .25, -s * .2, s * .045], [-s * .4, -s * .1, s * .03]]);
  ctx.restore();
  koiBody(s); ink(inkC, s);

  ctx.save(); ctx.translate(s * .45, s * .22); ctx.rotate(.6 + Math.sin(ph * 1.2) * .35);
  shape(() => { ctx.beginPath(); ctx.ellipse(-s * .16, 0, s * .26, s * .1, 0, 0, TAU); }, fin, inkC, s); ctx.restore();
  for (const [x0, x1] of [[s * .94, s * .96], [s * .88, s * .82]]) {
    ctx.beginPath(); ctx.moveTo(x0, s * .1); ctx.quadraticCurveTo(x0 + s * .06, s * .2, x1 + sway * .3, s * .32); ink(inkC, s, .8, .7);
  }
  eye(s * .68, -s * .1, s * .13, inkC);
  pout(s, s * .04, s, inkC);
}

// Sturgeon: long armored body, pointed snout, barbels, shark-like (heterocercal) tail
const STURGEON = ['#5f7a96', '#7d7458', '#5a7566'];
function sturgeonBody(s: number) {
  ctx.beginPath(); ctx.moveTo(s * 1.3, s * .05);
  ctx.quadraticCurveTo(s * 1.0, -s * .2, s * .6, -s * .28);
  ctx.bezierCurveTo(s * .1, -s * .36, -s * .6, -s * .24, -s * 1.0, -s * .08);
  ctx.lineTo(-s * 1.0, s * .06);
  ctx.bezierCurveTo(-s * .6, s * .22, s * .1, s * .3, s * .6, s * .22);
  ctx.quadraticCurveTo(s * 1.0, s * .16, s * 1.3, s * .05);
  ctx.closePath();
}
function sturgeonTail(s: number, w: number) {
  ctx.beginPath(); ctx.moveTo(-s * .95, -s * .07);
  ctx.quadraticCurveTo(-s * 1.3, -s * .28 + w * .6, -s * 1.78, -s * .6 + w);
  ctx.quadraticCurveTo(-s * 1.5, -s * .12 + w * .8, -s * 1.38, s * .28 + w * .8);
  ctx.quadraticCurveTo(-s * 1.2, s * .1 + w * .4, -s * .95, s * .06);
  ctx.closePath();
}
function scute(x: number, y: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x, y - r * .7); ctx.lineTo(x - r, y); ctx.lineTo(x, y + r * .7); ctx.closePath();
  ctx.fill(); ctx.stroke();
}
function drawSturgeon(f: FishLook, s: number, w: number, sway: number, ph: number) {
  const base = STURGEON[f.variant % STURGEON.length], inkC = shade(base, -.65), fin = shade(base, -.05), str = shade(base, -.45);
  shape(() => sturgeonTail(s, w), fin, inkC, s);
  streaks(str, s, [[-s * 1.1, -s * .12 + w * .5, -s * 1.62, -s * .5 + w], [-s * 1.1, -s * .02 + w * .5, -s * 1.5, -s * .2 + w * .8], [-s * 1.1, s * .05 + w * .5, -s * 1.38, s * .2 + w * .8]]);
  shape(() => { ctx.beginPath(); ctx.moveTo(-s * .5, -s * .2); ctx.quadraticCurveTo(-s * .7 + sway, -s * .47, -s * .85 + sway, -s * .42);
    ctx.lineTo(-s * .8, -s * .12); ctx.closePath(); }, fin, inkC, s);
  shape(() => { ctx.beginPath(); ctx.moveTo(-s * .55, s * .16); ctx.quadraticCurveTo(-s * .7 - sway, s * .36, -s * .8 - sway, s * .32);
    ctx.lineTo(-s * .78, s * .1); ctx.closePath(); }, fin, inkC, s);

  const bg = ctx.createLinearGradient(0, -s * .36, 0, s * .3);
  bg.addColorStop(0, shade(base, .2)); bg.addColorStop(.5, base); bg.addColorStop(.72, shade(base, .5)); bg.addColorStop(1, '#efe9da');
  ctx.fillStyle = bg; sturgeonBody(s); ctx.fill();
  ctx.save(); sturgeonBody(s); ctx.clip();
  ctx.fillStyle = shade(base, -.4);
  f.spots.forEach(p => { ctx.beginPath(); ctx.arc(p.x * 1.2 * s, (p.y * .45 - .05) * s, s * .028, 0, TAU); ctx.fill(); });
  shine(s * .35, -s * .2, s * .4, s * .05, -.08, [[-s * .3, -s * .18, s * .035], [-s * .5, -s * .14, s * .025]]);
  ctx.restore();
  sturgeonBody(s); ink(inkC, s);

  ctx.fillStyle = shade(base, .55); ctx.strokeStyle = inkC; ctx.lineWidth = Math.max(.7, s * .022);
  const top = (x: number) => -s * .36 * (1 - Math.pow((x + s * .05) / (s * 1.1), 2));
  for (let i = 0; i < 9; i++) { const x = s * .5 - i * s * .16; scute(x, top(x) + s * .03, s * .06); }
  for (let i = 0; i < 11; i++) scute(s * .55 - i * s * .14, s * .02, s * .038);

  ctx.save(); ctx.translate(s * .55, s * .18); ctx.rotate(.5 + Math.sin(ph * 1.1) * .25);
  shape(() => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-s * .2, s * .05, -s * .38, s * .12);
    ctx.quadraticCurveTo(-s * .2, -s * .02, 0, 0); }, fin, inkC, s); ctx.restore();

  for (let i = 0; i < 4; i++) {
    const x = s * (.92 + i * .055); ctx.beginPath(); ctx.moveTo(x, s * .14); ctx.lineTo(x - s * .02 + sway * .2, s * .27);
    ink('#e9dcb8', s, 1, .7);
  }
  ctx.beginPath(); ctx.moveTo(s * .76, s * .19); ctx.quadraticCurveTo(s * .82, s * .22, s * .88, s * .18); ink(inkC, s, .8, .8);
  eye(s * .8, -s * .07, s * .1, inkC);
}

// Angelfish: tall striped disc with long trailing fins
const ANGEL = ['#e3e6ea', '#f2c14e', '#d7c7e8'];
function angelBody(s: number) {
  ctx.beginPath(); ctx.moveTo(s * .85, s * .02);
  ctx.quadraticCurveTo(s * .65, -s * .44, s * .05, -s * .54);
  ctx.quadraticCurveTo(-s * .45, -s * .45, -s * .55, 0);
  ctx.quadraticCurveTo(-s * .45, s * .45, s * .05, s * .54);
  ctx.quadraticCurveTo(s * .65, s * .44, s * .85, s * .02);
  ctx.closePath();
}
function angelFin(s: number, sway: number, d: number) { // d = -1 dorsal, 1 anal
  ctx.beginPath(); ctx.moveTo(s * .2, d * s * .48);
  ctx.bezierCurveTo(-s * .05, d * s * 1.1, -s * .45 + sway, d * s * 1.45, -s * .95 + sway, d * s * 1.55);
  ctx.quadraticCurveTo(-s * .55, d * s * .9, -s * .5, d * s * .25);
  ctx.closePath();
}
function angelTail(s: number, w: number) {
  ctx.beginPath(); ctx.moveTo(-s * .5, 0);
  ctx.quadraticCurveTo(-s * .8, -s * .32 + w * .6, -s * 1.05, -s * .42 + w);
  ctx.quadraticCurveTo(-s * .95, w, -s * 1.05, s * .42 + w);
  ctx.quadraticCurveTo(-s * .8, s * .32 + w * .6, -s * .5, 0);
  ctx.closePath();
}
function drawAngel(f: FishLook, s: number, w: number, sway: number, ph: number) {
  const base = ANGEL[f.variant % ANGEL.length], inkC = shade(base, -.72), fin = shade(base, -.06), stripe = shade(base, -.7);
  for (const [x, y, d] of [[-s * 1.05, -s * .42 + w, -1], [-s * 1.05, s * .42 + w, 1]]) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(-s * 1.2, y + d * s * .08, -s * 1.4 + sway * -d, y + d * s * .03); ink(inkC, s, .9);
  }
  ctx.beginPath(); ctx.moveTo(s * .3, s * .45); ctx.quadraticCurveTo(s * .1, s * .9, -s * .25 + sway, s * 1.25); ink(inkC, s, .9);
  shape(() => angelTail(s, w), fin, inkC, s);
  streaks(shade(base, -.4), s, [[-s * .7, -s * .08 + w * .4, -s * .98, -s * .32 + w], [-s * .7, w * .4, -s * .95, w], [-s * .7, s * .08 + w * .4, -s * .98, s * .32 + w]]);

  for (const [path, fill] of [[() => angelFin(s, sway, -1), fin], [() => angelFin(s, -sway, 1), fin], [() => angelBody(s), null]] as [() => void, string | null][]) {
    path(); ctx.fillStyle = fill || bodyFill(shade(base, .3), base, shade(base, -.15), -s * .54, s * .54); ctx.fill();
    ctx.save(); path(); ctx.clip();
    ctx.fillStyle = stripe;
    for (const x of [.42, .02, -.4]) ctx.fillRect(x * s - s * .05, -s * 1.6, s * .1, s * 3.2);
    if (!fill) shine(s * .2, -s * .3, s * .22, s * .07, -.4, [[-s * .2, -s * .3, s * .04], [-s * .26, -s * .16, s * .03]]);
    ctx.restore();
    path(); ink(inkC, s);
  }
  eye(s * .52, -s * .12, s * .14, inkC);
  pout(s * .85, s * .04, s, inkC);
}

// Pufferfish: round, spiky, big eyes, tiny fluttering fins
const PUFFER = ['#f0c955', '#a8cf6a', '#e3a868'];
function pufferBody(s: number) { ctx.beginPath(); ctx.ellipse(s * .05, 0, s * .62, s * .55, 0, 0, TAU); }
function pufferTail(s: number, w: number) {
  ctx.beginPath(); ctx.moveTo(-s * .5, 0);
  ctx.quadraticCurveTo(-s * .72, -s * .26 + w * .6, -s * .92, -s * .24 + w);
  ctx.quadraticCurveTo(-s * .82, w, -s * .92, s * .24 + w);
  ctx.quadraticCurveTo(-s * .72, s * .26 + w * .6, -s * .5, 0);
  ctx.closePath();
}
function drawPuffer(f: FishLook, s: number, w: number, sway: number, ph: number) {
  const base = PUFFER[f.variant % PUFFER.length], inkC = shade(base, -.68), fin = shade(base, -.08);
  shape(() => pufferTail(s, w), fin, inkC, s);
  streaks(shade(base, -.45), s, [[-s * .62, -s * .04 + w * .5, -s * .86, -s * .18 + w], [-s * .62, s * .04 + w * .5, -s * .86, s * .18 + w]]);
  for (const d of [-1, 1]) {
    shape(() => { ctx.beginPath(); ctx.moveTo(-s * .3, d * s * .45); ctx.quadraticCurveTo(-s * .5 + sway * d, d * s * .74, -s * .56, d * s * .5); ctx.closePath(); }, fin, inkC, s);
  }
  ctx.fillStyle = shade(base, -.1); ctx.strokeStyle = inkC; ctx.lineWidth = Math.max(.7, s * .02); ctx.lineJoin = 'round';
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * TAU, ex = Math.cos(a), ey = Math.sin(a), cx = s * .05;
    const bx = cx + ex * s * .58, by = ey * s * .51, k = s * .045;
    ctx.beginPath(); ctx.moveTo(bx - ey * k, by + ex * k); ctx.lineTo(cx + ex * s * .74, ey * s * .67); ctx.lineTo(bx + ey * k, by - ex * k); ctx.fill(); ctx.stroke();
  }
  const bg = ctx.createRadialGradient(-s * .05, -s * .22, s * .08, s * .05, 0, s * .65);
  bg.addColorStop(0, shade(base, .35)); bg.addColorStop(1, shade(base, -.1));
  ctx.fillStyle = bg; pufferBody(s); ctx.fill();
  ctx.save(); pufferBody(s); ctx.clip();
  ctx.fillStyle = '#fbf7ec'; ctx.beginPath(); ctx.ellipse(s * .05, s * .4, s * .62, s * .32, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(base, -.45);
  f.spots.forEach(p => { ctx.beginPath(); ctx.arc(p.x * .5 * s - s * .1, (p.y * .6 - .1) * s, s * .045, 0, TAU); ctx.fill(); });
  shine(-s * .12, -s * .32, s * .22, s * .08, -.5, [[-s * .36, -s * .14, s * .045], [-s * .3, -s * .02, s * .03]]);
  ctx.restore();
  pufferBody(s); ink(inkC, s);
  ctx.save(); ctx.translate(s * .12, s * .1); ctx.rotate(Math.sin(ph * 3) * .5);
  shape(() => { ctx.beginPath(); ctx.ellipse(-s * .1, 0, s * .14, s * .07, 0, 0, TAU); }, fin, inkC, s);
  ctx.restore();
  eye(s * .4, -s * .16, s * .2, inkC);
  ctx.beginPath(); ctx.ellipse(s * .66, s * .1, s * .05, s * .045, 0, 0, TAU); ctx.fillStyle = '#c4574a'; ctx.fill(); ink(inkC, s, .9, .7);
}


type Painter = (f: FishLook, s: number, w: number, sway: number, ph: number) => void;
const PAINT: Record<Species, Painter> = { tropical: drawTropical, koi: drawKoi, sturgeon: drawSturgeon, angelfish: drawAngel, puffer: drawPuffer };
const OUTLINE: Record<Species, (s: number) => (() => void)[]> = {
  tropical: s => [() => tropicalTail(s, 0), () => tropicalBody(s)],
  koi: s => [() => koiTail(s, 0), () => koiBody(s)],
  sturgeon: s => [() => sturgeonTail(s, 0), () => sturgeonBody(s)],
  angelfish: s => [() => angelTail(s, 0), () => angelFin(s, 0, -1), () => angelFin(s, 0, 1), () => angelBody(s)],
  puffer: s => [() => pufferTail(s, 0), () => pufferBody(s)],
};

export interface FishTextures {
  body: Texture;
  /** neon rim in the session colour, drawn behind the body */
  halo: Texture;
  /** position of the fish origin (body centre) inside the textures, in px */
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** Paints a fish of body size s facing right, in its resting pose. */
export function paintFish(f: FishLook, s: number, res: number): FishTextures {
  const [l, t, r, b] = SPECIES[f.species].bounds;
  const blur = f.small ? 8 : 16, pad = blur + s * .08 + 4;
  const width = Math.ceil((r - l) * s + pad * 2), height = Math.ceil((b - t) * s + pad * 2);
  const originX = pad - l * s, originY = pad - t * s;

  const body = makeCanvas(width, height, res);
  ctx = body.g; ctx.translate(originX, originY);
  PAINT[f.species](f, s, 0, 0, 0);

  const halo = makeCanvas(width, height, res);
  ctx = halo.g; ctx.translate(originX, originY);
  ctx.shadowColor = f.neon; ctx.shadowBlur = blur;
  ctx.strokeStyle = f.neon; ctx.lineWidth = s * .1 + 1; ctx.lineJoin = 'round';
  for (const p of OUTLINE[f.species](s)) { p(); ctx.stroke(); }

  return { body: canvasTexture(body.c, res), halo: canvasTexture(halo.c, res), originX, originY, width, height };
}