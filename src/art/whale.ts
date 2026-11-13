import { TAU } from '../util';
import type { Bend } from './orca';
import { makeBend, paintFlukes } from './orca';

const HEAD_KNOBS = [[34, -6.3], [37, -5.6], [40, -4.7], [43, -3.6], [45.5, -2.4], [47.5, -1.2], [39, -3.4], [44, -1.6]];
const STOCK_END = -43;
const FLUKE_COLOR = '#25425a'; // the skin colour at the end of the tail stock

const paintFlipper = (g: CanvasRenderingContext2D, light: string, dark: string) => {
  const shading = g.createLinearGradient(0, -3, 0, 3);
  shading.addColorStop(0, light); shading.addColorStop(1, dark);
  g.fillStyle = shading; g.beginPath(); g.moveTo(2, -2);
  for (let knob = 1; knob <= 6; knob++) g.quadraticCurveTo(-knob * 5 + 2.5, -3.8 + knob * .45, -knob * 5, -2.2 + knob * .55);
  g.quadraticCurveTo(-33, 2, -30, 2.8);
  g.quadraticCurveTo(-15, 2.6, 2, 2); g.closePath(); g.fill();
};

// The outline as bezier curves (control, control, end): back, dorsal fin, tail stock, then belly
const OUTLINE_CURVES = [
  [47, -2.5, 38, -6.5, 24, -8.5],
  [16, -9.8, 6, -10.2, -6, -9.8],
  [-9, -10.6, -12, -12.8, -16.5, -12.2],
  [-17.5, -10.5, -18.5, -8, -20, -6.5],
  [-26, -5.6, -36, -3.2, STOCK_END, -1.6],
];
const BELLY_CURVES = [
  [-38, 2.6, -32, 4.4, -27, 5.2],
  [-14, 8.5, 2, 12, 22, 11.5],
  [38, 11, 47, 7.5, 51, 2],
];

const bendCurve = (g: CanvasRenderingContext2D, bend: Bend, curve: number[]) =>
  g.bezierCurveTo(...bend(curve[0], curve[1]), ...bend(curve[2], curve[3]), ...bend(curve[4], curve[5]));

const traceBody = (g: CanvasRenderingContext2D, bend: Bend) => {
  g.beginPath(); g.moveTo(...bend(51, 2));
  for (const curve of OUTLINE_CURVES) bendCurve(g, bend, curve);
  g.lineTo(...bend(STOCK_END, 1.6));
  for (const curve of BELLY_CURVES) bendCurve(g, bend, curve);
  g.closePath();
};

const paintHead = (g: CanvasRenderingContext2D, bend: Bend) => {
  g.save(); traceBody(g, bend); g.clip();
  g.strokeStyle = 'rgba(190,215,235,.35)'; g.lineWidth = .35;
  for (let groove = 0; groove < 6; groove++) {
    g.beginPath(); g.moveTo(47 - groove * .8, 4.5 + groove * 1.05); g.quadraticCurveTo(30, 8.5 + groove * .7, 6, 10 + groove * .3); g.stroke();
  }
  g.restore();
  g.fillStyle = '#466783';
  for (const [x, y] of HEAD_KNOBS) { g.beginPath(); g.arc(x, y, .55, 0, TAU); g.fill(); }
  g.strokeStyle = '#13263a'; g.lineWidth = .55;
  g.beginPath(); g.moveTo(50.5, 2.4); g.quadraticCurveTo(42, 3.4, 30.5, 5); g.stroke();
  g.fillStyle = '#0c1a28'; g.beginPath(); g.arc(29.5, 3, .75, 0, TAU); g.fill();
};

// Draws a humpback whale facing right in units of length/100, origin mid-body
export const paintWhale = (g: CanvasRenderingContext2D, length: number, phase: number) => {
  const beat = Math.sin(phase), angle = beat * .12, bend = makeBend(-20, 20, angle);
  g.save(); g.scale(length / 100, length / 100);
  const skin = g.createLinearGradient(0, -10, 0, 11);
  skin.addColorStop(0, '#1b3249'); skin.addColorStop(.55, '#2c4b66'); skin.addColorStop(1, '#7d9bb2');

  g.save(); g.translate(21, 8); g.rotate(-.5 - Math.sin(phase * .5 + 1) * .12); g.scale(1, -1); paintFlipper(g, '#3a5a75', '#243e57'); g.restore();

  // the flukes grow out of the end of the tail stock and pitch a little further with each beat
  g.save(); g.translate(...bend(STOCK_END, 0)); g.fillStyle = FLUKE_COLOR; paintFlukes(g, angle + beat * .22); g.restore();

  g.fillStyle = skin; traceBody(g, bend); g.fill();
  paintHead(g, bend);

  // the near flipper is very long and pale, like a real humpback's
  g.save(); g.translate(24, 8.5); g.rotate(-.38 - Math.sin(phase * .5) * .14); g.scale(1, -1); paintFlipper(g, '#a9c3d6', '#5d7d97'); g.restore();
  g.restore();
};
