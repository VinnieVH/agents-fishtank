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

/** A limb, arm or antenna: a tapering tube with an ink edge, following the given curve. */
function tube(path: () => void, width: number, fill: string, inkCol: string, s: number) {
  const edge = Math.max(1.1, s * .045);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  path(); ctx.strokeStyle = inkCol; ctx.lineWidth = width + edge * 2; ctx.stroke();
  path(); ctx.strokeStyle = fill; ctx.lineWidth = width; ctx.stroke();
}

// Squid: swims mantle first, fins at the tip, big eyes, arms and two long tentacles trailing behind
const SQUID = ['#ff8fa3', '#c38bff', '#ffb36b', '#7fe0ff'];
function squidMantle(s: number) {
  ctx.beginPath(); ctx.moveTo(s * 1.12, 0);
  ctx.bezierCurveTo(s * .95, -s * .3, s * .2, -s * .4, -s * .42, -s * .34);
  ctx.quadraticCurveTo(-s * .6, 0, -s * .42, s * .34);
  ctx.bezierCurveTo(s * .2, s * .4, s * .95, s * .3, s * 1.12, 0);
  ctx.closePath();
}
function squidFins(s: number) {
  ctx.beginPath();
  for (const d of [-1, 1]) { ctx.moveTo(s * 1.1, 0); ctx.quadraticCurveTo(s * .95, d * s * .55, s * .62, d * s * .58); ctx.quadraticCurveTo(s * .6, d * s * .3, s * .42, d * s * .3); }
  ctx.closePath();
}
function squidHead(s: number) { ctx.beginPath(); ctx.ellipse(-s * .58, 0, s * .26, s * .27, 0, 0, TAU); }
function drawSquid(f: FishLook, s: number) {
  const base = SQUID[f.variant % SQUID.length], inkC = shade(base, -.65), arm = shade(base, -.08), dark = shade(base, -.3);
  // arms (eight short, two long tentacles with clubs), drawn first so the head covers their roots
  const arms = [-.2, -.13, -.06, 0, .06, .13, .2].map((y, i) => [y, 1.3 + (i % 3) * .1] as const);
  for (const [y, len] of arms) tube(() => { ctx.beginPath(); ctx.moveTo(-s * .7, y * s);
    ctx.bezierCurveTo(-s * 1, y * s * 1.6 + s * .05, -s * 1.15, y * s * 2 - s * .05, -s * len, y * s * 2.2); }, s * .07, arm, inkC, s);
  for (const d of [-1, 1]) {
    tube(() => { ctx.beginPath(); ctx.moveTo(-s * .7, d * s * .05); ctx.bezierCurveTo(-s * 1.1, d * s * .2, -s * 1.35, -d * s * .05, -s * 1.62, d * s * .18); }, s * .045, arm, inkC, s);
    shape(() => { ctx.beginPath(); ctx.ellipse(-s * 1.66, d * s * .19, s * .1, s * .05, d * .3, 0, TAU); }, arm, inkC, s);
  }
  shape(() => squidFins(s), shade(base, .1), inkC, s);
  ctx.fillStyle = bodyFill(shade(base, .35), base, shade(base, -.2), -s * .4, s * .4); squidMantle(s); ctx.fill();
  ctx.save(); squidMantle(s); ctx.clip();
  ctx.fillStyle = dark; ctx.globalAlpha = .5; // chromatophore spots
  f.spots.forEach(p => { ctx.beginPath(); ctx.arc((p.x * .7 + .35) * s, p.y * .7 * s, s * (.04 + p.rx * .15), 0, TAU); ctx.fill(); });
  ctx.globalAlpha = 1;
  shine(s * .35, -s * .2, s * .38, s * .06, -.05, [[s * .85, -s * .1, s * .035], [-s * .05, -s * .22, s * .03]]);
  ctx.restore();
  squidMantle(s); ink(inkC, s);
  shape(() => squidHead(s), bodyFill(shade(base, .25), base, shade(base, -.15), -s * .27, s * .27), inkC, s);
  eye(-s * .55, -s * .06, s * .2, inkC);
}

// Shrimp: curved, segmented, a spiky rostrum, long antennae sweeping back, little legs and a tail fan
const SHRIMP = ['#ff8a6b', '#ff6f91', '#ffa94d', '#ff5c5c'];
function shrimpBody(s: number) {
  ctx.beginPath(); ctx.moveTo(s * .85, -s * .06);
  ctx.bezierCurveTo(s * .72, -s * .52, -s * .2, -s * .6, -s * .86, -s * .16);
  ctx.lineTo(-s * .9, s * .06);
  ctx.bezierCurveTo(-s * .3, s * .14, s * .3, s * .32, s * .85, s * .12);
  ctx.closePath();
}
function shrimpTail(s: number) {
  ctx.beginPath(); ctx.moveTo(-s * .84, -s * .08);
  ctx.quadraticCurveTo(-s * 1.05, -s * .42, -s * 1.28, -s * .36);
  ctx.quadraticCurveTo(-s * 1.2, -s * .1, -s * 1.34, s * .02);
  ctx.quadraticCurveTo(-s * 1.18, s * .14, -s * 1.24, s * .34);
  ctx.quadraticCurveTo(-s * 1.02, s * .3, -s * .86, s * .06);
  ctx.closePath();
}
function drawShrimp(f: FishLook, s: number) {
  const base = SHRIMP[f.variant % SHRIMP.length], inkC = shade(base, -.65), limb = shade(base, -.12);
  for (const [x, len] of [[.5, .2], [.3, .26], [.1, .28], [-.12, .26], [-.34, .22]]) // walking and swimming legs
    tube(() => { ctx.beginPath(); ctx.moveTo(x * s, s * .16); ctx.quadraticCurveTo((x - .02) * s, (.2 + len * .6) * s, (x - .08) * s, (.2 + len) * s); }, s * .035, limb, inkC, s);
  tube(() => { ctx.beginPath(); ctx.moveTo(s * .82, -s * .1); ctx.bezierCurveTo(s * .9, -s * .75, -s * .1, -s * .9, -s * .65, -s * .72); }, s * .02, limb, inkC, s);
  tube(() => { ctx.beginPath(); ctx.moveTo(s * .84, -s * .06); ctx.bezierCurveTo(s * 1.05, -s * .6, s * .2, -s * .78, -s * 1.05, -s * .58); }, s * .02, limb, inkC, s);
  shape(() => shrimpTail(s), shade(base, .05), inkC, s);
  streaks(shade(base, -.45), s, [[-s * .9, -s * .02, -s * 1.22, -s * .3], [-s * .92, s * .02, -s * 1.28, s * .02], [-s * .9, s * .05, -s * 1.18, s * .28]]);
  shape(() => { ctx.beginPath(); ctx.moveTo(s * .78, -s * .2); ctx.lineTo(s * 1.18, -s * .26); ctx.lineTo(s * .84, -s * .06); ctx.closePath(); }, shade(base, .15), inkC, s);
  ctx.fillStyle = bodyFill(shade(base, .35), base, shade(base, -.15), -s * .55, s * .3); shrimpBody(s); ctx.fill();
  ctx.save(); shrimpBody(s); ctx.clip();
  ctx.strokeStyle = inkC; ctx.globalAlpha = .45; ctx.lineWidth = Math.max(.8, s * .03); // shell segments
  for (const x of [.3, .02, -.24, -.48, -.7]) { ctx.beginPath(); ctx.moveTo(x * s, -s * .6); ctx.quadraticCurveTo((x - .1) * s, -s * .1, (x + .02) * s, s * .4); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = shade(base, .45); ctx.globalAlpha = .5;
  ctx.beginPath(); ctx.ellipse(-s * .05, s * .14, s * .7, s * .07, .08, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  shine(s * .1, -s * .35, s * .32, s * .06, -.12, [[-s * .4, -s * .28, s * .035], [s * .5, -s * .32, s * .03]]);
  ctx.restore();
  shrimpBody(s); ink(inkC, s);
  eye(s * .62, -s * .2, s * .14, inkC);
}

// Lobster: carapace and segmented tail, two big claws reaching forward, long antennae, a tail fan
const LOBSTER = ['#d9412b', '#e8642c', '#3d6fd9', '#c43a6a'];
function lobsterShell(s: number) {
  ctx.beginPath(); ctx.moveTo(s * .8, -s * .02);
  ctx.bezierCurveTo(s * .7, -s * .38, s * .1, -s * .4, -s * .2, -s * .3);
  ctx.bezierCurveTo(-s * .55, -s * .26, -s * .85, -s * .2, -s * 1.02, -s * .1);
  ctx.lineTo(-s * 1.02, s * .1);
  ctx.bezierCurveTo(-s * .85, s * .2, -s * .55, s * .26, -s * .2, s * .3);
  ctx.bezierCurveTo(s * .1, s * .4, s * .7, s * .34, s * .8, -s * .02);
  ctx.closePath();
}
function lobsterFan(s: number) {
  ctx.beginPath(); ctx.moveTo(-s * 1, -s * .1);
  ctx.quadraticCurveTo(-s * 1.2, -s * .38, -s * 1.42, -s * .3);
  ctx.quadraticCurveTo(-s * 1.32, 0, -s * 1.42, s * .3);
  ctx.quadraticCurveTo(-s * 1.2, s * .38, -s * 1, s * .1);
  ctx.closePath();
}
function lobsterClaw(s: number, d: number) {
  const y = d * s * .42;
  ctx.beginPath(); ctx.moveTo(s * .95, y);
  ctx.bezierCurveTo(s * 1.05, y - s * .22, s * 1.5, y - s * .22, s * 1.66, y - s * .04); // upper jaw
  ctx.quadraticCurveTo(s * 1.4, y - s * .02, s * 1.3, y + s * .02);
  ctx.quadraticCurveTo(s * 1.45, y + s * .06, s * 1.6, y + s * .1);                       // lower jaw
  ctx.bezierCurveTo(s * 1.4, y + s * .22, s * 1.05, y + s * .2, s * .95, y);
  ctx.closePath();
}
function drawLobster(f: FishLook, s: number) {
  const base = LOBSTER[f.variant % LOBSTER.length], inkC = shade(base, -.65), limb = shade(base, -.12), light = shade(base, .3);
  for (const x of [.45, .25, .05]) tube(() => { ctx.beginPath(); ctx.moveTo(x * s, s * .25); ctx.quadraticCurveTo((x + .05) * s, s * .45, (x - .05) * s, s * .58); }, s * .04, limb, inkC, s);
  for (const d of [-1, 1]) tube(() => { ctx.beginPath(); ctx.moveTo(s * .7, d * s * .16); ctx.quadraticCurveTo(s * .82, d * s * .4, s * 1, d * s * .42); }, s * .09, limb, inkC, s);
  tube(() => { ctx.beginPath(); ctx.moveTo(s * .78, -s * .12); ctx.bezierCurveTo(s * 1.1, -s * .55, s * 1.45, -s * .75, s * 1.72, -s * .62); }, s * .025, limb, inkC, s);
  tube(() => { ctx.beginPath(); ctx.moveTo(s * .8, -s * .08); ctx.bezierCurveTo(s * .9, -s * .5, s * .55, -s * .78, s * .2, -s * .74); }, s * .025, limb, inkC, s);
  shape(() => lobsterFan(s), shade(base, .05), inkC, s);
  streaks(shade(base, -.45), s, [[-s * 1.05, -s * .05, -s * 1.36, -s * .24], [-s * 1.05, 0, -s * 1.36, 0], [-s * 1.05, s * .05, -s * 1.36, s * .24]]);
  ctx.fillStyle = bodyFill(light, base, shade(base, -.2), -s * .4, s * .4); lobsterShell(s); ctx.fill();
  ctx.save(); lobsterShell(s); ctx.clip();
  ctx.strokeStyle = inkC; ctx.globalAlpha = .45; ctx.lineWidth = Math.max(.8, s * .03); // tail segments
  for (const x of [-.2, -.4, -.6, -.8]) { ctx.beginPath(); ctx.moveTo(x * s, -s * .4); ctx.quadraticCurveTo((x - .06) * s, 0, x * s, s * .4); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = shade(base, -.35); ctx.globalAlpha = .35; // bumpy shell
  f.spots.forEach(p => { ctx.beginPath(); ctx.arc((p.x * .35 + .35) * s, p.y * .5 * s, s * .03, 0, TAU); ctx.fill(); });
  ctx.globalAlpha = 1;
  shine(s * .3, -s * .2, s * .3, s * .06, -.1, [[-s * .3, -s * .18, s * .035], [-s * .62, -s * .12, s * .03]]);
  ctx.restore();
  lobsterShell(s); ink(inkC, s);
  for (const d of [1, -1]) { // the far claw first
    ctx.fillStyle = bodyFill(light, base, shade(base, -.2), d * s * .42 - s * .2, d * s * .42 + s * .2); lobsterClaw(s, d); ctx.fill(); ink(inkC, s);
    shine(s * 1.25, d * s * .42 - s * .1, s * .14, s * .03, -.05, []);
  }
  eye(s * .6, -s * .14, s * .13, inkC);
}

// Anglerfish: a dark round body, a wide grin full of teeth, and a glowing lure dangling in front of its face
const ANGLER = ['#4b3b5c', '#3b4a5c', '#5c4038', '#2f4a3e'];
// the outline runs from the upper lip over the head, round the tail end, along the belly and up the jutting chin
function anglerBody(s: number) {
  ctx.beginPath(); ctx.moveTo(s * .98, s * .02);
  ctx.bezierCurveTo(s * .98, -s * .62, s * .1, -s * .78, -s * .4, -s * .45);
  ctx.quadraticCurveTo(-s * .7, -s * .25, -s * .78, 0);
  ctx.quadraticCurveTo(-s * .7, s * .25, -s * .4, s * .42);
  ctx.bezierCurveTo(s * .1, s * .7, s * .8, s * .6, s * 1.02, s * .38);
  ctx.quadraticCurveTo(s * 1.14, s * .22, s * 1.12, -s * .04);
  ctx.closePath();
}
/** The open mouth: from the upper lip back to the drooping corner, and forward along the lower jaw. */
function anglerMouth(s: number) {
  ctx.beginPath(); ctx.moveTo(s * .98, s * .02);
  ctx.quadraticCurveTo(s * .7, s * .1, s * .42, s * .3);
  ctx.quadraticCurveTo(s * .78, s * .26, s * 1.12, -s * .04);
  ctx.closePath();
}
function anglerTail(s: number) {
  ctx.beginPath(); ctx.moveTo(-s * .72, 0);
  ctx.quadraticCurveTo(-s * .95, -s * .3, -s * 1.22, -s * .34);
  ctx.quadraticCurveTo(-s * 1.1, 0, -s * 1.22, s * .34);
  ctx.quadraticCurveTo(-s * .95, s * .3, -s * .72, 0);
  ctx.closePath();
}
function drawAngler(f: FishLook, s: number) {
  const base = ANGLER[f.variant % ANGLER.length], inkC = shade(base, -.7), fin = shade(base, .12);
  shape(() => anglerTail(s), fin, inkC, s);
  streaks(shade(base, -.4), s, [[-s * .8, -s * .04, -s * 1.15, -s * .26], [-s * .8, s * .04, -s * 1.15, s * .26]]);
  shape(() => { ctx.beginPath(); ctx.moveTo(-s * .2, -s * .6); ctx.quadraticCurveTo(-s * .45, -s * .9, -s * .62, -s * .7); ctx.quadraticCurveTo(-s * .5, -s * .55, -s * .48, -s * .4); ctx.closePath(); }, fin, inkC, s);
  // the lure: a stalk from the forehead, and a glowing bulb
  tube(() => { ctx.beginPath(); ctx.moveTo(s * .35, -s * .66); ctx.bezierCurveTo(s * .45, -s * 1.1, s * .95, -s * 1.1, s * 1.08, -s * .74); }, s * .035, fin, inkC, s);
  const glow = ctx.createRadialGradient(s * 1.1, -s * .68, 0, s * 1.1, -s * .68, s * .3);
  glow.addColorStop(0, 'rgba(220,255,170,.9)'); glow.addColorStop(1, 'rgba(160,255,200,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(s * 1.1, -s * .68, s * .3, 0, TAU); ctx.fill();
  shape(() => { ctx.beginPath(); ctx.arc(s * 1.1, -s * .68, s * .1, 0, TAU); }, '#f4ffb8', shade('#c8e86a', -.5), s);
  ctx.fillStyle = bodyFill(shade(base, .3), base, shade(base, -.25), -s * .7, s * .6); anglerBody(s); ctx.fill();
  ctx.save(); anglerBody(s); ctx.clip();
  ctx.fillStyle = shade(base, -.3); ctx.globalAlpha = .45;
  f.spots.forEach(p => { ctx.beginPath(); ctx.arc((p.x * .5 - .05) * s, (p.y * .9 - .1) * s, s * .035, 0, TAU); ctx.fill(); });
  ctx.globalAlpha = 1;
  shine(-s * .05, -s * .45, s * .32, s * .07, -.2, [[-s * .4, -s * .25, s * .04]]);
  ctx.restore();
  anglerBody(s); ink(inkC, s);
  // the mouth: a grumpy underbite, sloping down to the back, with crooked fangs over the lip
  anglerMouth(s); ctx.fillStyle = '#1a0f1e'; ctx.fill();
  ctx.save(); anglerMouth(s); ctx.clip();
  ctx.fillStyle = '#f6f3e8';
  for (const x of [.6, .76, .9]) { // short upper teeth
    const y = s * (.02 + (.98 - x) * .5);
    ctx.beginPath(); ctx.moveTo((x - .025) * s, y - s * .02); ctx.lineTo(x * s, y + s * .07); ctx.lineTo((x + .025) * s, y - s * .02); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#f6f3e8'; ctx.strokeStyle = inkC; ctx.lineWidth = Math.max(.6, s * .015);
  for (const [x, h] of [[.56, .11], [.72, .15], [.87, .1], [1.02, .14]]) { // lower fangs, sticking up over the lip
    const y = s * (.3 - (x - .42) * .48);
    ctx.beginPath(); ctx.moveTo((x - .035) * s, y + s * .02); ctx.lineTo(x * s, y - h * s); ctx.lineTo((x + .03) * s, y + s * .02); ctx.fill(); ctx.stroke();
  }
  anglerMouth(s); ink(inkC, s, .95, .9);
  // a heavy brow over the eye
  ctx.beginPath(); ctx.moveTo(s * .34, -s * .5); ctx.quadraticCurveTo(s * .5, -s * .52, s * .66, -s * .42); ink(inkC, s, .9, 1.4);
  eye(s * .5, -s * .32, s * .13, inkC);
}

// Lionfish ("devil fish"): cream with red-brown stripes, a crest of long spines, big feathery fan fins
const LION = ['#a3321f', '#8a4a24', '#2f2a2e', '#b8452f'];
function lionBody(s: number) {
  ctx.beginPath(); ctx.moveTo(s * .92, s * .04);
  ctx.bezierCurveTo(s * .85, -s * .42, s * .2, -s * .5, -s * .45, -s * .3);
  ctx.quadraticCurveTo(-s * .72, -s * .14, -s * .78, 0);
  ctx.quadraticCurveTo(-s * .72, s * .14, -s * .45, s * .28);
  ctx.bezierCurveTo(s * .2, s * .48, s * .85, s * .4, s * .92, s * .04);
  ctx.closePath();
}
function lionTail(s: number) {
  ctx.beginPath(); ctx.moveTo(-s * .72, 0);
  ctx.quadraticCurveTo(-s * .95, -s * .36, -s * 1.3, -s * .3);
  ctx.quadraticCurveTo(-s * 1.4, 0, -s * 1.3, s * .3);
  ctx.quadraticCurveTo(-s * .95, s * .36, -s * .72, 0);
  ctx.closePath();
}
/** The fan fins: a spread of long rays from behind the head, with a web of fin between them. */
function lionFan(s: number) {
  ctx.beginPath(); ctx.moveTo(s * .25, s * .1);
  ctx.bezierCurveTo(s * .1, s * .6, -s * .4, s * .95, -s * .95, s * .85);
  ctx.quadraticCurveTo(-s * .55, s * .55, -s * .2, s * .22);
  ctx.closePath();
}
function drawLion(f: FishLook, s: number) {
  const stripe = LION[f.variant % LION.length], cream = '#f6eadb', inkC = shade(stripe, -.6);
  // the crest: a few long, separate spines fanning up and back, with a low web between their bases
  const spines = Array.from({ length: 8 }, (_, i) => {
    const x = .5 - i * .13, a = -1.25 - i * .13, len = .95 - Math.abs(i - 2.5) * .07;
    return [x, -.34 + i * .01, x + Math.cos(a) * len, -.34 + Math.sin(a) * len] as const;
  });
  ctx.beginPath(); ctx.moveTo(s * spines[0][0], s * spines[0][1]);
  for (const [x0, y0, x1, y1] of spines) ctx.lineTo(s * (x0 + (x1 - x0) * .45), s * (y0 + (y1 - y0) * .45));
  ctx.lineTo(s * spines[7][0], s * spines[7][1]); ctx.closePath();
  ctx.fillStyle = shade(stripe, .3); ctx.globalAlpha = .45; ctx.fill(); ctx.globalAlpha = 1;
  for (const [x0, y0, x1, y1] of spines) {
    const curve = () => { ctx.beginPath(); ctx.moveTo(x0 * s, y0 * s); ctx.quadraticCurveTo((x0 + x1) / 2 * s + s * .06, (y0 + y1) / 2 * s, x1 * s, y1 * s); };
    tube(curve, s * .04, cream, inkC, s);
    ctx.strokeStyle = stripe; ctx.lineWidth = s * .04; ctx.lineCap = 'butt'; ctx.setLineDash([s * .07, s * .07]); // banded spines
    curve(); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'round';
  }
  shape(() => lionTail(s), shade(cream, -.05), inkC, s);
  ctx.fillStyle = stripe; ctx.globalAlpha = .6; // spotted tail
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(-s * (.9 + (i % 3) * .14), s * (-.2 + (i / 6) * .4), s * .035, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  // the fan fins behind the body (the far one peeks out above the near one)
  ctx.fillStyle = bodyFill('#fff8ee', cream, shade(cream, -.15), -s * .45, s * .45); lionBody(s); ctx.fill();
  ctx.save(); lionBody(s); ctx.clip();
  ctx.fillStyle = stripe; // the bold stripes, curving like the real thing
  for (let i = 0; i < 8; i++) {
    const x = s * (.72 - i * .19);
    ctx.beginPath(); ctx.moveTo(x, -s * .6); ctx.quadraticCurveTo(x - s * .1, 0, x + s * .02, s * .6);
    ctx.lineTo(x - s * .08, s * .6); ctx.quadraticCurveTo(x - s * .18, 0, x - s * .08, -s * .6); ctx.closePath(); ctx.fill();
  }
  shine(s * .1, -s * .28, s * .32, s * .06, -.1, [[-s * .35, -s * .18, s * .035]]);
  ctx.restore();
  lionBody(s); ink(inkC, s);
  ctx.fillStyle = shade(stripe, .45); ctx.globalAlpha = .4; lionFan(s); ctx.fill(); ctx.globalAlpha = 1; // a see-through web
  for (let i = 0; i < 7; i++) { // and long feathery rays, banded like the spines
    const ex = -(.45 + i * .085), ey = .3 + i * .095;
    const ray = () => { ctx.beginPath(); ctx.moveTo(s * .22, s * .1); ctx.quadraticCurveTo(-s * .1, s * (.22 + i * .09), ex * s, ey * s); };
    tube(ray, s * .035, cream, inkC, s);
    ctx.strokeStyle = stripe; ctx.lineWidth = s * .035; ctx.lineCap = 'butt'; ctx.setLineDash([s * .06, s * .05]); ray(); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'round';
  }
  eye(s * .6, -s * .1, s * .15, inkC);
  tube(() => { ctx.beginPath(); ctx.moveTo(s * .62, -s * .24); ctx.quadraticCurveTo(s * .7, -s * .38, s * .78, -s * .4); }, s * .025, cream, inkC, s); // feeler above the eye
  pout(s * .92, s * .1, s, inkC);
}

// Octopus, facing you: a domed head with big eyes and a grin, and eight arms spreading out to both sides and curling
// up at the tips, with suckers along them. Swimming bends it like the others, which makes the trailing arms ripple.
const OCTOPUS = ['#c35bd8', '#e8556d', '#ff8a5c', '#5b8de8'];
function octoHead(s: number) {
  ctx.beginPath(); ctx.moveTo(-s * .42, s * .08);
  ctx.bezierCurveTo(-s * .62, -s * .35, -s * .42, -s * .92, 0, -s * .92);
  ctx.bezierCurveTo(s * .42, -s * .92, s * .62, -s * .35, s * .42, s * .08);
  ctx.quadraticCurveTo(0, s * .3, -s * .42, s * .08);
  ctx.closePath();
}
/** An arm as points: it leaves the head in direction a0 and turns more and more, rolling up at the tip. */
function octoArm(s: number, x0: number, y0: number, a0: number, turn: number, len: number): [number, number][] {
  const pts: [number, number][] = [[x0 * s, y0 * s]];
  let x = x0, y = y0, a = a0;
  const n = 30;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    a += turn * (t < .7 ? .6 : 3.2) / n; // gently along the arm, sharply in the curl
    const step = len / n * (1 - t * .45);
    x += Math.cos(a) * step; y += Math.sin(a) * step;
    pts.push([x * s, y * s]);
  }
  return pts;
}
function taper(pts: [number, number][], w0: number, w1: number, col: string, extra: number) {
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (let i = 1; i < pts.length; i++) {
    ctx.lineWidth = w0 + (w1 - w0) * i / pts.length + extra;
    ctx.beginPath(); ctx.moveTo(...pts[i - 1]); ctx.lineTo(...pts[i]); ctx.stroke();
  }
}
// right-hand arms as [start x, start y, direction, turn, length]; the left ones mirror them
const OCTO_ARMS = [[.3, -.04, -.35, -2.4, 1.3], [.36, .08, .2, -2.3, 1.4], [.28, .18, .85, -2.5, 1.25], [.1, .24, 1.4, -2.2, 1.05]];
function octoArms(s: number) {
  return OCTO_ARMS.flatMap(([x, y, a, turn, len]) => [
    { pts: octoArm(s, x, y, a, turn, len), side: Math.sign(turn) },
    { pts: octoArm(s, -x, y, Math.PI - a, -turn, len), side: -Math.sign(turn) },
  ]);
}
/** The glow around the arms: each arm traced a little wider than itself, in the halo's colour and blur. */
function octoArmsGlow(s: number) {
  const col = ctx.strokeStyle as string, w = ctx.lineWidth;
  for (const { pts } of octoArms(s)) taper(pts, s * .2 + w, s * .04 + w, col, 0);
  ctx.beginPath(); // paintFish strokes the current path after this; there's nothing left to stroke
}
function drawOctopus(f: FishLook, s: number) {
  const base = OCTOPUS[f.variant % OCTOPUS.length], inkC = shade(base, -.62), sucker = '#ffb978', edge = Math.max(1.1, s * .045) * 2;
  const arms = octoArms(s), w0 = s * .2, w1 = s * .04;
  for (const { pts } of arms) taper(pts, w0, w1, inkC, edge); // all ink edges first, so the arms blend where they meet
  for (const { pts } of arms) taper(pts, w0, w1, shade(base, -.05), 0);
  for (const { pts, side } of arms) for (let i = 4; i < pts.length - 2; i += 2) { // suckers on the inside of each curl
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i + 1], d = Math.hypot(x1 - x0, y1 - y0) || 1;
    const w = w0 + (w1 - w0) * i / pts.length, nx = -(y1 - y0) / d * side, ny = (x1 - x0) / d * side;
    ctx.fillStyle = sucker; ctx.beginPath(); ctx.arc(pts[i][0] + nx * w * .5, pts[i][1] + ny * w * .5, w * .24, 0, TAU); ctx.fill();
    ctx.strokeStyle = shade(sucker, -.35); ctx.lineWidth = Math.max(.5, s * .012); ctx.stroke();
  }
  ctx.fillStyle = bodyFill(shade(base, .35), base, shade(base, -.15), -s * .92, s * .2); octoHead(s); ctx.fill();
  ctx.save(); octoHead(s); ctx.clip();
  ctx.fillStyle = shade(base, -.22); ctx.globalAlpha = .5; // freckles on the dome
  f.spots.forEach(p => { ctx.beginPath(); ctx.arc(p.x * .4 * s, (p.y * .6 - .55) * s, s * (.03 + p.ry * .12), 0, TAU); ctx.fill(); });
  ctx.globalAlpha = 1;
  shine(-s * .12, -s * .68, s * .2, s * .1, -.5, [[s * .2, -s * .74, s * .04], [-s * .3, -s * .45, s * .03]]);
  ctx.restore();
  octoHead(s); ink(inkC, s);
  // the face, in the same style as the fish: their glossy eyes and a small inked smile
  eye(-s * .15, -s * .2, s * .14, inkC); eye(s * .15, -s * .2, s * .14, inkC);
  ctx.beginPath(); ctx.moveTo(-s * .07, s * .0); ctx.quadraticCurveTo(0, s * .06, s * .07, s * .0); ink(inkC, s, .85, .8);
}

// Seahorse: traced from a reference drawing (mirrored to face right), so its outline has the real proportions: the
// crowned head flowing into a spiky back, a throat that narrows under the snout, a round chest and a spiral tail. The
// eye, mouth, shading and glow are the same as the other creatures'. It swims with its back fin (see FIN), not its body.
const SEAHORSE = ['#ff8a4c', '#ff7aa8', '#ffc94d', '#5fcfc0'];
/** The traced outline, as x, y pairs in thousandths of a body unit, head to the right. */
const SEAHORSE_OUTLINE = [
  117,-1150, 104,-1150, 96,-1133, 122,-1111, 122,-1089, 109,-1072, 87,-1063, 57,-1067, 35,-1085, 13,-1107, -4,-1146, -17,-1150,
  -13,-1085, -43,-1059, -78,-1063, -126,-1111, -139,-1115, -143,-1107, -130,-1059, -139,-1041, -170,-1015, -226,-1011, -291,-1050, -304,-1050,
  -309,-1041, -278,-993, -278,-976, -296,-941, -322,-920, -352,-911, -435,-924, -439,-920, -409,-893, -396,-854, -400,-820, -413,-793,
  -435,-772, -465,-759, -535,-746, -500,-733, -474,-711, -461,-685, -461,-628, -496,-580, -561,-541, -491,-515, -470,-493, -461,-472,
  -461,-407, -517,-350, -465,-341, -439,-320, -426,-298, -422,-254, -448,-220, -313,-215, -313,172, -287,150, -270,163, -291,241,
  -300,250, -313,246, -300,293, -313,350, -343,367, -391,376, -361,398, -339,428, -339,467, -348,493, -378,524, -417,541,
  -365,576, -352,615, -365,672, -387,698, -417,715, -413,724, -391,724, -361,737, -335,780, -335,837, -343,854, -370,876,
  -370,885, -313,885, -296,893, -252,950, -243,993, -257,1037, -222,1020, -191,1020, -152,1033, -122,1063, -113,1085, -113,1124,
  -96,1102, -65,1085, -22,1080, 17,1093, 61,1150, 74,1107, 109,1076, 135,1067, 183,1067, 222,1089, 213,1046, 239,993,
  287,963, 330,972, 309,950, 300,915, 317,859, 339,833, 361,820, 330,807, 300,763, 296,702, 309,680, 274,685,
  235,667, 213,646, 204,611, 174,637, 130,637, 96,620, 83,602, 78,628, 57,654, 43,663, -9,667, 4,689,
  0,733, -39,772, -22,780, -4,802, -4,850, 13,850, 57,880, 100,876, 122,885, 130,867, 152,850, 161,828,
  152,798, 139,785, 113,785, 130,807, 117,833, 91,833, 57,802, 57,759, 104,720, 161,724, 196,754, 209,785,
  209,846, 183,898, 126,946, 83,959, 30,959, -9,950, -70,920, -96,898, -139,841, -165,780, -174,733, -178,663,
  -170,585, -135,472, -100,411, -100,398, -61,346, 13,289, 48,280, 109,285, 122,254, 126,202, 148,154, 174,128,
  226,98, 226,72, 204,20, 204,-59, 235,-150, 174,-224, 165,-263, 165,-333, 148,-350, 117,-354, 65,-389, 43,-420,
  39,-467, 30,-476, -52,-493, -109,-537, -135,-589, -135,-641, -126,-659, -113,-663, -52,-628, -26,-589, -9,-576, 17,-567,
  139,-567, 183,-541, 265,-511, 365,-437, 470,-324, 500,-324, 517,-333, 539,-354, 557,-359, 574,-376, 583,-398, 583,-424,
  574,-437, 522,-437, 478,-454, 417,-502, 370,-559, 357,-585, 361,-611, 335,-637, 326,-676, 339,-733, 326,-772, 343,-807,
  343,-833, 283,-833, 239,-872, 235,-911, 257,-963, 252,-993, 239,-989, 235,-967, 213,-946, 178,-950, 148,-980, 143,-1028,
  152,-1046, 152,-1107, 139,-1133,
];
/** The traced back fin, relative to where it joins the back. */
const SEAHORSE_FIN = [
  22,-274, -139,-274, -139,-265, -70,-270, -52,-257, -35,-222, -35,-183, -48,-170, -191,-248, -226,-248, -230,-200, -261,-170,
  -252,-143, -252,-109, -270,-87, -248,-39, -261,9, -230,39, -222,57, -226,109, -196,135, -187,152, -187,200, -161,209,
  -148,222, -130,261, -104,261, -83,243, -22,135, 22,96,
];
/** A smooth closed path through traced points (curves between the midpoints, so the corners round off). */
function tracedPath(pts: number[], s: number) {
  const n = pts.length / 2, x = (i: number) => pts[(i % n) * 2] / 1000 * s, y = (i: number) => pts[(i % n) * 2 + 1] / 1000 * s;
  ctx.beginPath(); ctx.moveTo((x(0) + x(1)) / 2, (y(0) + y(1)) / 2);
  for (let i = 1; i <= n; i++) ctx.quadraticCurveTo(x(i), y(i), (x(i) + x(i + 1)) / 2, (y(i) + y(i + 1)) / 2);
  ctx.closePath();
}
const seahorseShape = (s: number) => tracedPath(SEAHORSE_OUTLINE, s);
const seahorseFin = (s: number) => tracedPath(SEAHORSE_FIN, s);
function drawSeahorse(f: FishLook, s: number) {
  const base = SEAHORSE[f.variant % SEAHORSE.length], inkC = shade(base, -.62), light = shade(base, .5);
  const fill = ctx.createLinearGradient(s * .45, 0, -s * .55, 0); // lit from the front, darker down the back
  fill.addColorStop(0, shade(base, .25)); fill.addColorStop(.5, base); fill.addColorStop(1, shade(base, -.2));
  ctx.fillStyle = fill; seahorseShape(s); ctx.fill();
  ctx.save(); seahorseShape(s); ctx.clip();
  ctx.fillStyle = light; ctx.globalAlpha = .45; // a lighter belly down the front
  ctx.beginPath(); ctx.ellipse(s * .12, s * .02, s * .2, s * .42, -.15, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = light; ctx.lineWidth = Math.max(.8, s * .028); ctx.lineCap = 'round'; ctx.globalAlpha = .75; // the rings
  for (let y = -.34; y < .6; y += .095) { ctx.beginPath(); ctx.moveTo(-s * .45, (y - .03) * s); ctx.quadraticCurveTo(0, (y + .05) * s, s * .5, (y - .04) * s); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(s * .14, -s * .38); ctx.quadraticCurveTo(s * .16, s * .1, -s * .06, s * .58); ctx.stroke(); // and the line down the front
  ctx.globalAlpha = 1;
  ctx.fillStyle = light; ctx.globalAlpha = .7; // freckles on the head
  for (const [x, y, r] of [[-.02, -.8, .018], [.02, -.76, .014], [-.04, -.74, .012]]) { ctx.beginPath(); ctx.arc(x * s, y * s, r * s, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  shine(s * .1, -s * .84, s * .1, s * .03, -.4, [[s * .3, -s * .1, s * .025], [s * .26, s * .04, s * .02]]);
  ctx.restore();
  seahorseShape(s); ink(inkC, s);
  eye(s * .22, -s * .7, s * .085, inkC);
  ctx.beginPath(); ctx.moveTo(s * .55, -s * .45); ctx.quadraticCurveTo(s * .6, -s * .42, s * .57, -s * .38); ink(inkC, s, .85, .8); // its little mouth
}
function drawSeahorseFin(f: FishLook, s: number) {
  const base = SEAHORSE[f.variant % SEAHORSE.length], inkC = shade(base, -.62);
  shape(() => seahorseFin(s), shade(base, .3), inkC, s);
  streaks(shade(base, -.3), s, [[0, -s * .18, -s * .22, -s * .2], [0, -s * .08, -s * .26, -s * .08], [0, s * .02, -s * .27, s * .04], [0, s * .12, -s * .24, s * .15], [0, s * .2, -s * .16, s * .24]]);
}

type Painter = (f: FishLook, s: number, w: number, sway: number, ph: number) => void;
const PAINT: Record<Species, Painter> = {
  tropical: drawTropical, koi: drawKoi, sturgeon: drawSturgeon, angelfish: drawAngel, puffer: drawPuffer,
  squid: drawSquid, shrimp: drawShrimp, lobster: drawLobster, angler: drawAngler, lionfish: drawLion, octopus: drawOctopus, seahorse: drawSeahorse,
};
const OUTLINE: Record<Species, (s: number) => (() => void)[]> = {
  tropical: s => [() => tropicalTail(s, 0), () => tropicalBody(s)],
  koi: s => [() => koiTail(s, 0), () => koiBody(s)],
  sturgeon: s => [() => sturgeonTail(s, 0), () => sturgeonBody(s)],
  angelfish: s => [() => angelTail(s, 0), () => angelFin(s, 0, -1), () => angelFin(s, 0, 1), () => angelBody(s)],
  puffer: s => [() => pufferTail(s, 0), () => pufferBody(s)],
  squid: s => [() => squidFins(s), () => squidMantle(s), () => squidHead(s)],
  shrimp: s => [() => shrimpTail(s), () => shrimpBody(s)],
  lobster: s => [() => lobsterFan(s), () => lobsterShell(s), () => lobsterClaw(s, -1), () => lobsterClaw(s, 1)],
  angler: s => [() => anglerTail(s), () => anglerBody(s)],
  lionfish: s => [() => lionTail(s), () => lionFan(s), () => lionBody(s)],
  octopus: s => [() => octoArmsGlow(s), () => octoHead(s)],
  seahorse: s => [() => seahorseShape(s)],
};

/**
 * Fins on a layer of their own, for creatures that swim with a fin instead of bending their body (`stiff` in
 * SPECIES): where the fin joins the body, the box it's drawn in around that point, and how to paint it.
 */
const FIN: Partial<Record<Species, { root: [number, number]; box: [number, number, number, number]; paint: Painter; outline: (s: number) => void }>> = {
  seahorse: { root: [-.313, .059], box: [-.3, -.3, .05, .3], paint: drawSeahorseFin, outline: seahorseFin },
};

export interface FishTextures {
  body: Texture;
  /** neon rim in the session colour, drawn behind the body */
  halo: Texture;
  /** a fin on its own layer (see FIN): its texture, the point it hinges on (0..1), and where that sits on the body */
  fin?: { texture: Texture; anchorX: number; anchorY: number; x: number; y: number };
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

  let fin: FishTextures['fin'];
  const spec = FIN[f.species];
  if (spec) {
    const [fl, ft, fr, fb] = spec.box, fw = Math.ceil((fr - fl) * s + pad * 2), fh = Math.ceil((fb - ft) * s + pad * 2);
    const ox = pad - fl * s, oy = pad - ft * s, c = makeCanvas(fw, fh, res);
    ctx = c.g; ctx.translate(ox, oy);
    ctx.save(); ctx.shadowColor = f.neon; ctx.shadowBlur = blur; ctx.strokeStyle = f.neon; ctx.lineWidth = s * .1 + 1; ctx.lineJoin = 'round';
    spec.outline(s); ctx.stroke(); ctx.restore();
    spec.paint(f, s, 0, 0, 0);
    fin = { texture: canvasTexture(c.c, res), anchorX: ox / fw, anchorY: oy / fh, x: spec.root[0] * s, y: spec.root[1] * s };
  }

  return { body: canvasTexture(body.c, res), halo: canvasTexture(halo.c, res), fin, originX, originY, width, height };
}

/** The creature as one still picture (glow, fin and body), for the creature page and the website. */
export function stillCanvas(t: FishTextures, res: number): HTMLCanvasElement {
  const c = makeCanvas(t.width, t.height, res), img = (x: Texture) => x.source.resource as CanvasImageSource;
  c.g.drawImage(img(t.halo), 0, 0, t.width, t.height);
  if (t.fin) {
    const w = t.fin.texture.width, h = t.fin.texture.height;
    c.g.drawImage(img(t.fin.texture), t.originX + t.fin.x - t.fin.anchorX * w, t.originY + t.fin.y - t.fin.anchorY * h, w, h);
  }
  c.g.drawImage(img(t.body), 0, 0, t.width, t.height);
  return c.c;
}