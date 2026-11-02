import { TAU } from '../util';

const SPOTS: [number, number, number][] = [[8, -6, 1.6], [15, 3, 2], [22, -4, 1.4], [29, 2, 1.7], [36, -2, 1.2], [12, -1, 1.1], [26, -7, 1]];

function mantle(g: CanvasRenderingContext2D) {
  g.beginPath(); g.moveTo(-2, -8.5);
  g.bezierCurveTo(10, -12.5, 30, -10, 47, -1);
  g.bezierCurveTo(48, 0, 48, .6, 47, 1.2);
  g.bezierCurveTo(30, 10.5, 10, 12.5, -2, 8.5);
  g.closePath();
}

/** Points along one arm from its root, fanning out to `endY` and writhing more towards the tip. */
function arm(k: number, ph: number, y0: number, endY: number, len: number, wave: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let s = 0; s <= 16; s++) {
    const d = s / 16;
    pts.push([-10 - d * len, y0 + (endY - y0) * d ** 1.3 + Math.sin(ph * .9 - d * 4.5 + k * 1.7) * wave * d]);
  }
  return pts;
}

/** Strokes the arm thick at the root and thin at the tip. */
function taper(g: CanvasRenderingContext2D, pts: [number, number][], root: number) {
  for (let i = 1; i < pts.length; i++) {
    g.lineWidth = root * (1 - i / pts.length) + .35;
    g.beginPath(); g.moveTo(...pts[i - 1]); g.lineTo(...pts[i]); g.stroke();
  }
}

const ARMS = Array.from({ length: 8 }, (_, k) => ({ y0: -5 + k * 10 / 7, endY: (k - 3.5) * 6.2, len: 40 + (k * 13 % 5) * 3 }));
const CLUBS = [{ y0: -2, endY: -27, len: 78 }, { y0: 2, endY: 21, len: 74 }];

// Draws the kraken, a giant squid heading right mantle first with its arms trailing, in units of L/100, origin at its head
export function paintKraken(g: CanvasRenderingContext2D, L: number, ph: number) {
  g.save(); g.scale(L / 100, L / 100);
  g.lineCap = 'round';

  // the two long hunting tentacles, each ending in a club of suckers
  g.strokeStyle = '#5a1522';
  CLUBS.forEach((c, k) => {
    const pts = arm(k + 8, ph * .8, c.y0, c.endY, c.len, 8);
    taper(g, pts, 1.6);
    const [x, y] = pts[pts.length - 1], [px, py] = pts[pts.length - 3];
    g.save(); g.translate(x, y); g.rotate(Math.atan2(y - py, x - px));
    g.fillStyle = '#6e1b29'; g.beginPath(); g.ellipse(-1.5, 0, 4.5, 1.9, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(240,200,190,.55)';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-4 + i * 1.9, .7, .45, 0, TAU); g.fill(); }
    g.restore();
  });

  // eight arms, the far ones darker, with a row of suckers on the near ones
  ARMS.forEach((a, k) => {
    const pts = arm(k, ph, a.y0, a.endY, a.len, 5);
    g.strokeStyle = k % 2 ? '#561522' : '#74202e';
    taper(g, pts, 3.6);
    if (k % 2) return;
    g.fillStyle = 'rgba(240,200,190,.5)';
    for (let i = 2; i < pts.length - 2; i += 2) { g.beginPath(); g.arc(pts[i][0], pts[i][1] + 1.2 * (1 - i / pts.length), .55 * (1 - i / pts.length) + .2, 0, TAU); g.fill(); }
  });

  // fins at the mantle's tip, then the mantle itself, dark on top and mottled
  g.fillStyle = '#5c1421';
  g.beginPath(); g.moveTo(30, -6); g.quadraticCurveTo(40, -17, 51, -2.5); g.lineTo(51, 2.5); g.quadraticCurveTo(40, 17, 30, 6); g.closePath(); g.fill();
  const skin = g.createLinearGradient(0, -12, 0, 12);
  skin.addColorStop(0, '#4a0f1c'); skin.addColorStop(.6, '#7a2230'); skin.addColorStop(1, '#94394a');
  g.fillStyle = skin; mantle(g); g.fill();
  g.save(); mantle(g); g.clip();
  g.fillStyle = 'rgba(170,70,80,.45)';
  for (const [x, y, r] of SPOTS) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  g.restore();

  // head, with the huge eye
  g.fillStyle = skin; g.beginPath(); g.ellipse(-6, 0, 8, 7.8, 0, 0, TAU); g.fill();
  const iris = g.createRadialGradient(-5, -1.5, .3, -5, -1.5, 3.4);
  iris.addColorStop(0, '#fff2a8'); iris.addColorStop(.6, '#e0a62a'); iris.addColorStop(1, '#7a4a10');
  g.fillStyle = iris; g.beginPath(); g.arc(-5, -1.5, 3.4, 0, TAU); g.fill();
  g.fillStyle = '#0a0406'; g.beginPath(); g.ellipse(-5, -1.5, 1.9, .8, 0, 0, TAU); g.fill();
  g.strokeStyle = '#3a0a14'; g.lineWidth = .7; g.beginPath(); g.arc(-5, -1.5, 3.6, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  g.restore();
}

// At night its eye burns, and a few lights flicker down the arms
export function paintKrakenGlow(g: CanvasRenderingContext2D, L: number, ph: number) {
  g.save(); g.scale(L / 100, L / 100);
  const eye = g.createRadialGradient(-5, -1.5, 0, -5, -1.5, 8);
  eye.addColorStop(0, '#ffe066'); eye.addColorStop(.35, 'rgba(255,190,40,.6)'); eye.addColorStop(1, 'rgba(255,160,20,0)');
  g.fillStyle = eye; g.beginPath(); g.arc(-5, -1.5, 8, 0, TAU); g.fill();
  g.fillStyle = '#ff6a80';
  ARMS.forEach((a, k) => {
    if (k % 2) return;
    const pts = arm(k, ph, a.y0, a.endY, a.len, 5);
    for (const i of [6, 10, 14]) {
      g.globalAlpha = .5 + .5 * Math.sin(ph * 2 + k + i);
      g.beginPath(); g.arc(pts[i][0], pts[i][1], .6, 0, TAU); g.fill();
    }
  });
  g.restore();
}
