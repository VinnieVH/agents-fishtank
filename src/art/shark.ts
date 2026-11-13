import { TAU } from '../util';
import type { Bend } from './orca';

const BACK = '#34434f';
const TAIL_PIVOT = -26;

// The tail sweeps sideways, so from the side it shortens as it turns toward or away from us
const makeSweep = (phase: number): Bend => {
  const squash = 1 + .08 * Math.cos(phase * 1.2);
  return (x, y) => [x < TAIL_PIVOT ? TAIL_PIVOT + (x - TAIL_PIVOT) * squash : x, y];
};
const BELLY_EDGE = [[44, 3.4], [38, 3.2], [33, 4.6], [27, 3.6], [21, 5.2], [14, 4], [7, 5.4], [0, 4.2], [-8, 4.8], [-16, 3.2], [-24, 2.6], [-27, 2.4]];

// The outline as bezier curves (control, control, end): back, dorsal fin, tail stock, crescent tail, then belly
const OUTLINE_CURVES = [
  [48, -3.5, 40, -7.8, 26, -9.6],
  [18, -10.6, 12, -10.4, 9, -10.2],
  [4, -15, 0, -20, -5.5, -23.5],
  [-5, -16, -6, -11, -9, -9.4],
  [-14, -8.6, -22, -5.2, -28, -3],
  [-33, -4, -38, -10, -47, -19],
  [-43, -10, -41, -4, -41, 0],
  [-41, 4, -42, 8, -45, 12.5],
  [-38, 8, -33, 4, -28, 2.6],
  [-10, 7, 10, 9.6, 26, 8.2],
  [40, 6.8, 47, 5, 50, 1.5],
];

const traceBody = (g: CanvasRenderingContext2D, bend: Bend) => {
  g.beginPath(); g.moveTo(...bend(50, 1.5));
  for (const curve of OUTLINE_CURVES) {
    g.bezierCurveTo(...bend(curve[0], curve[1]), ...bend(curve[2], curve[3]), ...bend(curve[4], curve[5]));
  }
  g.closePath();
};

const paintPectoral = (g: CanvasRenderingContext2D, light: string, dark: string) => {
  const shading = g.createLinearGradient(0, 0, -8, 14);
  shading.addColorStop(0, light); shading.addColorStop(1, dark);
  g.fillStyle = shading; g.beginPath(); g.moveTo(2, -1.5);
  g.quadraticCurveTo(-6, 4, -16, 13.5);
  g.quadraticCurveTo(-8, 7.5, -7, 1.5);
  g.closePath(); g.fill();
};

const paintFin = (g: CanvasRenderingContext2D, points: number[]) => {
  g.beginPath(); g.moveTo(points[0], points[1]);
  g.quadraticCurveTo(points[2], points[3], points[4], points[5]);
  g.quadraticCurveTo(points[6], points[7], points[8], points[9]);
  g.closePath(); g.fill();
};

const paintBodyFins = (g: CanvasRenderingContext2D) => {
  g.fillStyle = BACK;
  paintFin(g, [-21, -4.6, -23, -6.6, -25.5, -7.8, -24.8, -5.5, -25.5, -3.6]);
  paintFin(g, [-19, 4.4, -22, 6.4, -25, 7.6, -24.2, 5.2, -25, 3.4]);
  paintFin(g, [-4, 8.4, -8, 10.8, -12.5, 12.2, -11, 9.6, -12, 7.6]);
};

const paintCountershadedBody = (g: CanvasRenderingContext2D, bend: Bend) => {
  const skin = g.createLinearGradient(0, -11, 0, 4);
  skin.addColorStop(0, '#2f3d49'); skin.addColorStop(1, '#6f8392');
  g.fillStyle = skin; traceBody(g, bend); g.fill();
  g.save(); traceBody(g, bend); g.clip();
  g.fillStyle = '#e4edf2'; g.beginPath(); g.moveTo(...bend(50, 2.2));
  for (const [x, y] of BELLY_EDGE) g.lineTo(...bend(x, y));
  g.lineTo(...bend(-27, 14)); g.lineTo(52, 14); g.closePath(); g.fill();
  const tailShade = g.createLinearGradient(-24, 0, -33, 0);
  tailShade.addColorStop(0, 'rgba(52,67,79,0)'); tailShade.addColorStop(1, BACK);
  g.fillStyle = tailShade; g.fillRect(-50, -25, 26, 40);
  g.restore();
};

const paintFace = (g: CanvasRenderingContext2D) => {
  g.strokeStyle = 'rgba(20,30,38,.75)'; g.lineWidth = .45; g.lineCap = 'round';
  for (let slit = 0; slit < 5; slit++) {
    const x = 30 - slit * 2;
    g.beginPath(); g.moveTo(x + .6, -3.6 + slit * .15); g.quadraticCurveTo(x - .7, 0, x + .2, 3.8); g.stroke();
  }
  g.strokeStyle = '#1b252d'; g.lineWidth = .6;
  g.beginPath(); g.moveTo(46.5, 4.2); g.quadraticCurveTo(41, 6.2, 35, 5.4); g.stroke();
  g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(27,37,45,.6)'; g.lineWidth = .2;
  for (let tooth = 0; tooth < 6; tooth++) {
    const along = .08 + tooth * .16, rest = 1 - along;
    const x = rest * rest * 46.5 + 2 * rest * along * 41 + along * along * 35;
    const y = rest * rest * 4.2 + 2 * rest * along * 6.2 + along * along * 5.4;
    g.beginPath(); g.moveTo(x + .5, y - .1); g.lineTo(x, y + 1.3); g.lineTo(x - .5, y - .1); g.fill(); g.stroke();
  }
  g.fillStyle = '#05090c'; g.beginPath(); g.arc(39, -2.2, .95, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(39.3, -2.5, .3, 0, TAU); g.fill();
};

// Draws a great white facing right in units of length/100, origin mid-body
export const paintShark = (g: CanvasRenderingContext2D, length: number, phase: number) => {
  g.save(); g.scale(length / 100, length / 100);
  const bend = makeSweep(phase);
  g.save(); g.translate(17, 5.5); g.rotate(-.15 + Math.sin(phase * .3) * .05); paintPectoral(g, '#3c4c58', '#2a3742'); g.restore();
  paintBodyFins(g);
  paintCountershadedBody(g, bend);
  paintFace(g);
  g.save(); g.translate(21, 5); g.rotate(Math.sin(phase * .3 + 1) * .06); paintPectoral(g, '#5b6f7e', '#2f3d49'); g.restore();
  g.restore();
};
