import { TAU } from '../util';

function flipper(g: CanvasRenderingContext2D, light: string, dark: string) {
  const fg = g.createLinearGradient(0, -3, 0, 3);
  fg.addColorStop(0, light); fg.addColorStop(1, dark);
  g.fillStyle = fg; g.beginPath(); g.moveTo(2, -2);
  for (let i = 1; i <= 6; i++) g.quadraticCurveTo(-i * 5 + 2.5, -3.8 + i * .45, -i * 5, -2.2 + i * .55); // knobbly leading edge
  g.quadraticCurveTo(-33, 2, -30, 2.8);
  g.quadraticCurveTo(-15, 2.6, 2, 2); g.closePath(); g.fill();
}
function whaleBody(g: CanvasRenderingContext2D) {
  g.beginPath(); g.moveTo(51, 2);
  g.bezierCurveTo(47, -2.5, 38, -6.5, 24, -8.5);
  g.bezierCurveTo(8, -10.5, -10, -9.5, -20, -6.5);
  g.lineTo(-27, -5.2); g.lineTo(-27, 5.2);
  g.bezierCurveTo(-14, 8.5, 2, 12, 22, 11.5);
  g.bezierCurveTo(38, 11, 47, 7.5, 51, 2);
  g.closePath();
}
// Draws the whale facing right in units of L/100, origin mid-body
export function paintWhale(g: CanvasRenderingContext2D, L: number, ph: number) {
  const beat = Math.sin(ph);
  g.save(); g.scale(L / 100, L / 100);
  const skin = g.createLinearGradient(0, -10, 0, 11);
  skin.addColorStop(0, '#1b3249'); skin.addColorStop(.55, '#2c4b66'); skin.addColorStop(1, '#7d9bb2');

  // far-side flipper
  g.save(); g.translate(21, 8); g.rotate(-.5 - Math.sin(ph * .5 + 1) * .12); g.scale(1, -1); flipper(g, '#3a5a75', '#243e57'); g.restore();

  // tail stock + fluke, bending up and down
  g.save(); g.translate(-26, 0); g.rotate(beat * .12);
  g.fillStyle = skin;
  g.beginPath(); g.moveTo(3, -6); g.quadraticCurveTo(-8, -3.8, -18, -1.6); g.lineTo(-18, 1.6); g.quadraticCurveTo(-8, 3.8, 3, 6); g.closePath(); g.fill();
  g.translate(-17, 0); g.rotate(beat * .28);
  const th = .5 + 2.2 * Math.abs(Math.cos(ph)); // fluke foreshortening as it sweeps
  g.fillStyle = '#1b3249';
  g.beginPath(); g.moveTo(1, 0);
  g.quadraticCurveTo(-6, -th - .8, -17, -th * 1.2 - .6);
  g.quadraticCurveTo(-14, -th * .5, -15.5, 0);
  g.quadraticCurveTo(-14, th * .5, -17, th * 1.2 + .6);
  g.quadraticCurveTo(-6, th + .8, 1, 0); g.fill();
  g.restore();

  // body, small dorsal fin on its hump
  g.fillStyle = skin; whaleBody(g); g.fill();
  g.fillStyle = '#1b3249';
  g.beginPath(); g.moveTo(-8, -9.4); g.quadraticCurveTo(-13, -12.8, -16.5, -12); g.lineTo(-18, -8); g.closePath(); g.fill();

  // throat grooves, knobbly head, mouth, eye
  g.save(); whaleBody(g); g.clip();
  g.strokeStyle = 'rgba(190,215,235,.35)'; g.lineWidth = .35;
  for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(47 - k * .8, 4.5 + k * 1.05); g.quadraticCurveTo(30, 8.5 + k * .7, 6, 10 + k * .3); g.stroke(); }
  g.restore();
  g.fillStyle = '#466783';
  for (const [x, y] of [[34, -6.3], [37, -5.6], [40, -4.7], [43, -3.6], [45.5, -2.4], [47.5, -1.2], [39, -3.4], [44, -1.6]]) { g.beginPath(); g.arc(x, y, .55, 0, TAU); g.fill(); }
  g.strokeStyle = '#13263a'; g.lineWidth = .55;
  g.beginPath(); g.moveTo(50.5, 2.4); g.quadraticCurveTo(42, 3.4, 30.5, 5); g.stroke();
  g.fillStyle = '#0c1a28'; g.beginPath(); g.arc(29.5, 3, .75, 0, TAU); g.fill();

  // near-side flipper (very long, pale like a real humpback's)
  g.save(); g.translate(24, 8.5); g.rotate(-.38 - Math.sin(ph * .5) * .14); g.scale(1, -1); flipper(g, '#a9c3d6', '#5d7d97'); g.restore();
  g.restore();
}
