import { TAU } from '../util';

// The school, in units of L/100: where each bell's rim sits, its radius and its place in the pulse
const SCHOOL: [x: number, y: number, r: number, off: number][] = [
  [-32, -16, 9, 0], [-9, -30, 7, 1.7], [13, -10, 10.5, 3.1], [35, -24, 6.5, .8],
  [-24, 14, 7.5, 2.4], [5, 18, 6, 4.2], [30, 10, 8, 5.3],
];
const TINTS = ['#f6a8d8', '#c7a8ff', '#ffc2a8', '#a8d8ff'];
const GLOWS = ['#8ff7ff', '#e0a0ff', '#8fffc8'];

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`;
};

interface Jelly { i: number; r: number; w: number; h: number; p: number }

/** A squeeze of the bell: 0 relaxed to 1 fully closed, quick to close and slow to open again. */
function squeeze(p: number) {
  const s = (p % TAU + TAU) % TAU / TAU;
  return s < .3 ? Math.sin(s / .3 * Math.PI / 2) : Math.cos((s - .3) / .7 * Math.PI / 2);
}

/** Calls `draw` for every jelly with the origin at the middle of its rim, in units of L/100. */
function eachJelly(g: CanvasRenderingContext2D, L: number, ph: number, draw: (j: Jelly) => void) {
  g.save(); g.scale(L / 100, L / 100);
  SCHOOL.forEach(([x, y, r, off], i) => {
    const p = ph + off, c = squeeze(p);
    g.save(); g.translate(x, y - 2.5 * Math.sin(p - .6)); // each rises as it squeezes and sinks back slowly
    draw({ i, r, w: r * (1 - .2 * c), h: r * (.85 + .2 * c), p });
    g.restore();
  });
  g.restore();
}

function bell(g: CanvasRenderingContext2D, w: number, h: number) {
  g.beginPath(); g.moveTo(-w, 0);
  g.bezierCurveTo(-w * 1.02, -h * 1.3, w * 1.02, -h * 1.3, w, 0);
  g.quadraticCurveTo(0, -h * .28, -w, 0);
  g.closePath();
}

/** Height of the bell's underside at x, which bows up a little in the middle. */
const rimY = (x: number, w: number, h: number) => { const t = (x + w) / (2 * w); return -.56 * h * t * (1 - t); };

/** Points along one trailing tentacle, swaying more the further down. */
function tentacle(j: Jelly, k: number, n: number): [number, number][] {
  const x0 = -j.w * .85 + j.w * 1.7 * k / (n - 1), len = j.r * (2.3 + (k * 7 % 3) * .35), pts: [number, number][] = [];
  for (let s = 0; s <= 8; s++) {
    const d = s / 8;
    pts.push([x0 + Math.sin(j.p * .7 - d * 2.4 + k) * j.r * .22 * d, rimY(x0, j.w, j.h) + len * d]);
  }
  return pts;
}

// Draws a small school of moon jellies, origin mid-school
export function paintJellyfish(g: CanvasRenderingContext2D, L: number, ph: number) {
  eachJelly(g, L, ph, j => {
    const { r, w, h, p } = j, tint = TINTS[j.i % TINTS.length];
    g.lineCap = 'round';

    // trailing tentacles
    g.strokeStyle = rgba(tint, .6); g.lineWidth = .35;
    for (let k = 0; k < 7; k++) {
      g.beginPath();
      for (const [x, y] of tentacle(j, k, 7)) g.lineTo(x, y);
      g.stroke();
    }

    // four frilly oral arms hanging from the middle
    g.strokeStyle = rgba(tint, .45); g.lineWidth = r * .16;
    for (let k = 0; k < 4; k++) {
      const x0 = (k - 1.5) * w * .16;
      g.beginPath(); g.moveTo(x0, -h * .1);
      for (let s = 1; s <= 6; s++) g.lineTo(x0 + Math.sin(p * .8 - s * .9 + k * 1.3) * r * .12 * s / 6, -h * .1 + r * 1.4 * s / 6);
      g.stroke();
    }

    // see-through bell, brighter at the top
    const body = g.createRadialGradient(0, -h * .7, r * .1, 0, -h * .4, r * 1.1);
    body.addColorStop(0, 'rgba(255,255,255,.75)'); body.addColorStop(.5, rgba(tint, .55)); body.addColorStop(1, rgba(tint, .35));
    g.fillStyle = body; bell(g, w, h); g.fill();
    g.strokeStyle = rgba(tint, .8); g.lineWidth = .4; g.stroke();

    // the four rings a moon jelly is known for, in a clover seen through the bell
    g.strokeStyle = rgba(tint, .55); g.lineWidth = r * .08;
    for (const [x, y] of [[-.3, .36], [.3, .36], [-.13, .6], [.13, .6]]) { g.beginPath(); g.arc(x * w, -y * h, r * .13, 0, TAU); g.stroke(); }

    // frilled rim
    g.fillStyle = rgba(tint, .7);
    for (let k = 0; k <= 8; k++) { const x = -w + w * 2 * k / 8; g.beginPath(); g.arc(x, rimY(x, w, h), r * .09, 0, TAU); g.fill(); }
  });
}

// What lights up at night: the rim and a few sparks down the tentacles
export function paintJellyGlow(g: CanvasRenderingContext2D, L: number, ph: number) {
  eachJelly(g, L, ph, j => {
    const { r, w, h } = j, glow = GLOWS[j.i % GLOWS.length];
    g.strokeStyle = glow; g.lineWidth = .7; bell(g, w, h); g.stroke();
    g.fillStyle = glow;
    for (let k = 0; k <= 8; k++) { const x = -w + w * 2 * k / 8; g.beginPath(); g.arc(x, rimY(x, w, h), r * .08, 0, TAU); g.fill(); }
    for (let k = 0; k < 7; k += 2) for (const [x, y] of tentacle(j, k, 7).filter((_, s) => s % 3 === 2)) { g.beginPath(); g.arc(x, y, .35, 0, TAU); g.fill(); }
  });
}
