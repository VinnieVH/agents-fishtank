import { TAU } from '../util';

// The school, in units of length/100: where each bell's rim sits, its radius and its place in the pulse
const SCHOOL: [x: number, y: number, radius: number, offset: number][] = [
  [-32, -16, 9, 0], [-9, -30, 7, 1.7], [13, -10, 10.5, 3.1], [35, -24, 6.5, .8],
  [-24, 14, 7.5, 2.4], [5, 18, 6, 4.2], [30, 10, 8, 5.3],
];
const TINTS = ['#f6a8d8', '#c7a8ff', '#ffc2a8', '#a8d8ff'];
const GLOWS = ['#8ff7ff', '#e0a0ff', '#8fffc8'];
const TENTACLES = 7;
const RINGS = [[-.3, .36], [.3, .36], [-.13, .6], [.13, .6]];

const rgba = (hex: string, alpha: number) => {
  const rgb = parseInt(hex.slice(1), 16);
  return `rgba(${rgb >> 16},${rgb >> 8 & 255},${rgb & 255},${alpha})`;
};

interface Jelly { index: number; radius: number; w: number; h: number; phase: number }

/** A squeeze of the bell: 0 relaxed to 1 fully closed, quick to close and slow to open again. */
const squeeze = (phase: number) => {
  const cycle = (phase % TAU + TAU) % TAU / TAU;
  return cycle < .3 ? Math.sin(cycle / .3 * Math.PI / 2) : Math.cos((cycle - .3) / .7 * Math.PI / 2);
};

/** Calls `draw` for every jelly with the origin at the middle of its rim. */
const eachJelly = (g: CanvasRenderingContext2D, phase: number, draw: (jelly: Jelly) => void) => {
  SCHOOL.forEach(([x, y, radius, offset], index) => {
    const jellyPhase = phase + offset, closed = squeeze(jellyPhase);
    g.save(); g.translate(x, y - 2.5 * Math.sin(jellyPhase - .6)); // each rises as it squeezes and sinks back slowly
    draw({ index, radius, w: radius * (1 - .2 * closed), h: radius * (.85 + .2 * closed), phase: jellyPhase });
    g.restore();
  });
};

const traceBell = (g: CanvasRenderingContext2D, w: number, h: number) => {
  g.beginPath(); g.moveTo(-w, 0);
  g.bezierCurveTo(-w * 1.02, -h * 1.3, w * 1.02, -h * 1.3, w, 0);
  g.quadraticCurveTo(0, -h * .28, -w, 0);
  g.closePath();
};

/** Height of the bell's underside at x, which bows up a little in the middle. */
const rimY = (x: number, w: number, h: number) => { const t = (x + w) / (2 * w); return -.56 * h * t * (1 - t); };

/** Points along one trailing tentacle, swaying more the further down. */
const tentaclePoints = (jelly: Jelly, tentacle: number): [number, number][] => {
  const rootX = -jelly.w * .85 + jelly.w * 1.7 * tentacle / (TENTACLES - 1);
  const length = jelly.radius * (2.3 + (tentacle * 7 % 3) * .35), points: [number, number][] = [];
  for (let step = 0; step <= 8; step++) {
    const along = step / 8;
    points.push([rootX + Math.sin(jelly.phase * .7 - along * 2.4 + tentacle) * jelly.radius * .22 * along, rimY(rootX, jelly.w, jelly.h) + length * along]);
  }
  return points;
};

const paintTentacles = (g: CanvasRenderingContext2D, jelly: Jelly, tint: string) => {
  g.strokeStyle = rgba(tint, .6); g.lineWidth = .35;
  for (let tentacle = 0; tentacle < TENTACLES; tentacle++) {
    g.beginPath();
    for (const [x, y] of tentaclePoints(jelly, tentacle)) g.lineTo(x, y);
    g.stroke();
  }
};

/** Four frilly oral arms hanging from the middle. */
const paintOralArms = (g: CanvasRenderingContext2D, jelly: Jelly, tint: string) => {
  const { radius, w, h, phase } = jelly;
  g.strokeStyle = rgba(tint, .45); g.lineWidth = radius * .16;
  for (let arm = 0; arm < 4; arm++) {
    const rootX = (arm - 1.5) * w * .16;
    g.beginPath(); g.moveTo(rootX, -h * .1);
    for (let step = 1; step <= 6; step++) g.lineTo(rootX + Math.sin(phase * .8 - step * .9 + arm * 1.3) * radius * .12 * step / 6, -h * .1 + radius * 1.4 * step / 6);
    g.stroke();
  }
};

/** The see-through bell, brighter at the top, with the four rings a moon jelly is known for and a frilled rim. */
const paintBell = (g: CanvasRenderingContext2D, jelly: Jelly, tint: string) => {
  const { radius, w, h } = jelly;
  const body = g.createRadialGradient(0, -h * .7, radius * .1, 0, -h * .4, radius * 1.1);
  body.addColorStop(0, 'rgba(255,255,255,.75)'); body.addColorStop(.5, rgba(tint, .55)); body.addColorStop(1, rgba(tint, .35));
  g.fillStyle = body; traceBell(g, w, h); g.fill();
  g.strokeStyle = rgba(tint, .8); g.lineWidth = .4; g.stroke();

  g.strokeStyle = rgba(tint, .55); g.lineWidth = radius * .08;
  for (const [x, y] of RINGS) { g.beginPath(); g.arc(x * w, -y * h, radius * .13, 0, TAU); g.stroke(); }

  g.fillStyle = rgba(tint, .7);
  for (let frill = 0; frill <= 8; frill++) { const x = -w + w * 2 * frill / 8; g.beginPath(); g.arc(x, rimY(x, w, h), radius * .09, 0, TAU); g.fill(); }
};

// Draws a small school of moon jellies in units of length/100, origin mid-school
export const paintJellyfish = (g: CanvasRenderingContext2D, length: number, phase: number) => {
  g.save(); g.scale(length / 100, length / 100);
  eachJelly(g, phase, jelly => {
    const tint = TINTS[jelly.index % TINTS.length];
    g.lineCap = 'round';
    paintTentacles(g, jelly, tint);
    paintOralArms(g, jelly, tint);
    paintBell(g, jelly, tint);
  });
  g.restore();
};

// What lights up at night: the rim and a few sparks down the tentacles
export const paintJellyGlow = (g: CanvasRenderingContext2D, length: number, phase: number) => {
  g.save(); g.scale(length / 100, length / 100);
  eachJelly(g, phase, jelly => {
    const { radius, w, h } = jelly, glow = GLOWS[jelly.index % GLOWS.length];
    g.strokeStyle = glow; g.lineWidth = .7; traceBell(g, w, h); g.stroke();
    g.fillStyle = glow;
    for (let frill = 0; frill <= 8; frill++) { const x = -w + w * 2 * frill / 8; g.beginPath(); g.arc(x, rimY(x, w, h), radius * .08, 0, TAU); g.fill(); }
    for (let tentacle = 0; tentacle < TENTACLES; tentacle += 2) {
      for (const [x, y] of tentaclePoints(jelly, tentacle).filter((_, step) => step % 3 === 2)) { g.beginPath(); g.arc(x, y, .35, 0, TAU); g.fill(); }
    }
  });
  g.restore();
};
