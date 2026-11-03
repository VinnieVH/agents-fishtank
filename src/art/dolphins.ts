import { TAU } from '../util';

// The pod, in units of length/100: where each dolphin swims, its size and its place in the rise and fall
const POD: [x: number, y: number, size: number, offset: number][] = [
  [28, -6, .3, 0], [6, 8, .32, 1.9], [-14, -10, .28, 3.7], [-30, 6, .3, 5.1], [10, -16, .26, .9],
];
const POD_FAR_TO_NEAR = [...POD].sort((first, second) => first[2] - second[2]); // smaller, further ones first

// One fluke lobe seen flat from above, from its root out to the swept-back tip and in to the middle notch:
// x back along the tail, z out to the side
const FLUKE: [number, number][] = [[2.5, 1.6], [-2.5, 6], [-9.5, 12], [-16.5, 14.5], [-15, 9.5], [-13, 3.5], [-12.5, 0]];
const FLUKE_TILT = .35; // we see the flukes a little from below, so both lobes show
const BACK = '#5a7b96', SIDE = '#7896ad', BELLY = '#dbe6ee';

// The outline as bezier curves (control, control, end), split where a straight line closes the tail stock
const BACK_CURVES = [
  [43.5, -4.5, 38, -13.5, 24, -15],  // the round melon, bulging out over the short beak
  [21, -15.2, 19.5, -15, 18, -14.8],
  [12, -15.2, 8, -15.4, 5, -15.2],
  [2, -18, -2, -25, -12, -27],       // leading edge up to the fin's tip
  [-9, -22, -9, -16, -14, -13],      // trailing edge, curving back into the back
  [-22, -10, -30, -6, -36, -3],
  [-38, -2.2, -40, -1.6, -42, -1.3],
];
const BELLY_CURVES = [
  [-36, 2.8, -28, 7, -18, 11],
  [-6, 15.5, 12, 16, 26, 12],
  [34, 9.5, 40, 7.4, 44.5, 6.2],
];

type Bend = (x: number, y: number) => [number, number];

/** Bends everything behind `pivot` up or down as the tail beats, more the further back, up to `angle` at `length` back. */
const makeBend = (pivot: number, length: number, angle: number): Bend => (x, y) => {
  if (x >= pivot) return [x, y];
  const bendAngle = angle * Math.min(1, (pivot - x) / length), cos = Math.cos(bendAngle), sin = Math.sin(bendAngle), dx = x - pivot;
  return [pivot + dx * cos - y * sin, dx * sin + y * cos];
};

const bendCurve = (g: CanvasRenderingContext2D, bend: Bend, curve: number[]) =>
  g.bezierCurveTo(...bend(curve[0], curve[1]), ...bend(curve[2], curve[3]), ...bend(curve[4], curve[5]));

/** The whole outline in one piece: short beak, round melon, back rising into the curved fin, tail stock and belly. */
const traceBody = (g: CanvasRenderingContext2D, bend: Bend) => {
  g.beginPath(); g.moveTo(...bend(49, 3.8));
  g.quadraticCurveTo(...bend(45.5, 2.4), ...bend(42, 1.4));
  for (const curve of BACK_CURVES) bendCurve(g, bend, curve);
  g.lineTo(...bend(-42, 1.3));
  for (const curve of BELLY_CURVES) bendCurve(g, bend, curve);
  g.quadraticCurveTo(...bend(48.5, 5.4), ...bend(49, 3.8));
  g.closePath();
};

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

/** A swept-back flipper, its rounded root tucked into the body. */
const paintFlipper = (g: CanvasRenderingContext2D, color: string) => {
  g.fillStyle = color; g.beginPath(); g.moveTo(3, -2.6);
  g.bezierCurveTo(-3, -1.4, -8, 3, -10.5, 7.5);
  g.bezierCurveTo(-6, 8, -1, 5.5, 4, 2.4);
  g.quadraticCurveTo(6, 0, 3, -2.6);
  g.fill();
};

/** Blue-grey body, darker along the back, with the pale belly running from the chin to the tail. */
const paintBody = (g: CanvasRenderingContext2D, bend: Bend) => {
  const skin = g.createLinearGradient(0, -15, 0, 8);
  skin.addColorStop(0, BACK); skin.addColorStop(1, SIDE);
  g.fillStyle = skin; traceBody(g, bend); g.fill();
  g.save(); traceBody(g, bend); g.clip();
  g.fillStyle = BELLY;
  g.beginPath(); g.moveTo(52, 4.2);
  g.bezierCurveTo(44, 4.4, 36, 4.2, 30, 5.2);
  g.bezierCurveTo(20, 7.2, 6, 9.6, -8, 10);
  g.bezierCurveTo(-18, 10, ...bend(-26, 6), ...bend(-34, 3));
  g.lineTo(...bend(-34, 24)); g.lineTo(52, 24); g.closePath(); g.fill();
  g.restore();
};

/** A gentle smile turning up at the corner, and a bright eye. */
const paintFace = (g: CanvasRenderingContext2D) => {
  g.strokeStyle = '#34495b'; g.lineWidth = .7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(48.6, 4.2); g.quadraticCurveTo(40, 5.4, 33.5, 4.2); g.quadraticCurveTo(32, 3.8, 31.6, 2.8); g.stroke();
  g.fillStyle = '#14202b'; g.beginPath(); g.arc(30, -3, 1.5, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(30.5, -3.5, .5, 0, TAU); g.fill();
};

/** One bottlenose dolphin facing right, about 100 units long, origin mid-body. */
const paintDolphin = (g: CanvasRenderingContext2D, phase: number) => {
  const beat = Math.sin(phase), angle = beat * .18, bend = makeBend(-24, 18, angle);

  g.save(); g.translate(18, 6.5); g.rotate(-.15 + Math.sin(phase * .5 + 1) * .1); g.scale(.8, .8); paintFlipper(g, '#4b6982'); g.restore();

  // the flukes grow out of the end of the tail stock and pitch a little further with each beat
  g.save(); g.translate(...bend(-42, 0));
  g.fillStyle = '#6a89a1'; paintFlukes(g, angle + beat * .24);
  g.restore();

  paintBody(g, bend);
  paintFace(g);

  g.save(); g.translate(21, 8); g.rotate(Math.sin(phase * .5) * .1); paintFlipper(g, '#56768f'); g.restore();
};

// Draws a pod of dolphins heading right, each rising and dipping on its own, in units of length/100, origin mid-pod
export const paintDolphins = (g: CanvasRenderingContext2D, length: number, phase: number) => {
  g.save(); g.scale(length / 100, length / 100);
  for (const [x, y, size, offset] of POD_FAR_TO_NEAR) {
    const swimPhase = phase * .22 + offset;
    g.save(); g.translate(x, y + Math.sin(swimPhase) * 5); g.rotate(Math.cos(swimPhase) * .22); g.scale(size, size);
    paintDolphin(g, phase + offset * 2);
    g.restore();
  }
  g.restore();
};
