import type { Species } from '../species';
import { shade, TAU } from '../util';
import type { Creature, Painter } from './fishLook';
import type { Point } from './fishPen';
import { bodyFill, eye, g, ink, shape, shine, streaks, tube } from './fishPen';

// Squid: swims mantle first, fins at the tip, big eyes, arms and two long tentacles trailing behind
const SQUID = ['#ff8fa3', '#c38bff', '#ffb36b', '#7fe0ff'];
const squidMantle = (size: number) => {
  g.beginPath(); g.moveTo(size * 1.12, 0);
  g.bezierCurveTo(size * .95, -size * .3, size * .2, -size * .4, -size * .42, -size * .34);
  g.quadraticCurveTo(-size * .6, 0, -size * .42, size * .34);
  g.bezierCurveTo(size * .2, size * .4, size * .95, size * .3, size * 1.12, 0);
  g.closePath();
};
const squidFins = (size: number) => {
  g.beginPath();
  for (const side of [-1, 1]) { g.moveTo(size * 1.1, 0); g.quadraticCurveTo(size * .95, side * size * .55, size * .62, side * size * .58); g.quadraticCurveTo(size * .6, side * size * .3, size * .42, side * size * .3); }
  g.closePath();
};
const squidHead = (size: number) => { g.beginPath(); g.ellipse(-size * .58, 0, size * .26, size * .27, 0, 0, TAU); };
const drawSquid: Painter = (look, size) => {
  const base = SQUID[look.variant % SQUID.length], inkColor = shade(base, -.65), arm = shade(base, -.08), dark = shade(base, -.3);
  const pen = { color: inkColor, size };
  // arms (eight short, two long tentacles with clubs), drawn first so the head covers their roots
  const arms = [-.2, -.13, -.06, 0, .06, .13, .2].map((y, index) => [y, 1.3 + (index % 3) * .1] as const);
  for (const [y, length] of arms) tube(() => { g.beginPath(); g.moveTo(-size * .7, y * size);
    g.bezierCurveTo(-size * 1, y * size * 1.6 + size * .05, -size * 1.15, y * size * 2 - size * .05, -size * length, y * size * 2.2); }, { width: size * .07, fill: arm }, pen);
  for (const side of [-1, 1]) {
    tube(() => { g.beginPath(); g.moveTo(-size * .7, side * size * .05); g.bezierCurveTo(-size * 1.1, side * size * .2, -size * 1.35, -side * size * .05, -size * 1.62, side * size * .18); }, { width: size * .045, fill: arm }, pen);
    shape(() => { g.beginPath(); g.ellipse(-size * 1.66, side * size * .19, size * .1, size * .05, side * .3, 0, TAU); }, arm, pen);
  }
  shape(() => squidFins(size), shade(base, .1), pen);
  g.fillStyle = bodyFill([shade(base, .35), base, shade(base, -.2)], -size * .4, size * .4); squidMantle(size); g.fill();
  g.save(); squidMantle(size); g.clip();
  g.fillStyle = dark; g.globalAlpha = .5; // chromatophore spots
  look.spots.forEach(spot => { g.beginPath(); g.arc((spot.x * .7 + .35) * size, spot.y * .7 * size, size * (.04 + spot.rx * .15), 0, TAU); g.fill(); });
  g.globalAlpha = 1;
  shine([size * .35, -size * .2, size * .38, size * .06, -.05], [[size * .85, -size * .1, size * .035], [-size * .05, -size * .22, size * .03]]);
  g.restore();
  squidMantle(size); ink(pen);
  shape(() => squidHead(size), bodyFill([shade(base, .25), base, shade(base, -.15)], -size * .27, size * .27), pen);
  eye([-size * .55, -size * .06], size * .2, inkColor);
};

// Shrimp: curved, segmented, a spiky rostrum, long antennae sweeping back, little legs and a tail fan
const SHRIMP = ['#ff8a6b', '#ff6f91', '#ffa94d', '#ff5c5c'];
const shrimpBody = (size: number) => {
  g.beginPath(); g.moveTo(size * .85, -size * .06);
  g.bezierCurveTo(size * .72, -size * .52, -size * .2, -size * .6, -size * .86, -size * .16);
  g.lineTo(-size * .9, size * .06);
  g.bezierCurveTo(-size * .3, size * .14, size * .3, size * .32, size * .85, size * .12);
  g.closePath();
};
const shrimpTail = (size: number) => {
  g.beginPath(); g.moveTo(-size * .84, -size * .08);
  g.quadraticCurveTo(-size * 1.05, -size * .42, -size * 1.28, -size * .36);
  g.quadraticCurveTo(-size * 1.2, -size * .1, -size * 1.34, size * .02);
  g.quadraticCurveTo(-size * 1.18, size * .14, -size * 1.24, size * .34);
  g.quadraticCurveTo(-size * 1.02, size * .3, -size * .86, size * .06);
  g.closePath();
};
const drawShrimp: Painter = (look, size) => {
  const base = SHRIMP[look.variant % SHRIMP.length], inkColor = shade(base, -.65), limb = shade(base, -.12);
  const pen = { color: inkColor, size };
  for (const [x, length] of [[.5, .2], [.3, .26], [.1, .28], [-.12, .26], [-.34, .22]]) // walking and swimming legs
    tube(() => { g.beginPath(); g.moveTo(x * size, size * .16); g.quadraticCurveTo((x - .02) * size, (.2 + length * .6) * size, (x - .08) * size, (.2 + length) * size); }, { width: size * .035, fill: limb }, pen);
  tube(() => { g.beginPath(); g.moveTo(size * .82, -size * .1); g.bezierCurveTo(size * .9, -size * .75, -size * .1, -size * .9, -size * .65, -size * .72); }, { width: size * .02, fill: limb }, pen);
  tube(() => { g.beginPath(); g.moveTo(size * .84, -size * .06); g.bezierCurveTo(size * 1.05, -size * .6, size * .2, -size * .78, -size * 1.05, -size * .58); }, { width: size * .02, fill: limb }, pen);
  shape(() => shrimpTail(size), shade(base, .05), pen);
  streaks(shade(base, -.45), size, [[-size * .9, -size * .02, -size * 1.22, -size * .3], [-size * .92, size * .02, -size * 1.28, size * .02], [-size * .9, size * .05, -size * 1.18, size * .28]]);
  shape(() => { g.beginPath(); g.moveTo(size * .78, -size * .2); g.lineTo(size * 1.18, -size * .26); g.lineTo(size * .84, -size * .06); g.closePath(); }, shade(base, .15), pen);
  g.fillStyle = bodyFill([shade(base, .35), base, shade(base, -.15)], -size * .55, size * .3); shrimpBody(size); g.fill();
  g.save(); shrimpBody(size); g.clip();
  g.strokeStyle = inkColor; g.globalAlpha = .45; g.lineWidth = Math.max(.8, size * .03); // shell segments
  for (const x of [.3, .02, -.24, -.48, -.7]) { g.beginPath(); g.moveTo(x * size, -size * .6); g.quadraticCurveTo((x - .1) * size, -size * .1, (x + .02) * size, size * .4); g.stroke(); }
  g.globalAlpha = 1;
  g.fillStyle = shade(base, .45); g.globalAlpha = .5;
  g.beginPath(); g.ellipse(-size * .05, size * .14, size * .7, size * .07, .08, 0, TAU); g.fill(); g.globalAlpha = 1;
  shine([size * .1, -size * .35, size * .32, size * .06, -.12], [[-size * .4, -size * .28, size * .035], [size * .5, -size * .32, size * .03]]);
  g.restore();
  shrimpBody(size); ink(pen);
  eye([size * .62, -size * .2], size * .14, inkColor);
};

// Lobster: carapace and segmented tail, two big claws reaching forward, long antennae, a tail fan
const LOBSTER = ['#d9412b', '#e8642c', '#3d6fd9', '#c43a6a'];
const lobsterShell = (size: number) => {
  g.beginPath(); g.moveTo(size * .8, -size * .02);
  g.bezierCurveTo(size * .7, -size * .38, size * .1, -size * .4, -size * .2, -size * .3);
  g.bezierCurveTo(-size * .55, -size * .26, -size * .85, -size * .2, -size * 1.02, -size * .1);
  g.lineTo(-size * 1.02, size * .1);
  g.bezierCurveTo(-size * .85, size * .2, -size * .55, size * .26, -size * .2, size * .3);
  g.bezierCurveTo(size * .1, size * .4, size * .7, size * .34, size * .8, -size * .02);
  g.closePath();
};
const lobsterFan = (size: number) => {
  g.beginPath(); g.moveTo(-size * 1, -size * .1);
  g.quadraticCurveTo(-size * 1.2, -size * .38, -size * 1.42, -size * .3);
  g.quadraticCurveTo(-size * 1.32, 0, -size * 1.42, size * .3);
  g.quadraticCurveTo(-size * 1.2, size * .38, -size * 1, size * .1);
  g.closePath();
};
const lobsterClaw = (size: number, side: number) => {
  const y = side * size * .42;
  g.beginPath(); g.moveTo(size * .95, y);
  g.bezierCurveTo(size * 1.05, y - size * .22, size * 1.5, y - size * .22, size * 1.66, y - size * .04); // upper jaw
  g.quadraticCurveTo(size * 1.4, y - size * .02, size * 1.3, y + size * .02);
  g.quadraticCurveTo(size * 1.45, y + size * .06, size * 1.6, y + size * .1);                       // lower jaw
  g.bezierCurveTo(size * 1.4, y + size * .22, size * 1.05, y + size * .2, size * .95, y);
  g.closePath();
};
const drawLobster: Painter = (look, size) => {
  const base = LOBSTER[look.variant % LOBSTER.length], inkColor = shade(base, -.65), limb = shade(base, -.12), light = shade(base, .3);
  const pen = { color: inkColor, size };
  for (const x of [.45, .25, .05]) tube(() => { g.beginPath(); g.moveTo(x * size, size * .25); g.quadraticCurveTo((x + .05) * size, size * .45, (x - .05) * size, size * .58); }, { width: size * .04, fill: limb }, pen);
  for (const side of [-1, 1]) tube(() => { g.beginPath(); g.moveTo(size * .7, side * size * .16); g.quadraticCurveTo(size * .82, side * size * .4, size * 1, side * size * .42); }, { width: size * .09, fill: limb }, pen);
  tube(() => { g.beginPath(); g.moveTo(size * .78, -size * .12); g.bezierCurveTo(size * 1.1, -size * .55, size * 1.45, -size * .75, size * 1.72, -size * .62); }, { width: size * .025, fill: limb }, pen);
  tube(() => { g.beginPath(); g.moveTo(size * .8, -size * .08); g.bezierCurveTo(size * .9, -size * .5, size * .55, -size * .78, size * .2, -size * .74); }, { width: size * .025, fill: limb }, pen);
  shape(() => lobsterFan(size), shade(base, .05), pen);
  streaks(shade(base, -.45), size, [[-size * 1.05, -size * .05, -size * 1.36, -size * .24], [-size * 1.05, 0, -size * 1.36, 0], [-size * 1.05, size * .05, -size * 1.36, size * .24]]);
  g.fillStyle = bodyFill([light, base, shade(base, -.2)], -size * .4, size * .4); lobsterShell(size); g.fill();
  g.save(); lobsterShell(size); g.clip();
  g.strokeStyle = inkColor; g.globalAlpha = .45; g.lineWidth = Math.max(.8, size * .03); // tail segments
  for (const x of [-.2, -.4, -.6, -.8]) { g.beginPath(); g.moveTo(x * size, -size * .4); g.quadraticCurveTo((x - .06) * size, 0, x * size, size * .4); g.stroke(); }
  g.globalAlpha = 1;
  g.fillStyle = shade(base, -.35); g.globalAlpha = .35; // bumpy shell
  look.spots.forEach(spot => { g.beginPath(); g.arc((spot.x * .35 + .35) * size, spot.y * .5 * size, size * .03, 0, TAU); g.fill(); });
  g.globalAlpha = 1;
  shine([size * .3, -size * .2, size * .3, size * .06, -.1], [[-size * .3, -size * .18, size * .035], [-size * .62, -size * .12, size * .03]]);
  g.restore();
  lobsterShell(size); ink(pen);
  for (const side of [1, -1]) { // the far claw first
    g.fillStyle = bodyFill([light, base, shade(base, -.2)], side * size * .42 - size * .2, side * size * .42 + size * .2); lobsterClaw(size, side); g.fill(); ink(pen);
    shine([size * 1.25, side * size * .42 - size * .1, size * .14, size * .03, -.05], []);
  }
  eye([size * .6, -size * .14], size * .13, inkColor);
};

// Octopus, facing you: a domed head with big eyes and a grin, and eight arms spreading out to both sides and curling
// up at the tips, with suckers along them. Swimming bends it like the others, which makes the trailing arms ripple.
const OCTOPUS = ['#c35bd8', '#e8556d', '#ff8a5c', '#5b8de8'];
const ARM_STEPS = 30;
const octopusHead = (size: number) => {
  g.beginPath(); g.moveTo(-size * .42, size * .08);
  g.bezierCurveTo(-size * .62, -size * .35, -size * .42, -size * .92, 0, -size * .92);
  g.bezierCurveTo(size * .42, -size * .92, size * .62, -size * .35, size * .42, size * .08);
  g.quadraticCurveTo(0, size * .3, -size * .42, size * .08);
  g.closePath();
};
/** An arm as points: from [x, y, direction, turn, length] it leaves the head and turns more and more, rolling up at the tip. */
const octopusArm = (size: number, [startX, startY, direction, turn, length]: number[]): Point[] => {
  const points: Point[] = [[startX * size, startY * size]];
  let x = startX, y = startY, angle = direction;
  for (let index = 1; index <= ARM_STEPS; index++) {
    const along = index / ARM_STEPS;
    angle += turn * (along < .7 ? .6 : 3.2) / ARM_STEPS; // gently along the arm, sharply in the curl
    const step = length / ARM_STEPS * (1 - along * .45);
    x += Math.cos(angle) * step; y += Math.sin(angle) * step;
    points.push([x * size, y * size]);
  }
  return points;
};
interface TaperStroke { start: number; end: number; color: string; extra: number }
const taper = (points: Point[], { start, end, color, extra }: TaperStroke) => {
  g.strokeStyle = color; g.lineCap = 'round';
  for (let index = 1; index < points.length; index++) {
    g.lineWidth = start + (end - start) * index / points.length + extra;
    g.beginPath(); g.moveTo(...points[index - 1]); g.lineTo(...points[index]); g.stroke();
  }
};
// right-hand arms as [start x, start y, direction, turn, length]; the left ones mirror them
const OCTOPUS_ARMS = [[.3, -.04, -.35, -2.4, 1.3], [.36, .08, .2, -2.3, 1.4], [.28, .18, .85, -2.5, 1.25], [.1, .24, 1.4, -2.2, 1.05]];
const octopusArms = (size: number) => OCTOPUS_ARMS.flatMap(([x, y, direction, turn, length]) => [
  { points: octopusArm(size, [x, y, direction, turn, length]), side: Math.sign(turn) },
  { points: octopusArm(size, [-x, y, Math.PI - direction, -turn, length]), side: -Math.sign(turn) },
]);
/** The glow around the arms: each arm traced a little wider than itself, in the halo's colour and blur. */
const octopusArmsGlow = (size: number) => {
  const glowColor = g.strokeStyle as string, glowWidth = g.lineWidth;
  for (const { points } of octopusArms(size)) taper(points, { start: size * .2 + glowWidth, end: size * .04 + glowWidth, color: glowColor, extra: 0 });
  g.beginPath(); // paintFish strokes the current path after this; there's nothing left to stroke
};
/** Suckers on the inside of each curl. */
const paintSuckers = ({ points, side }: { points: Point[]; side: number }, [start, end]: number[], size: number) => {
  const sucker = '#ffb978';
  for (let index = 4; index < points.length - 2; index += 2) {
    const [x0, y0] = points[index - 1], [x1, y1] = points[index + 1], distance = Math.hypot(x1 - x0, y1 - y0) || 1;
    const width = start + (end - start) * index / points.length, normalX = -(y1 - y0) / distance * side, normalY = (x1 - x0) / distance * side;
    g.fillStyle = sucker; g.beginPath(); g.arc(points[index][0] + normalX * width * .5, points[index][1] + normalY * width * .5, width * .24, 0, TAU); g.fill();
    g.strokeStyle = shade(sucker, -.35); g.lineWidth = Math.max(.5, size * .012); g.stroke();
  }
};
const drawOctopus: Painter = (look, size) => {
  const base = OCTOPUS[look.variant % OCTOPUS.length], inkColor = shade(base, -.62), edge = Math.max(1.1, size * .045) * 2;
  const pen = { color: inkColor, size };
  const arms = octopusArms(size), start = size * .2, end = size * .04;
  for (const { points } of arms) taper(points, { start, end, color: inkColor, extra: edge }); // all ink edges first, so the arms blend where they meet
  for (const { points } of arms) taper(points, { start, end, color: shade(base, -.05), extra: 0 });
  for (const arm of arms) paintSuckers(arm, [start, end], size);
  g.fillStyle = bodyFill([shade(base, .35), base, shade(base, -.15)], -size * .92, size * .2); octopusHead(size); g.fill();
  g.save(); octopusHead(size); g.clip();
  g.fillStyle = shade(base, -.22); g.globalAlpha = .5; // freckles on the dome
  look.spots.forEach(spot => { g.beginPath(); g.arc(spot.x * .4 * size, (spot.y * .6 - .55) * size, size * (.03 + spot.ry * .12), 0, TAU); g.fill(); });
  g.globalAlpha = 1;
  shine([-size * .12, -size * .68, size * .2, size * .1, -.5], [[size * .2, -size * .74, size * .04], [-size * .3, -size * .45, size * .03]]);
  g.restore();
  octopusHead(size); ink(pen);
  eye([-size * .15, -size * .2], size * .14, inkColor); eye([size * .15, -size * .2], size * .14, inkColor);
  g.beginPath(); g.moveTo(-size * .07, 0); g.quadraticCurveTo(0, size * .06, size * .07, 0); ink(pen, .85, .8);
};

export const INVERTEBRATES: Pick<Record<Species, Creature>, 'squid' | 'shrimp' | 'lobster' | 'octopus'> = {
  squid: { paint: drawSquid, outline: size => [() => squidFins(size), () => squidMantle(size), () => squidHead(size)] },
  shrimp: { paint: drawShrimp, outline: size => [() => shrimpTail(size), () => shrimpBody(size)] },
  lobster: {
    paint: drawLobster,
    outline: size => [() => lobsterFan(size), () => lobsterShell(size), () => lobsterClaw(size, -1), () => lobsterClaw(size, 1)],
  },
  octopus: { paint: drawOctopus, outline: size => [() => octopusArmsGlow(size), () => octopusHead(size)] },
};
