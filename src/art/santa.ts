import type { FishLook } from './fishLook';
import { drawInto } from './fishPen';
import { Season } from '../seasons';
import { paintHat } from './hats';
import { FESTIVE_SEAHORSE, ODD_FISH } from './oddFish';
import { shade, TAU } from '../util';

// Santa in his sleigh, pulled by a team of seahorses, heading right. In units of length/100, origin mid-team.
const SLEIGH_AT = [-30, 1];
const SEAHORSE_SIZE = 30, SEAHORSE_UNIT = 7 / SEAHORSE_SIZE; // painted at their usual size, then shrunk to fit the team
const RED = '#d8232a', GOLD = '#f2c230', INK = '#4a0a10';
/** Four pairs of seahorses, one behind the other. Each is where it swims (x, y), its colour (the species' four) and its place in the bobbing. */
const COLUMNS = [-1, 11, 23, 35];
const BOB = 1.6; // how far the team rises and sinks while swimming
// each pair swims in line, the far horse right above the near one; the pairs bob in a wave along the team
const TEAM: [x: number, y: number, variant: number, offset: number][] = COLUMNS.map((x, index) => [
  [x + 1.5, -3.5, FESTIVE_SEAHORSE + 2 + index % 2, index * 1.1 + .4],
  [x, 1, FESTIVE_SEAHORSE + index % 2, index * 1.1],
] as [number, number, number, number][]).reverse().flat(); // furthest ahead first, the far horse of a pair before the near one
const bobbing = (phase: number, offset: number) => Math.sin(phase * .5 + offset) * BOB;
/** Where Santa's other hand holds the reins, in sleigh units. */
const REIN_HAND: [number, number] = [7.5, -7.6];
/** The lantern at the sleigh's front, which glows at night. */
export const LAMP: [number, number] = [SLEIGH_AT[0] + 19.5, SLEIGH_AT[1] - 10.5];

type Context = CanvasRenderingContext2D;

const fillInk = (g: Context, fill: string | CanvasGradient, ...pen: [inkColor?: string, width?: number]) => {
  const [inkColor = INK, width = .7] = pen;
  g.fillStyle = fill; g.fill();
  g.strokeStyle = inkColor; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
};

const ellipse = (g: Context, [x, y]: [number, number], [radiusX, radiusY]: [number, number]) => { g.beginPath(); g.ellipse(x, y, radiusX, radiusY, 0, 0, TAU); };

const paintSack = (g: Context) => {
  g.save(); g.translate(2.5, 0);
  g.beginPath(); g.moveTo(-15.5, -5); g.bezierCurveTo(-18, -11, -14, -16, -10, -16.5); g.bezierCurveTo(-6.5, -15.5, -6, -9, -7, -5); g.closePath();
  fillInk(g, '#a9763f', '#4a2d12');
  g.strokeStyle = '#7d5326'; g.lineWidth = .35; g.lineCap = 'round'; // stitches and a fold
  g.beginPath(); g.moveTo(-14, -8); g.quadraticCurveTo(-12, -11, -13, -13.5); g.moveTo(-9, -6.5); g.quadraticCurveTo(-8.2, -9, -8.6, -12); g.stroke();
  for (const [x, y, color] of [[-14.5, -19, '#3d6bff'], [-10.5, -19.6, '#2f9a4a'], [-12.4, -22.6, '#e8283f']] as const) {
    g.beginPath(); g.roundRect(x, y, 4.2, 3.6, .6); fillInk(g, color, shade(color, -.7), .5);
    g.fillStyle = GOLD; g.fillRect(x + 1.8, y, .6, 3.6); g.fillRect(x, y + 1.5, 4.2, .6);
  }
  g.strokeStyle = '#7a1f1f'; g.lineWidth = 1; g.beginPath(); g.moveTo(-14, -14.6); g.quadraticCurveTo(-10.6, -13.2, -7.4, -14.6); g.stroke(); // the rope round its neck
  ellipse(g, [-10.6, -14], [1.1, .8]); fillInk(g, '#a82a2a', '#4a0a10', .4);
  g.restore();
};

/** One round face: eyes and nose, a full beard wrapping the cheeks and chin, and a moustache over its top edge. */
const paintFace = (g: Context) => {
  const frost = '#8a96a6';
  ellipse(g, [-2, -14.6], [2.9, 2.8]); fillInk(g, '#f6c7a1', '#7a4a2c', .5);
  g.beginPath(); g.moveTo(-5.1, -14.4); g.bezierCurveTo(-6, -12, -5.4, -10.4, -4.2, -9.7); // a full beard with a wavy, curling edge
  g.quadraticCurveTo(-3.6, -8.6, -2.8, -9.2); g.quadraticCurveTo(-2, -8, -1.2, -9.2); g.quadraticCurveTo(-.4, -8.6, .2, -9.7);
  g.bezierCurveTo(1.4, -10.4, 2, -12, 1.1, -14.4); g.bezierCurveTo(.4, -12.4, -4.4, -12.4, -5.1, -14.4); g.closePath(); fillInk(g, '#fff', frost, .4);
  g.strokeStyle = '#c3ccd8'; g.lineWidth = .3; g.lineCap = 'round'; // strands of hair
  g.beginPath();
  for (const [x, top, bottom] of [[-4.4, -12.2, -10.4], [-3.4, -11.6, -9.9], [-2.4, -11, -9.2], [-1.2, -11, -9.4], [-.1, -11.6, -10], [.8, -12.2, -10.6]]) { g.moveTo(x, top); g.quadraticCurveTo(x - .5, (top + bottom) / 2, x - .1, bottom); }
  g.stroke();
  for (const [x, dir] of [[-2, -1], [-2, 1]]) { // the moustache: from under the nose, drooping down and outwards
    g.beginPath(); g.moveTo(x, -13); g.bezierCurveTo(x + dir * 1.8, -13.4, x + dir * 3.3, -12.6, x + dir * 3, -11.4);
    g.quadraticCurveTo(x + dir * 2.2, -12, x + dir * 1.2, -11.9); g.quadraticCurveTo(x + dir * .4, -11.9, x, -12.2); g.closePath(); fillInk(g, '#fff', frost, .4);
  }
  ellipse(g, [-2, -13.9], [.75, .65]); fillInk(g, '#e8837a', '#a85a50', .3);
  g.fillStyle = '#222'; for (const x of [-3.1, -.9]) { g.beginPath(); g.arc(x, -14.9, .45, 0, TAU); g.fill(); }
};

/** Santa from the waist up: beard, hat with its pom hanging back, and a hand waving. */
const paintSanta = (g: Context, phase: number) => {
  const wave = Math.sin(phase * 3);
  const arm = (from: [number, number], to: [number, number]) => { // outlined sleeve, then a mitten
    g.strokeStyle = INK; g.lineWidth = 3.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(...from); g.lineTo(...to); g.stroke();
    g.strokeStyle = RED; g.lineWidth = 2.2; g.stroke();
    ellipse(g, to, [1.4, 1.4]); fillInk(g, '#fff', '#8a96a6', .4);
  };
  arm([0, -7.6], [REIN_HAND[0] - 1, REIN_HAND[1]]); // his left arm, behind the body, holding the reins

  ellipse(g, [-2, -8], [4.8, 5.4]); fillInk(g, RED);
  g.beginPath(); g.moveTo(-6.4, -6.2); g.quadraticCurveTo(-2, -4.6, 2.4, -6.2); g.lineWidth = 1.3; g.strokeStyle = '#2a1a14'; g.stroke(); // the belt
  g.fillStyle = GOLD; g.fillRect(-3, -7, 2, 1.8); g.fillStyle = '#2a1a14'; g.fillRect(-2.4, -6.5, .8, .8);
  g.strokeStyle = '#fff'; g.lineWidth = .8; g.beginPath(); g.moveTo(-1.6, -9.4); g.lineTo(-1.8, -7.2); g.stroke(); // the coat's white edge
  arm([-5.2, -9.4], [-9.2 - wave * .8, -15.4 - wave * .6]); // his right arm, in front of the sack, waving
  paintFace(g);
  g.save(); g.translate(-1.8, -16.3); g.rotate(.12); g.scale(.2, .2); // the same Santa hat the fish wear
  paintHat(g, Season.Winter);
  g.restore();
};

const paintSleigh = (g: Context) => {
  const rim = new Path2D();
  rim.moveTo(-17, -8); rim.bezierCurveTo(-18.5, -2, -16, 3.5, -10, 4.6); rim.lineTo(11, 4.6); rim.bezierCurveTo(17, 4.6, 20, .5, 19, -4.5);
  rim.lineTo(19.5, -6.5); rim.quadraticCurveTo(2, -3.8, -17, -8); rim.closePath();
  g.strokeStyle = INK; g.lineWidth = 1.9; g.lineCap = 'round'; // gold runner with its curled tip, and the two struts
  const runner = new Path2D(); runner.moveTo(-17, 7.4); runner.lineTo(12, 7.4); runner.bezierCurveTo(19, 7.4, 22.5, 4.5, 21.5, .5);
  g.stroke(runner); g.strokeStyle = GOLD; g.lineWidth = 1; g.stroke(runner);
  for (const x of [-9, 9]) { g.beginPath(); g.moveTo(x, 4.4); g.lineTo(x, 7.2); g.strokeStyle = shade(GOLD, -.3); g.lineWidth = 1.2; g.stroke(); }

  const skin = g.createLinearGradient(0, -8, 0, 5);
  skin.addColorStop(0, '#ec3a3a'); skin.addColorStop(1, '#a8141c');
  g.fillStyle = skin; g.fill(rim); g.strokeStyle = INK; g.lineWidth = .8; g.lineJoin = 'round'; g.stroke(rim);
  g.strokeStyle = GOLD; g.lineWidth = .9; g.lineCap = 'round'; // gold trim along the front and a swirl on the side
  g.lineWidth = 1.3; // wide enough to hide the dark outline along the whole top edge
  g.beginPath(); g.moveTo(17.75, -6.247); g.quadraticCurveTo(1.665, -4.092, -15.67, -7.714); g.stroke(); // the rim's own edge, one gentle curve between the rings
  g.lineWidth = .9;
  g.beginPath(); g.moveTo(-9, .5); g.bezierCurveTo(-4, -3, 4, -3, 9, .5); g.bezierCurveTo(4, 2.6, -4, 2.6, -9, .5); g.stroke();
  for (const [x, y] of [[-17.2, -8.8], [19.5, -7.4]]) { g.beginPath(); g.arc(x, y, 1.5, 0, TAU); g.lineWidth = .9; g.stroke(); }

  g.strokeStyle = INK; g.lineWidth = .5; g.beginPath(); g.moveTo(19.5, -8); g.lineTo(19.5, -9.6); g.stroke(); // the lantern
  g.beginPath(); g.roundRect(18.3, -12.6, 2.4, 3, .5); fillInk(g, '#ffe27a', INK, .5);
};

/** One seahorse of the team, leaning into the pull: its back fin fluttering behind it, then the body. */
const paintHorse = (g: Context, phase: number, [x, y, variant, offset]: (typeof TEAM)[number]) => {
  const look: FishLook = { species: 'seahorse', body: '#fff', neon: '#fff', pattern: 0, variant, small: true, spots: [] };
  const { paint, fin } = ODD_FISH.seahorse;
  g.save(); g.translate(x, y + bobbing(phase, offset)); g.rotate(.5 + Math.cos(phase * .5 + offset) * .1); g.scale(SEAHORSE_UNIT, SEAHORSE_UNIT);
  drawInto(g);
  if (fin) {
    g.save(); g.translate(fin.root[0] * SEAHORSE_SIZE, fin.root[1] * SEAHORSE_SIZE); g.rotate(Math.sin(phase * 10 + offset) * .3);
    fin.paint(look, SEAHORSE_SIZE, { wag: 0, sway: 0, phase });
    g.restore();
  }
  paint(look, SEAHORSE_SIZE, { wag: 0, sway: 0, phase });
  g.restore();
};

/** The harness: a line from the sleigh's front through every seahorse's chest, and a rein from Santa's hand to the first. */
const paintReins = (g: Context, phase: number) => {
  g.strokeStyle = '#4a2d12'; g.lineWidth = .4; g.lineCap = 'round'; g.lineJoin = 'round';
  const chest = COLUMNS.map((x, index): [number, number] => [x + 1.5, 1 + bobbing(phase, index * 1.1)]); // the near horse of each pair
  const start: [number, number] = [SLEIGH_AT[0] + 20, SLEIGH_AT[1] - 3];
  g.beginPath(); g.moveTo(...start);
  let [fromX, fromY] = start;
  for (const [x, y] of chest) { g.quadraticCurveTo((fromX + x) / 2, Math.max(fromY, y) + 2.5, x, y); [fromX, fromY] = [x, y]; }
  g.stroke();
  const [hand, first] = [REIN_HAND, chest[0]];
  g.beginPath(); g.moveTo(SLEIGH_AT[0] + hand[0], SLEIGH_AT[1] + hand[1]);
  g.quadraticCurveTo(SLEIGH_AT[0] + 16, SLEIGH_AT[1] - 3, first[0], first[1] - 1); g.stroke();
};

/** Draws Santa's sleigh and its seahorses heading right, in units of length/100, origin mid-team. */
export const paintSantaSleigh = (g: Context, length: number, phase: number) => {
  g.save(); g.scale(length / 100, length / 100);
  const horses = TEAM;
  paintReins(g, phase);
  for (const horse of horses) paintHorse(g, phase, horse);
  g.save(); g.translate(SLEIGH_AT[0], SLEIGH_AT[1] + Math.sin(phase * .3 + 1) * .6); g.rotate(Math.sin(phase * .3) * .02);
  paintSack(g); paintSanta(g, phase); paintSleigh(g);
  g.restore();
  g.restore();
};

/** The warm glow of the lantern at night. */
export const paintSantaGlow = (g: Context, length: number) => {
  g.save(); g.scale(length / 100, length / 100);
  const glow = g.createRadialGradient(LAMP[0], LAMP[1], 0, LAMP[0], LAMP[1], 16);
  glow.addColorStop(0, 'rgba(255,214,110,.8)'); glow.addColorStop(1, 'rgba(255,214,110,0)');
  g.fillStyle = glow; g.fillRect(LAMP[0] - 16, LAMP[1] - 16, 32, 32);
  g.restore();
};
