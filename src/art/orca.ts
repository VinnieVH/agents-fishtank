import { TAU } from '../util';

type Bend = (x: number, y: number) => [number, number];

// One fluke lobe seen flat from above, from its root out to the swept-back tip and in to the middle notch:
// x back along the tail, z out to the side
const FLUKE: [number, number][] = [[2.5, 1.8], [-2.5, 7], [-10.5, 13.5], [-19, 16], [-17.5, 11], [-15, 4], [-14, 0]];
const FLUKE_TILT = .35; // we see the flukes a little from below, so both lobes show
const BLACK = '#111518';

// The outline as bezier curves (control, control, end), split where a straight line closes the tail stock
const BACK_CURVES = [
  [50, -4, 45, -8.5, 36, -10],
  [26, -11.8, 16, -12.4, 11, -12.2],
  [6, -13, 3, -23, -4, -33],         // leading edge up to the fin's tip
  [-5, -24, -6, -15, -13, -10.8],    // trailing edge, curving back into the back
  [-19, -8.4, -26, -5.4, -33, -3.2],
  [-36, -2.2, -38, -1.6, -40, -1.4],
];
const BELLY_CURVES = [
  [-36, 1.8, -30, 3.4, -22, 6.2],
  [-10, 10.2, 5, 11.6, 20, 11],
  [36, 10.5, 46, 7.5, 50, 1.5],
];

/** The flukes, flat and horizontal, pitched up or down as the tail beats; origin at their root. */
const paintFlukes = (g: CanvasRenderingContext2D, pitch: number) => {
  const cos = Math.cos(pitch), sin = Math.sin(pitch);
  const project = ([x, z]: [number, number]): [number, number] => [x * cos, x * sin - z * FLUKE_TILT];
  const points = [...FLUKE.map(([x, z]) => project([x, z])), ...FLUKE.slice(0, -1).reverse().map(([x, z]) => project([x, -z]))];
  g.beginPath(); g.moveTo(...points[0]);
  for (let index = 1; index < points.length; index++) {
    const [x, y] = points[index], [nextX, nextY] = points[(index + 1) % points.length];
    g.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2);
  }
  g.closePath(); g.fill();
};

/** Bends everything behind `pivot` up or down as the tail beats, more the further back, up to `angle` at `length` back. */
const makeBend = (pivot: number, length: number, angle: number): Bend => (x, y) => {
  if (x >= pivot) return [x, y];
  const bendAngle = angle * Math.min(1, (pivot - x) / length), cos = Math.cos(bendAngle), sin = Math.sin(bendAngle), dx = x - pivot;
  return [pivot + dx * cos - y * sin, dx * sin + y * cos];
};

const bendCurve = (g: CanvasRenderingContext2D, bend: Bend, curve: number[]) =>
  g.bezierCurveTo(...bend(curve[0], curve[1]), ...bend(curve[2], curve[3]), ...bend(curve[4], curve[5]));

/** The whole outline in one piece: head, back rising into the tall dorsal fin, the tail stock, belly and chin. */
const traceBody = (g: CanvasRenderingContext2D, bend: Bend) => {
  g.beginPath(); g.moveTo(...bend(50, 1.5));
  for (const curve of BACK_CURVES) bendCurve(g, bend, curve);
  g.lineTo(...bend(-40, 1.4));
  for (const curve of BELLY_CURVES) bendCurve(g, bend, curve);
  g.closePath();
};

/** A big rounded paddle of a pectoral fin, pointing back from its root. */
const paintPaddle = (g: CanvasRenderingContext2D, color: string) => {
  g.fillStyle = color; g.beginPath(); g.moveTo(3, -1.8);
  g.bezierCurveTo(-4, -2.5, -12, -1, -13, 2.5);
  g.bezierCurveTo(-13.5, 5.5, -8, 5, 3, 1.8);
  g.quadraticCurveTo(5.5, 0, 3, -1.8); // a rounded root, so no straight edge shows where it meets the body
  g.fill();
};

/** The white chin, belly and the flank patch sweeping up behind, the eye patch and the grey saddle. */
const paintMarkings = (g: CanvasRenderingContext2D, bend: Bend) => {
  g.save(); traceBody(g, bend); g.clip();
  g.fillStyle = '#eef2f4';
  g.beginPath(); g.moveTo(51, 2.2);
  g.bezierCurveTo(44, 4.2, 36, 4.6, 28, 5.6);
  g.bezierCurveTo(18, 7.2, 8, 7.6, 0, 7);
  g.bezierCurveTo(-8, 6.4, -12, 1, -17, -2.5);
  g.quadraticCurveTo(-21, -4, -21, 0);
  g.quadraticCurveTo(-20, 4, -12, 9);
  g.lineTo(-12, 16); g.lineTo(52, 16); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(26, -5, 6.2, 2.3, -.12, 0, TAU); g.fill();
  g.fillStyle = 'rgba(150,160,168,.75)';
  g.beginPath(); g.ellipse(-15, -9.5, 8, 3, .25, 0, TAU); g.fill();
  g.restore();
};

// Draws an orca facing right in units of length/100, origin mid-body
export const paintOrca = (g: CanvasRenderingContext2D, length: number, phase: number) => {
  const beat = Math.sin(phase), angle = beat * .16, bend = makeBend(-24, 16, angle);
  g.save(); g.scale(length / 100, length / 100);

  g.save(); g.translate(22, 7); g.rotate(.45 + Math.sin(phase * .5 + 1) * .08); paintPaddle(g, '#0b0e10'); g.restore();

  // the flukes grow out of the end of the tail stock and pitch a little further with each beat
  g.save(); g.translate(...bend(-40, 0));
  g.fillStyle = BLACK; paintFlukes(g, angle + beat * .22);
  g.restore();

  g.fillStyle = BLACK; traceBody(g, bend); g.fill();
  paintMarkings(g, bend);

  // the mouth runs along the edge of the white jaw, the eye sits just in front of its patch
  g.strokeStyle = '#05070a'; g.lineWidth = .55; g.lineCap = 'round';
  g.beginPath(); g.moveTo(50.2, 2.4); g.quadraticCurveTo(44, 3.6, 37, 4.2); g.stroke();
  g.fillStyle = '#000'; g.beginPath(); g.arc(32.5, -2, .7, 0, TAU); g.fill();

  // the near fin's root sits in the black above the white belly
  g.save(); g.translate(25, 4.6); g.rotate(.35 + Math.sin(phase * .5) * .08); paintPaddle(g, BLACK); g.restore();
  g.restore();
};
