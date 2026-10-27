import { TAU } from '../util';

function sharkBody(g: CanvasRenderingContext2D) {
  g.beginPath(); g.moveTo(50, 1.5);
  g.bezierCurveTo(48, -3.5, 40, -7.8, 26, -9.6);
  g.bezierCurveTo(10, -11.2, -10, -8.6, -28, -2.6);
  g.lineTo(-28, 2.6);
  g.bezierCurveTo(-10, 7, 10, 9.6, 26, 8.2);
  g.bezierCurveTo(40, 6.8, 47, 5, 50, 1.5);
  g.closePath();
}

function pectoral(g: CanvasRenderingContext2D, light: string, dark: string) {
  const fg = g.createLinearGradient(0, 0, -8, 14);
  fg.addColorStop(0, light); fg.addColorStop(1, dark);
  g.fillStyle = fg; g.beginPath(); g.moveTo(2, -1.5);
  g.quadraticCurveTo(-6, 4, -16, 13.5);
  g.quadraticCurveTo(-8, 7.5, -7, 1.5);
  g.closePath(); g.fill();
}

const fin = (g: CanvasRenderingContext2D, pts: number[]) => {
  g.beginPath(); g.moveTo(pts[0], pts[1]);
  g.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
  g.quadraticCurveTo(pts[6], pts[7], pts[8], pts[9]);
  g.closePath(); g.fill();
};

// Draws a great white facing right in units of L/100, origin mid-body
export function paintShark(g: CanvasRenderingContext2D, L: number, ph: number) {
  const beat = Math.sin(ph);
  g.save(); g.scale(L / 100, L / 100);
  const top = '#34434f', skin = g.createLinearGradient(0, -11, 0, 4);
  skin.addColorStop(0, '#2f3d49'); skin.addColorStop(1, '#6f8392');

  // far-side pectoral fin
  g.save(); g.translate(17, 5.5); g.rotate(-.15 + Math.sin(ph * .3) * .05); pectoral(g, '#3c4c58', '#2a3742'); g.restore();

  // crescent tail: the tail sweeps sideways, so from the side it narrows as it turns toward or away from us
  g.save(); g.translate(-27, 0); g.rotate(beat * .06);
  g.scale(.55 + .45 * Math.abs(Math.cos(ph)), 1);
  g.fillStyle = top;
  g.beginPath(); g.moveTo(2, -2.8);
  g.quadraticCurveTo(-8, -8, -22, -18.5);
  g.quadraticCurveTo(-15, -8, -14, 0);
  g.quadraticCurveTo(-13, 6, -17.5, 13);
  g.quadraticCurveTo(-8, 6.5, 2, 2.8);
  g.closePath(); g.fill();
  g.restore();

  // fins on the body outline: first dorsal, second dorsal, anal, pelvic
  g.fillStyle = top;
  fin(g, [9, -10.2, 2, -18, -5.5, -23.5, -4, -15, -8.5, -9.3]);
  fin(g, [-21, -4.6, -23, -6.6, -25.5, -7.8, -24.8, -5.5, -25.5, -3.6]);
  fin(g, [-19, 4.4, -22, 6.4, -25, 7.6, -24.2, 5.2, -25, 3.4]);
  fin(g, [-4, 8.4, -8, 10.8, -12.5, 12.2, -11, 9.6, -12, 7.6]);

  // body with sharp countershading: dark back, white belly
  g.fillStyle = skin; sharkBody(g); g.fill();
  g.save(); sharkBody(g); g.clip();
  g.fillStyle = '#e4edf2'; g.beginPath(); g.moveTo(50, 2.2);
  const edge = [[44, 3.4], [38, 3.2], [33, 4.6], [27, 3.6], [21, 5.2], [14, 4], [7, 5.4], [0, 4.2], [-8, 4.8], [-16, 3.2], [-24, 2.6], [-30, 1.4]];
  for (const [x, y] of edge) g.lineTo(x, y);
  g.lineTo(-30, 14); g.lineTo(52, 14); g.closePath(); g.fill();
  g.restore();

  // gill slits, mouth with a hint of teeth, eye
  g.strokeStyle = 'rgba(20,30,38,.75)'; g.lineWidth = .45; g.lineCap = 'round';
  for (let k = 0; k < 5; k++) { const x = 30 - k * 2; g.beginPath(); g.moveTo(x + .6, -3.6 + k * .15); g.quadraticCurveTo(x - .7, 0, x + .2, 3.8); g.stroke(); }
  g.strokeStyle = '#1b252d'; g.lineWidth = .6;
  g.beginPath(); g.moveTo(46.5, 4.2); g.quadraticCurveTo(41, 6.2, 35, 5.4); g.stroke();
  g.fillStyle = '#f4f7f8';
  for (let k = 0; k < 5; k++) { const x = 44 - k * 1.8, y = 5 + k * .2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - .5, y - .9); g.lineTo(x - 1, y); g.fill(); }
  g.fillStyle = '#05090c'; g.beginPath(); g.arc(39, -2.2, .95, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(39.3, -2.5, .3, 0, TAU); g.fill();

  // near-side pectoral fin (long and swept back)
  g.save(); g.translate(21, 5); g.rotate(Math.sin(ph * .3 + 1) * .06); pectoral(g, '#5b6f7e', '#2f3d49'); g.restore();
  g.restore();
}
