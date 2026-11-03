import type { Species } from '../species';
import { shade, TAU } from '../util';
import type { Creature, FishLook, Painter } from './fishLook';
import type { Ink } from './fishPen';
import { bodyFill, eye, g, ink, pout, shape, shine, streaks } from './fishPen';

const tropicalBody = (size: number) => {
  g.beginPath();
  g.moveTo(size, 0);
  g.bezierCurveTo(size * .92, -size * .5, size * .2, -size * .64, -size * .42, -size * .4);
  g.quadraticCurveTo(-size * .78, -size * .22, -size * .9, 0);
  g.quadraticCurveTo(-size * .78, size * .22, -size * .42, size * .4);
  g.bezierCurveTo(size * .2, size * .58, size * .92, size * .46, size, 0);
  g.closePath();
};
const tropicalTail = (size: number, wag: number) => {
  g.beginPath();
  g.moveTo(-size * .82, 0);
  g.quadraticCurveTo(-size * 1.15, -size * .1 + wag * .5, -size * 1.5, -size * .58 + wag);
  g.quadraticCurveTo(-size * 1.28, wag * .7, -size * 1.5, size * .58 + wag);
  g.quadraticCurveTo(-size * 1.15, size * .1 + wag * .5, -size * .82, 0);
  g.closePath();
};
const paintTropicalPattern = (look: FishLook, pen: Ink) => {
  const color = look.body, size = pen.size;
  if (look.pattern === 0) {
    for (const bandX of [size * .3, -size * .3]) {
      g.beginPath(); g.ellipse(bandX, 0, size * .1, size * .7, 0, 0, TAU);
      g.fillStyle = '#fffaf0'; g.fill(); ink(pen, .9, .8);
    }
  } else if (look.pattern === 1) {
    g.fillStyle = shade(color, -.4);
    for (let index = 0; index < 6; index++) { g.beginPath(); g.arc(-size * .6 + index * size * .2, -size * .2 + (index % 2) * size * .16, size * .06, 0, TAU); g.fill(); }
  } else {
    g.fillStyle = shade(color, .45); g.beginPath(); g.ellipse(-size * .1, size * .3, size * .8, size * .14, 0, 0, TAU); g.fill();
  }
};
const drawTropical: Painter = (look, size, { wag, sway, phase }) => {
  const color = look.body, inkColor = shade(color, -.62), fin = shade(color, -.1), streakColor = shade(color, -.5);
  const pen = { color: inkColor, size };
  shape(() => { g.beginPath(); g.moveTo(-size * .38, -size * .38); g.quadraticCurveTo(-size * .2 + sway, -size * .98, size * .12 + sway, -size * .84);
    g.quadraticCurveTo(size * .3, -size * .64, size * .4, -size * .5); g.closePath(); }, fin, pen);
  streaks(streakColor, size, [[-size * .22, -size * .45, -size * .2 + sway, -size * .8], [-size * .02, -size * .5, size * .02 + sway, -size * .82], [size * .18, -size * .52, size * .16 + sway, -size * .72]]);
  shape(() => { g.beginPath(); g.moveTo(-size * .05, size * .44); g.quadraticCurveTo(-size * .35 - sway, size * .82, -size * .34 - sway, size * .8);
    g.quadraticCurveTo(-size * .05, size * .64, size * .18, size * .48); g.closePath(); }, fin, pen);
  shape(() => tropicalTail(size, wag), fin, pen);
  streaks(streakColor, size, [[-size * 1.0, -size * .1 + wag * .5, -size * 1.38, -size * .45 + wag], [-size * 1.0, 0 + wag * .5, -size * 1.32, -size * .15 + wag * .8], [-size * 1.0, wag * .5, -size * 1.32, size * .15 + wag * .8], [-size * 1.0, size * .1 + wag * .5, -size * 1.38, size * .45 + wag]]);

  g.fillStyle = bodyFill([shade(color, .3), color, shade(color, -.22)], -size * .6, size * .55); tropicalBody(size); g.fill();
  g.save(); tropicalBody(size); g.clip();
  paintTropicalPattern(look, pen);
  g.fillStyle = shade(color, -.35); g.globalAlpha = .35; g.beginPath(); g.ellipse(0, size * .55, size, size * .16, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
  shine([size * .12, -size * .3, size * .3, size * .08, -.18], [[-size * .3, -size * .18, size * .05], [-size * .42, -size * .06, size * .035], [-size * .2, -size * .02, size * .025]]);
  g.restore();
  tropicalBody(size); ink(pen);

  g.beginPath(); g.arc(size * .3, 0, size * .3, -.9, .9); ink(pen, .55, .8);
  g.save(); g.translate(size * .2, size * .16); g.rotate(.5 + Math.sin(phase * 1.6) * .35);
  shape(() => { g.beginPath(); g.ellipse(-size * .14, 0, size * .2, size * .085, 0, 0, TAU); }, fin, pen); g.restore();
  eye([size * .56, -size * .13], size * .19, inkColor);
  pout(size * .99, size * .06, pen);
};

const KOI = [
  { base: '#f6f1e7', spots: ['#e8452c'] },                       // kohaku
  { base: '#f6f1e7', spots: ['#e8452c', '#e8452c', '#1b1b1f'] }, // sanke
  { base: '#f5b82e', spots: [] },                                // yamabuki (gold)
  { base: '#1e1e24', spots: ['#e8452c', '#f6f1e7'] },            // showa
];
type KoiVariety = (typeof KOI)[number];
const koiBody = (size: number) => {
  g.beginPath(); g.moveTo(size, 0);
  g.bezierCurveTo(size * .95, -size * .32, size * .45, -size * .45, -size * .15, -size * .38);
  g.quadraticCurveTo(-size * .65, -size * .3, -size * .95, -size * .07);
  g.lineTo(-size * .95, size * .07);
  g.quadraticCurveTo(-size * .65, size * .28, -size * .15, size * .34);
  g.bezierCurveTo(size * .45, size * .42, size * .95, size * .3, size, 0);
  g.closePath();
};
const koiTail = (size: number, wag: number) => {
  g.beginPath(); g.moveTo(-size * .9, 0);
  g.bezierCurveTo(-size * 1.15, -size * .1 + wag * .4, -size * 1.4, -size * .35 + wag * .8, -size * 1.75, -size * .55 + wag);
  g.quadraticCurveTo(-size * 1.45, -size * .15 + wag * .8, -size * 1.42, wag * .8);
  g.quadraticCurveTo(-size * 1.45, size * .15 + wag * .8, -size * 1.75, size * .55 + wag);
  g.bezierCurveTo(-size * 1.4, size * .35 + wag * .8, -size * 1.15, size * .1 + wag * .4, -size * .9, 0);
  g.closePath();
};
const koiColors = (koi: KoiVariety, isDark: boolean) => ({
  inkColor: isDark ? '#0b0b10' : koi.spots.length ? '#5b3a30' : shade(koi.base, -.62),
  fin: isDark ? '#4a4a55' : koi.spots.length ? '#f3e6d6' : shade(koi.base, .2),
  streakColor: isDark ? '#22222a' : shade(koi.spots[0] || koi.base, -.2),
});
const paintKoiSpots = (look: FishLook, koi: KoiVariety, size: number) => {
  if (!koi.spots.length) return;
  look.spots.forEach((spot, index) => {
    g.fillStyle = koi.spots[index % koi.spots.length];
    g.beginPath(); g.ellipse(spot.x * size, spot.y * size, spot.rx * size, spot.ry * size, spot.rot, 0, TAU); g.fill();
  });
};
const drawKoi: Painter = (look, size, { wag, sway, phase }) => {
  const koi = KOI[look.variant % KOI.length], isDark = koi.base === '#1e1e24';
  const { inkColor, fin, streakColor } = koiColors(koi, isDark), pen = { color: inkColor, size };
  g.globalAlpha = .9; shape(() => koiTail(size, wag), fin, pen); g.globalAlpha = 1;
  streaks(streakColor, size, [[-size * 1.05, -size * .05 + wag * .5, -size * 1.62, -size * .45 + wag], [-size * 1.05, wag * .5, -size * 1.48, -size * .15 + wag * .85], [-size * 1.05, wag * .5, -size * 1.48, size * .15 + wag * .85], [-size * 1.05, size * .05 + wag * .5, -size * 1.62, size * .45 + wag]]);
  shape(() => { g.beginPath(); g.moveTo(-size * .55, -size * .32); g.quadraticCurveTo(-size * .3 + sway, -size * .64, size * .2 + sway, -size * .52);
    g.lineTo(size * .28, -size * .4); g.closePath(); }, fin, pen);
  shape(() => { g.beginPath(); g.moveTo(-size * .05, size * .32); g.quadraticCurveTo(-size * .25 - sway, size * .62, -size * .3 - sway, size * .56);
    g.quadraticCurveTo(-size * .15, size * .42, -size * .2, size * .33); g.closePath(); }, fin, pen);

  g.fillStyle = bodyFill([shade(koi.base, isDark ? .15 : .25), koi.base, shade(koi.base, -.18)], -size * .44, size * .4); koiBody(size); g.fill();
  g.save(); koiBody(size); g.clip();
  paintKoiSpots(look, koi, size);
  g.fillStyle = '#000'; g.globalAlpha = .12; g.beginPath(); g.ellipse(0, size * .42, size, size * .14, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
  shine([size * .2, -size * .22, size * .38, size * .07, -.08], [[-size * .25, -size * .2, size * .045], [-size * .4, -size * .1, size * .03]]);
  g.restore();
  koiBody(size); ink(pen);

  g.save(); g.translate(size * .45, size * .22); g.rotate(.6 + Math.sin(phase * 1.2) * .35);
  shape(() => { g.beginPath(); g.ellipse(-size * .16, 0, size * .26, size * .1, 0, 0, TAU); }, fin, pen); g.restore();
  for (const [x0, x1] of [[size * .94, size * .96], [size * .88, size * .82]]) {
    g.beginPath(); g.moveTo(x0, size * .1); g.quadraticCurveTo(x0 + size * .06, size * .2, x1 + sway * .3, size * .32); ink(pen, .8, .7);
  }
  eye([size * .68, -size * .1], size * .13, inkColor);
  pout(size, size * .04, pen);
};

const STURGEON = ['#5f7a96', '#7d7458', '#5a7566'];
const sturgeonBody = (size: number) => {
  g.beginPath(); g.moveTo(size * 1.3, size * .05);
  g.quadraticCurveTo(size * 1.0, -size * .2, size * .6, -size * .28);
  g.bezierCurveTo(size * .1, -size * .36, -size * .6, -size * .24, -size * 1.0, -size * .08);
  g.lineTo(-size * 1.0, size * .06);
  g.bezierCurveTo(-size * .6, size * .22, size * .1, size * .3, size * .6, size * .22);
  g.quadraticCurveTo(size * 1.0, size * .16, size * 1.3, size * .05);
  g.closePath();
};
// shark-like (heterocercal): the upper lobe is the longer one
const sturgeonTail = (size: number, wag: number) => {
  g.beginPath(); g.moveTo(-size * .95, -size * .07);
  g.quadraticCurveTo(-size * 1.3, -size * .28 + wag * .6, -size * 1.78, -size * .6 + wag);
  g.quadraticCurveTo(-size * 1.5, -size * .12 + wag * .8, -size * 1.38, size * .28 + wag * .8);
  g.quadraticCurveTo(-size * 1.2, size * .1 + wag * .4, -size * .95, size * .06);
  g.closePath();
};
const scute = (x: number, y: number, radius: number) => {
  g.beginPath(); g.moveTo(x + radius, y); g.lineTo(x, y - radius * .7); g.lineTo(x - radius, y); g.lineTo(x, y + radius * .7); g.closePath();
  g.fill(); g.stroke();
};
const paintSturgeonArmour = (base: string, pen: Ink) => {
  const size = pen.size;
  g.fillStyle = shade(base, .55); g.strokeStyle = pen.color; g.lineWidth = Math.max(.7, size * .022);
  const top = (x: number) => -size * .36 * (1 - Math.pow((x + size * .05) / (size * 1.1), 2));
  for (let index = 0; index < 9; index++) { const x = size * .5 - index * size * .16; scute(x, top(x) + size * .03, size * .06); }
  for (let index = 0; index < 11; index++) scute(size * .55 - index * size * .14, size * .02, size * .038);
};
const drawSturgeon: Painter = (look, size, { wag, sway, phase }) => {
  const base = STURGEON[look.variant % STURGEON.length], inkColor = shade(base, -.65), fin = shade(base, -.05), streakColor = shade(base, -.45);
  const pen = { color: inkColor, size };
  shape(() => sturgeonTail(size, wag), fin, pen);
  streaks(streakColor, size, [[-size * 1.1, -size * .12 + wag * .5, -size * 1.62, -size * .5 + wag], [-size * 1.1, -size * .02 + wag * .5, -size * 1.5, -size * .2 + wag * .8], [-size * 1.1, size * .05 + wag * .5, -size * 1.38, size * .2 + wag * .8]]);
  shape(() => { g.beginPath(); g.moveTo(-size * .5, -size * .2); g.quadraticCurveTo(-size * .7 + sway, -size * .47, -size * .85 + sway, -size * .42);
    g.lineTo(-size * .8, -size * .12); g.closePath(); }, fin, pen);
  shape(() => { g.beginPath(); g.moveTo(-size * .55, size * .16); g.quadraticCurveTo(-size * .7 - sway, size * .36, -size * .8 - sway, size * .32);
    g.lineTo(-size * .78, size * .1); g.closePath(); }, fin, pen);

  const gradient = g.createLinearGradient(0, -size * .36, 0, size * .3);
  gradient.addColorStop(0, shade(base, .2)); gradient.addColorStop(.5, base); gradient.addColorStop(.72, shade(base, .5)); gradient.addColorStop(1, '#efe9da');
  g.fillStyle = gradient; sturgeonBody(size); g.fill();
  g.save(); sturgeonBody(size); g.clip();
  g.fillStyle = shade(base, -.4);
  look.spots.forEach(spot => { g.beginPath(); g.arc(spot.x * 1.2 * size, (spot.y * .45 - .05) * size, size * .028, 0, TAU); g.fill(); });
  shine([size * .35, -size * .2, size * .4, size * .05, -.08], [[-size * .3, -size * .18, size * .035], [-size * .5, -size * .14, size * .025]]);
  g.restore();
  sturgeonBody(size); ink(pen);
  paintSturgeonArmour(base, pen);

  g.save(); g.translate(size * .55, size * .18); g.rotate(.5 + Math.sin(phase * 1.1) * .25);
  shape(() => { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-size * .2, size * .05, -size * .38, size * .12);
    g.quadraticCurveTo(-size * .2, -size * .02, 0, 0); }, fin, pen); g.restore();

  for (let index = 0; index < 4; index++) {
    const x = size * (.92 + index * .055); g.beginPath(); g.moveTo(x, size * .14); g.lineTo(x - size * .02 + sway * .2, size * .27);
    ink({ color: '#e9dcb8', size }, 1, .7);
  }
  g.beginPath(); g.moveTo(size * .76, size * .19); g.quadraticCurveTo(size * .82, size * .22, size * .88, size * .18); ink(pen, .8, .8);
  eye([size * .8, -size * .07], size * .1, inkColor);
};

const ANGEL = ['#e3e6ea', '#f2c14e', '#d7c7e8'];
const angelBody = (size: number) => {
  g.beginPath(); g.moveTo(size * .85, size * .02);
  g.quadraticCurveTo(size * .65, -size * .44, size * .05, -size * .54);
  g.quadraticCurveTo(-size * .45, -size * .45, -size * .55, 0);
  g.quadraticCurveTo(-size * .45, size * .45, size * .05, size * .54);
  g.quadraticCurveTo(size * .65, size * .44, size * .85, size * .02);
  g.closePath();
};
/** side -1 is the dorsal fin, 1 the anal fin. */
const angelFin = (size: number, sway: number, side: number) => {
  g.beginPath(); g.moveTo(size * .2, side * size * .48);
  g.bezierCurveTo(-size * .05, side * size * 1.1, -size * .45 + sway, side * size * 1.45, -size * .95 + sway, side * size * 1.55);
  g.quadraticCurveTo(-size * .55, side * size * .9, -size * .5, side * size * .25);
  g.closePath();
};
const angelTail = (size: number, wag: number) => {
  g.beginPath(); g.moveTo(-size * .5, 0);
  g.quadraticCurveTo(-size * .8, -size * .32 + wag * .6, -size * 1.05, -size * .42 + wag);
  g.quadraticCurveTo(-size * .95, wag, -size * 1.05, size * .42 + wag);
  g.quadraticCurveTo(-size * .8, size * .32 + wag * .6, -size * .5, 0);
  g.closePath();
};
const drawAngel: Painter = (look, size, { wag, sway }) => {
  const base = ANGEL[look.variant % ANGEL.length], inkColor = shade(base, -.72), fin = shade(base, -.06), stripe = shade(base, -.7);
  const pen = { color: inkColor, size };
  for (const [x, y, side] of [[-size * 1.05, -size * .42 + wag, -1], [-size * 1.05, size * .42 + wag, 1]]) {
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(-size * 1.2, y + side * size * .08, -size * 1.4 + sway * -side, y + side * size * .03); ink(pen, .9);
  }
  g.beginPath(); g.moveTo(size * .3, size * .45); g.quadraticCurveTo(size * .1, size * .9, -size * .25 + sway, size * 1.25); ink(pen, .9);
  shape(() => angelTail(size, wag), fin, pen);
  streaks(shade(base, -.4), size, [[-size * .7, -size * .08 + wag * .4, -size * .98, -size * .32 + wag], [-size * .7, wag * .4, -size * .95, wag], [-size * .7, size * .08 + wag * .4, -size * .98, size * .32 + wag]]);

  // a null fill marks the body, which gets the gradient and the shine
  const parts: [() => void, string | null][] = [[() => angelFin(size, sway, -1), fin], [() => angelFin(size, -sway, 1), fin], [() => angelBody(size), null]];
  for (const [path, fill] of parts) {
    path(); g.fillStyle = fill || bodyFill([shade(base, .3), base, shade(base, -.15)], -size * .54, size * .54); g.fill();
    g.save(); path(); g.clip();
    g.fillStyle = stripe;
    for (const x of [.42, .02, -.4]) g.fillRect(x * size - size * .05, -size * 1.6, size * .1, size * 3.2);
    if (!fill) shine([size * .2, -size * .3, size * .22, size * .07, -.4], [[-size * .2, -size * .3, size * .04], [-size * .26, -size * .16, size * .03]]);
    g.restore();
    path(); ink(pen);
  }
  eye([size * .52, -size * .12], size * .14, inkColor);
  pout(size * .85, size * .04, pen);
};

const PUFFER = ['#f0c955', '#a8cf6a', '#e3a868'];
const pufferBody = (size: number) => { g.beginPath(); g.ellipse(size * .05, 0, size * .62, size * .55, 0, 0, TAU); };
const pufferTail = (size: number, wag: number) => {
  g.beginPath(); g.moveTo(-size * .5, 0);
  g.quadraticCurveTo(-size * .72, -size * .26 + wag * .6, -size * .92, -size * .24 + wag);
  g.quadraticCurveTo(-size * .82, wag, -size * .92, size * .24 + wag);
  g.quadraticCurveTo(-size * .72, size * .26 + wag * .6, -size * .5, 0);
  g.closePath();
};
const paintPufferSpikes = (base: string, pen: Ink) => {
  const size = pen.size;
  g.fillStyle = shade(base, -.1); g.strokeStyle = pen.color; g.lineWidth = Math.max(.7, size * .02); g.lineJoin = 'round';
  for (let index = 0; index < 22; index++) {
    const angle = index / 22 * TAU, outX = Math.cos(angle), outY = Math.sin(angle), centerX = size * .05;
    const baseX = centerX + outX * size * .58, baseY = outY * size * .51, halfWidth = size * .045;
    g.beginPath(); g.moveTo(baseX - outY * halfWidth, baseY + outX * halfWidth); g.lineTo(centerX + outX * size * .74, outY * size * .67); g.lineTo(baseX + outY * halfWidth, baseY - outX * halfWidth); g.fill(); g.stroke();
  }
};
const drawPuffer: Painter = (look, size, { wag, sway, phase }) => {
  const base = PUFFER[look.variant % PUFFER.length], inkColor = shade(base, -.68), fin = shade(base, -.08);
  const pen = { color: inkColor, size };
  shape(() => pufferTail(size, wag), fin, pen);
  streaks(shade(base, -.45), size, [[-size * .62, -size * .04 + wag * .5, -size * .86, -size * .18 + wag], [-size * .62, size * .04 + wag * .5, -size * .86, size * .18 + wag]]);
  for (const side of [-1, 1]) {
    shape(() => { g.beginPath(); g.moveTo(-size * .3, side * size * .45); g.quadraticCurveTo(-size * .5 + sway * side, side * size * .74, -size * .56, side * size * .5); g.closePath(); }, fin, pen);
  }
  paintPufferSpikes(base, pen);
  const gradient = g.createRadialGradient(-size * .05, -size * .22, size * .08, size * .05, 0, size * .65);
  gradient.addColorStop(0, shade(base, .35)); gradient.addColorStop(1, shade(base, -.1));
  g.fillStyle = gradient; pufferBody(size); g.fill();
  g.save(); pufferBody(size); g.clip();
  g.fillStyle = '#fbf7ec'; g.beginPath(); g.ellipse(size * .05, size * .4, size * .62, size * .32, 0, 0, TAU); g.fill();
  g.fillStyle = shade(base, -.45);
  look.spots.forEach(spot => { g.beginPath(); g.arc(spot.x * .5 * size - size * .1, (spot.y * .6 - .1) * size, size * .045, 0, TAU); g.fill(); });
  shine([-size * .12, -size * .32, size * .22, size * .08, -.5], [[-size * .36, -size * .14, size * .045], [-size * .3, -size * .02, size * .03]]);
  g.restore();
  pufferBody(size); ink(pen);
  g.save(); g.translate(size * .12, size * .1); g.rotate(Math.sin(phase * 3) * .5);
  shape(() => { g.beginPath(); g.ellipse(-size * .1, 0, size * .14, size * .07, 0, 0, TAU); }, fin, pen);
  g.restore();
  eye([size * .4, -size * .16], size * .2, inkColor);
  g.beginPath(); g.ellipse(size * .66, size * .1, size * .05, size * .045, 0, 0, TAU); g.fillStyle = '#c4574a'; g.fill(); ink(pen, .9, .7);
};

export const CLASSIC_FISH: Pick<Record<Species, Creature>, 'tropical' | 'koi' | 'sturgeon' | 'angelfish' | 'puffer'> = {
  tropical: { paint: drawTropical, outline: size => [() => tropicalTail(size, 0), () => tropicalBody(size)] },
  koi: { paint: drawKoi, outline: size => [() => koiTail(size, 0), () => koiBody(size)] },
  sturgeon: { paint: drawSturgeon, outline: size => [() => sturgeonTail(size, 0), () => sturgeonBody(size)] },
  angelfish: {
    paint: drawAngel,
    outline: size => [() => angelTail(size, 0), () => angelFin(size, 0, -1), () => angelFin(size, 0, 1), () => angelBody(size)],
  },
  puffer: { paint: drawPuffer, outline: size => [() => pufferTail(size, 0), () => pufferBody(size)] },
};
