import { TAU } from '../util';

// The pod, in units of L/100: where each dolphin swims, its size and its place in the rise and fall
const POD: [x: number, y: number, size: number, off: number][] = [
  [28, -6, .3, 0], [6, 8, .32, 1.9], [-14, -10, .28, 3.7], [-30, 6, .3, 5.1], [10, -16, .26, .9],
];

// One fluke lobe seen flat from above, from its root out to the swept-back tip and in to the middle notch:
// x back along the tail, z out to the side
const FLUKE: [number, number][] = [[2.5, 1.6], [-2.5, 6], [-9.5, 12], [-16.5, 14.5], [-15, 9.5], [-13, 3.5], [-12.5, 0]];
const FLUKE_TILT = .35; // we see the flukes a little from below, so both lobes show
const BACK = '#5a7b96', SIDE = '#7896ad', BELLY = '#dbe6ee';

type Bend = (x: number, y: number) => [number, number];

/** Bends everything behind `pivot` up or down as the tail beats, more the further back, up to `angle` at `len` back. */
function bender(pivot: number, len: number, angle: number): Bend {
  return (x, y) => {
    if (x >= pivot) return [x, y];
    const a = angle * Math.min(1, (pivot - x) / len), c = Math.cos(a), s = Math.sin(a), dx = x - pivot;
    return [pivot + dx * c - y * s, dx * s + y * c];
  };
}

/** The whole outline in one piece: short beak, round melon, back rising into the curved fin, tail stock and belly. */
function dolphinBody(g: CanvasRenderingContext2D, T: Bend) {
  const c = (a: number, b: number, d: number, e: number, x: number, y: number) => g.bezierCurveTo(...T(a, b), ...T(d, e), ...T(x, y));
  g.beginPath(); g.moveTo(...T(49, 3.8));
  g.quadraticCurveTo(...T(45.5, 2.4), ...T(42, 1.4));
  c(43.5, -4.5, 38, -13.5, 24, -15);   // the round melon, bulging out over the short beak
  c(21, -15.2, 19.5, -15, 18, -14.8);
  c(12, -15.2, 8, -15.4, 5, -15.2);
  c(2, -18, -2, -25, -12, -27);       // leading edge up to the fin's tip
  c(-9, -22, -9, -16, -14, -13);      // trailing edge, curving back into the back
  c(-22, -10, -30, -6, -36, -3);
  c(-38, -2.2, -40, -1.6, -42, -1.3);
  g.lineTo(...T(-42, 1.3));
  c(-36, 2.8, -28, 7, -18, 11);
  c(-6, 15.5, 12, 16, 26, 12);
  c(34, 9.5, 40, 7.4, 44.5, 6.2);
  g.quadraticCurveTo(...T(48.5, 5.4), ...T(49, 3.8));
  g.closePath();
}

/** The flukes, flat and horizontal, pitched up or down by `a` as the tail beats; origin at their root. */
function flukes(g: CanvasRenderingContext2D, a: number) {
  const c = Math.cos(a), s = Math.sin(a);
  const at = ([x, z]: [number, number]): [number, number] => [x * c, x * s - z * FLUKE_TILT];
  const pts = [...FLUKE.map(([x, z]) => at([x, z])), ...FLUKE.slice(0, -1).reverse().map(([x, z]) => at([x, -z]))];
  g.beginPath(); g.moveTo(...pts[0]);
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[(i + 1) % pts.length];
    g.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  g.closePath(); g.fill();
}

/** A swept-back flipper, its rounded root tucked into the body. */
function flipper(g: CanvasRenderingContext2D, color: string) {
  g.fillStyle = color; g.beginPath(); g.moveTo(3, -2.6);
  g.bezierCurveTo(-3, -1.4, -8, 3, -10.5, 7.5);
  g.bezierCurveTo(-6, 8, -1, 5.5, 4, 2.4);
  g.quadraticCurveTo(6, 0, 3, -2.6);
  g.fill();
}

/** One bottlenose dolphin facing right, about 100 units long, origin mid-body. */
function dolphin(g: CanvasRenderingContext2D, ph: number) {
  const beat = Math.sin(ph), angle = beat * .18, T = bender(-24, 18, angle);

  g.save(); g.translate(18, 6.5); g.rotate(-.15 + Math.sin(ph * .5 + 1) * .1); g.scale(.8, .8); flipper(g, '#4b6982'); g.restore();

  // flukes, growing out of the end of the tail stock and pitching a little further with each beat
  g.save(); g.translate(...T(-42, 0));
  g.fillStyle = '#6a89a1'; flukes(g, angle + beat * .24);
  g.restore();

  // blue-grey body, darker along the back, with the pale belly running from the chin to the tail
  const skin = g.createLinearGradient(0, -15, 0, 8);
  skin.addColorStop(0, BACK); skin.addColorStop(1, SIDE);
  g.fillStyle = skin; dolphinBody(g, T); g.fill();
  g.save(); dolphinBody(g, T); g.clip();
  g.fillStyle = BELLY;
  g.beginPath(); g.moveTo(52, 4.2);
  g.bezierCurveTo(44, 4.4, 36, 4.2, 30, 5.2);
  g.bezierCurveTo(20, 7.2, 6, 9.6, -8, 10);
  g.bezierCurveTo(-18, 10, ...T(-26, 6), ...T(-34, 3));
  g.lineTo(...T(-34, 24)); g.lineTo(52, 24); g.closePath(); g.fill();
  g.restore();

  // a gentle smile turning up at the corner, and a bright eye
  g.strokeStyle = '#34495b'; g.lineWidth = .7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(48.6, 4.2); g.quadraticCurveTo(40, 5.4, 33.5, 4.2); g.quadraticCurveTo(32, 3.8, 31.6, 2.8); g.stroke();
  g.fillStyle = '#14202b'; g.beginPath(); g.arc(30, -3, 1.5, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(30.5, -3.5, .5, 0, TAU); g.fill();

  g.save(); g.translate(21, 8); g.rotate(Math.sin(ph * .5) * .1); flipper(g, '#56768f'); g.restore();
}

// Draws a pod of dolphins heading right, each rising and dipping on its own, in units of L/100, origin mid-pod
export function paintDolphins(g: CanvasRenderingContext2D, L: number, ph: number) {
  g.save(); g.scale(L / 100, L / 100);
  for (const [x, y, size, off] of [...POD].sort((a, b) => a[2] - b[2])) { // smaller, further ones first
    const p = ph * .22 + off;
    g.save(); g.translate(x, y + Math.sin(p) * 5); g.rotate(Math.cos(p) * .22); g.scale(size, size);
    dolphin(g, ph + off * 2);
    g.restore();
  }
  g.restore();
}
