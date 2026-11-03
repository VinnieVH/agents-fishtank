import { TAU } from '../util';

interface Arm { index: number; rootY: number; endY: number; length: number; wave: number }

const SPOTS: [number, number, number][] = [[8, -6, 1.6], [15, 3, 2], [22, -4, 1.4], [29, 2, 1.7], [36, -2, 1.2], [12, -1, 1.1], [26, -7, 1]];
const ARMS: Arm[] = Array.from({ length: 8 }, (_, index) => ({ index, rootY: -5 + index * 10 / 7, endY: (index - 3.5) * 6.2, length: 40 + (index * 13 % 5) * 3, wave: 5 }));
const CLUBS: Arm[] = [{ index: 8, rootY: -2, endY: -27, length: 78, wave: 8 }, { index: 9, rootY: 2, endY: 21, length: 74, wave: 8 }];
const GLOWING_POINTS = [6, 10, 14];

const traceMantle = (g: CanvasRenderingContext2D) => {
  g.beginPath(); g.moveTo(-2, -8.5);
  g.bezierCurveTo(10, -12.5, 30, -10, 47, -1);
  g.bezierCurveTo(48, 0, 48, .6, 47, 1.2);
  g.bezierCurveTo(30, 10.5, 10, 12.5, -2, 8.5);
  g.closePath();
};

/** Points along one arm from its root, fanning out to its `endY` and writhing more towards the tip. */
const armPoints = (arm: Arm, phase: number): [number, number][] => {
  const points: [number, number][] = [];
  for (let step = 0; step <= 16; step++) {
    const along = step / 16;
    points.push([-10 - along * arm.length, arm.rootY + (arm.endY - arm.rootY) * along ** 1.3 + Math.sin(phase * .9 - along * 4.5 + arm.index * 1.7) * arm.wave * along]);
  }
  return points;
};

/** Strokes the arm thick at the root and thin at the tip. */
const strokeTapered = (g: CanvasRenderingContext2D, points: [number, number][], rootWidth: number) => {
  for (let index = 1; index < points.length; index++) {
    g.lineWidth = rootWidth * (1 - index / points.length) + .35;
    g.beginPath(); g.moveTo(...points[index - 1]); g.lineTo(...points[index]); g.stroke();
  }
};

const paintClubTip = (g: CanvasRenderingContext2D, points: [number, number][]) => {
  const [x, y] = points[points.length - 1], [previousX, previousY] = points[points.length - 3];
  g.save(); g.translate(x, y); g.rotate(Math.atan2(y - previousY, x - previousX));
  g.fillStyle = '#6e1b29'; g.beginPath(); g.ellipse(-1.5, 0, 4.5, 1.9, 0, 0, TAU); g.fill();
  g.fillStyle = 'rgba(240,200,190,.55)';
  for (let sucker = 0; sucker < 4; sucker++) { g.beginPath(); g.arc(-4 + sucker * 1.9, .7, .45, 0, TAU); g.fill(); }
  g.restore();
};

/** The two long hunting tentacles, each ending in a club of suckers. */
const paintClubs = (g: CanvasRenderingContext2D, phase: number) => {
  g.strokeStyle = '#5a1522';
  for (const club of CLUBS) {
    const points = armPoints(club, phase * .8);
    strokeTapered(g, points, 1.6);
    paintClubTip(g, points);
  }
};

/** Eight arms, the far ones darker, with a row of suckers on the near ones. */
const paintArms = (g: CanvasRenderingContext2D, phase: number) => {
  for (const arm of ARMS) {
    const points = armPoints(arm, phase), isFar = arm.index % 2 === 1;
    g.strokeStyle = isFar ? '#561522' : '#74202e';
    strokeTapered(g, points, 3.6);
    if (isFar) continue;
    g.fillStyle = 'rgba(240,200,190,.5)';
    for (let step = 2; step < points.length - 2; step += 2) {
      g.beginPath(); g.arc(points[step][0], points[step][1] + 1.2 * (1 - step / points.length), .55 * (1 - step / points.length) + .2, 0, TAU); g.fill();
    }
  }
};

/** Fins at the mantle's tip, then the mantle itself, dark on top and mottled, and the head with its huge eye. */
const paintBody = (g: CanvasRenderingContext2D) => {
  g.fillStyle = '#5c1421';
  g.beginPath(); g.moveTo(30, -6); g.quadraticCurveTo(40, -17, 51, -2.5); g.lineTo(51, 2.5); g.quadraticCurveTo(40, 17, 30, 6); g.closePath(); g.fill();
  const skin = g.createLinearGradient(0, -12, 0, 12);
  skin.addColorStop(0, '#4a0f1c'); skin.addColorStop(.6, '#7a2230'); skin.addColorStop(1, '#94394a');
  g.fillStyle = skin; traceMantle(g); g.fill();
  g.save(); traceMantle(g); g.clip();
  g.fillStyle = 'rgba(170,70,80,.45)';
  for (const [x, y, radius] of SPOTS) { g.beginPath(); g.arc(x, y, radius, 0, TAU); g.fill(); }
  g.restore();

  g.fillStyle = skin; g.beginPath(); g.ellipse(-6, 0, 8, 7.8, 0, 0, TAU); g.fill();
  const iris = g.createRadialGradient(-5, -1.5, .3, -5, -1.5, 3.4);
  iris.addColorStop(0, '#fff2a8'); iris.addColorStop(.6, '#e0a62a'); iris.addColorStop(1, '#7a4a10');
  g.fillStyle = iris; g.beginPath(); g.arc(-5, -1.5, 3.4, 0, TAU); g.fill();
  g.fillStyle = '#0a0406'; g.beginPath(); g.ellipse(-5, -1.5, 1.9, .8, 0, 0, TAU); g.fill();
  g.strokeStyle = '#3a0a14'; g.lineWidth = .7; g.beginPath(); g.arc(-5, -1.5, 3.6, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
};

// Draws the kraken, a giant squid heading right mantle first with its arms trailing, in units of length/100, origin at its head
export const paintKraken = (g: CanvasRenderingContext2D, length: number, phase: number) => {
  g.save(); g.scale(length / 100, length / 100);
  g.lineCap = 'round';
  paintClubs(g, phase);
  paintArms(g, phase);
  paintBody(g);
  g.restore();
};

// At night its eye burns, and a few lights flicker down the arms
export const paintKrakenGlow = (g: CanvasRenderingContext2D, length: number, phase: number) => {
  g.save(); g.scale(length / 100, length / 100);
  const eye = g.createRadialGradient(-5, -1.5, 0, -5, -1.5, 8);
  eye.addColorStop(0, '#ffe066'); eye.addColorStop(.35, 'rgba(255,190,40,.6)'); eye.addColorStop(1, 'rgba(255,160,20,0)');
  g.fillStyle = eye; g.beginPath(); g.arc(-5, -1.5, 8, 0, TAU); g.fill();
  g.fillStyle = '#ff6a80';
  for (const arm of ARMS) {
    if (arm.index % 2) continue;
    const points = armPoints(arm, phase);
    for (const step of GLOWING_POINTS) {
      g.globalAlpha = .5 + .5 * Math.sin(phase * 2 + arm.index + step);
      g.beginPath(); g.arc(points[step][0], points[step][1], .6, 0, TAU); g.fill();
    }
  }
  g.restore();
};
