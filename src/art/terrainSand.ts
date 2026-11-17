import { rng, shade, TAU } from '../util';
import { ellipse, g, ink, toon } from './sceneryPen';
import type { Point } from './sceneryPen';

export interface Tank { width: number; height: number }

/** The front sand's wavy top edge. */
export const sandTop = (x: number, sandLine: number) => sandLine - Math.sin(x / 120 + 1) * 10 - Math.sin(x / 37) * 3;

/** A wavy edge across the tank, every `step` px: its top line, and the shape filled from it down to the bottom. */
export const wavyEdge = ({ width, height }: Tank, step: number, edgeAt: (x: number) => number) => {
  const top = new Path2D(), fill = new Path2D();
  fill.moveTo(0, height);
  for (let x = 0; x <= width + step; x += step) {
    const y = edgeAt(x);
    if (x) top.lineTo(x, y); else top.moveTo(x, y);
    fill.lineTo(x, y);
  }
  fill.lineTo(width, height); fill.closePath();
  return { top, fill };
};

/** Bits of broken coral and shell, scattered over the front sand. */
const PEBBLES = ['#efe6d8', '#e8c9c2', '#d9d3e8', '#f2dcc0', '#cfc6b8', '#e7b8a8', '#c9dce0'];
const STARFISH = ['#ef4a2e', '#ff8a5c', '#ff6b8a'];

export const paintDune = (tank: Tank, sandLine: number, snow = false) => {
  const dune = wavyEdge(tank, 15, x => sandLine - 25 - Math.sin(x / 160) * 18 - Math.sin(x / 53) * 5);
  g.fillStyle = snow ? '#dbe7f3' : '#93794a'; g.fill(dune.fill);
  ink(dune.top, { color: snow ? '#ffffff' : '#b39963', width: 5, alpha: .5 }); ink(dune.top, { color: snow ? '#4b6a8f' : '#3f2e12', width: 2, alpha: .7 });
};

export const paintFrontSand = (tank: Tank, sandLine: number, snow = false) => {
  const { width, height } = tank, sand = wavyEdge(tank, 12, x => sandTop(x, sandLine));
  g.fillStyle = snow ? '#eef5fc' : '#e8cd96'; g.fill(sand.fill);
  g.save(); g.translate(0, 6); ink(sand.top, { color: snow ? '#ffffff' : '#f7e5b8', width: 6 }); g.restore();
  ink(sand.top, { color: snow ? '#5f7fa3' : '#7a5726', width: 2.4 });
  // speckles, as many as the width allows: with their own RNG, so the rest of the floor stays put as the width changes
  const random = rng(2024);
  for (let index = 0; index < width * .3; index++) {
    const radius = .8 + random() * 1.3;
    ellipse({ x: random() * width, y: sandLine + 10 + random() * (height - sandLine), radiusX: radius, radiusY: radius * .8, color: random() < .55 ? (snow ? '#c3d4e8' : '#c9a66a') : (snow ? '#ffffff' : '#fbecc8') });
  }
};

/** Where the sand is taken by something standing on it, so nothing is scattered there. */
export type Taken = (x: number) => boolean;

export const paintRipples = ({ width, height }: Tank, sandLine: number, ...rest: [random: () => number, taken?: Taken]) => {
  const [random, taken = () => false] = rest;
  g.strokeStyle = '#c29d5f'; g.lineWidth = 2; g.lineCap = 'round';
  for (let index = 0; index < 22; index++) {
    const x = random() * width, y = sandLine + 14 + random() * (height - sandLine - 18), w = 24 + random() * 40;
    if (taken(x) || taken(x + w)) continue;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 5, x + w, y); g.stroke();
  }
};

export const paintPebbles = ({ width, height }: Tank, sandLine: number, taken: Taken = () => false) => {
  const random = rng(555); // own RNG and a fixed number, so they stay put as the width changes
  for (let index = 0; index < 70; index++) {
    const x = random() * width, y = sandLine + 16 + random() * (height - sandLine - 20), radius = 2.4 + random() * 3.2;
    const color = PEBBLES[Math.floor(random() * PEBBLES.length)];
    if (taken(x)) continue;
    const pebble = new Path2D(); pebble.ellipse(x, y, radius * 1.25, radius * .85, random() - .5, 0, TAU);
    toon(pebble, { fill: color, inkColor: shade(color, -.7), width: 1.1 }, () =>
      ellipse({ x: x - radius * .35, y: y - radius * .35, radiusX: radius * .4, radiusY: radius * .22, rotation: -.4, color: shade(color, .5) }));
  }
};

const paintStarfish = ([x, y]: Point, color: string, rotation: number) => {
  const star = new Path2D();
  for (let point = 0; point < 10; point++) {
    const angle = point * TAU / 10 - Math.PI / 2 + rotation, radius = point % 2 ? 4.5 : 11;
    star.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  star.closePath();
  toon(star, { fill: color, inkColor: shade(color, -.6), width: 1.6 }, () => {
    for (let arm = 0; arm < 5; arm++) {
      const angle = arm * TAU / 5 - Math.PI / 2 + rotation;
      ellipse({ x: x + Math.cos(angle) * 5.5, y: y + Math.sin(angle) * 5.5, radiusX: 1, radiusY: 1, color: shade(color, .55) });
    }
  });
};

const paintShell = ([x, y]: Point) => {
  const shell = new Path2D(); shell.ellipse(x, y, 8, 6.5, 0, Math.PI, TAU); shell.closePath();
  toon(shell, { fill: '#f7e8d6', inkColor: '#8a5a3a', width: 1.4 }, () => {
    g.strokeStyle = '#d2a986'; g.lineWidth = 1.2;
    for (let rib = -2; rib <= 2; rib++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + rib * 3.2, y - 6); g.stroke(); }
  });
};

export const paintShellsAndStarfish = ({ width, height }: Tank, sandLine: number, ...rest: [random: () => number, taken?: Taken]) => {
  const [random, taken = () => false] = rest;
  for (let index = 0; index < 7; index++) {
    const x = random() * width, y = sandLine + 18 + random() * (height - sandLine - 26);
    if (taken(x)) continue;
    if (random() < .5) paintStarfish([x, y], STARFISH[index % 3], random() * TAU);
    else paintShell([x, y]);
  }
};
