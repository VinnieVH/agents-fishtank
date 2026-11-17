import { shade, TAU } from '../util';
import { ellipse, g, ink, poly, toon } from './sceneryPen';
import type { Point } from './sceneryPen';

// 3/4 view like the treasure chest: front face, right side face and the open top, the lid hinged at the back and tipped open
const WIDTH = 66, HEIGHT = 34, LEFT = -WIDTH / 2, RIGHT = WIDTH / 2, TOP = -HEIGHT, DEPTH_X = 20, DEPTH_Y = -15, BACK = TOP + DEPTH_Y;
const LID = 30, TILT = 8, THICK = 7;
const INK = '#2b2118', STONE = '#d8ccb4', BRONZE = '#4f9a86', BRONZE_LIGHT = '#9fdcc8';

const line = ([fromX, fromY]: Point, [toX, toY]: Point) => {
  const path = new Path2D(); path.moveTo(fromX, fromY); path.lineTo(toX, toY);
  return path;
};
const band = (path: Path2D, width: number) => {
  ink(path, { color: INK, width: width + 2.4 }); ink(path, { color: BRONZE, width }); ink(path, { color: BRONZE_LIGHT, width: width * .3 });
};

/** The lid, a thick stone slab seen from inside, tipped open against the back: an inset panel, a lit top edge and its right end in shade. */
const paintLid = () => {
  const hingeLeft: Point = [LEFT + DEPTH_X, BACK], hingeRight: Point = [RIGHT + DEPTH_X, BACK];
  const edgeLeft: Point = [hingeLeft[0] + TILT, BACK - LID], edgeRight: Point = [hingeRight[0] + TILT, BACK - LID];
  const end = poly(hingeRight, edgeRight, [edgeRight[0] + THICK, edgeRight[1] - 4], [hingeRight[0] + THICK, hingeRight[1] - 4]);
  toon(end, { fill: shade(STONE, -.45), inkColor: INK, width: 2.2 });
  const inside = poly(hingeLeft, hingeRight, edgeRight, edgeLeft);
  toon(inside, { fill: shade(STONE, -.3), inkColor: INK, width: 2.4 }, () => {
    const inset = (across: number, rise: number): Point => [hingeLeft[0] + TILT * rise + across * WIDTH, BACK - LID * rise];
    g.fillStyle = shade(STONE, -.5); g.fill(poly(inset(.07, .14), inset(.93, .14), inset(.93, .86), inset(.07, .86)));
    g.fillStyle = shade(STONE, -.38); g.fill(poly(inset(.11, .22), inset(.89, .22), inset(.89, .78), inset(.11, .78)));
  });
  const top = poly(edgeLeft, edgeRight, [edgeRight[0] + THICK, edgeRight[1] - 4], [edgeLeft[0] + THICK, edgeLeft[1] - 4]);
  toon(top, { fill: shade(STONE, .1), inkColor: INK, width: 2.2 });
  band(line([hingeLeft[0] + TILT * .08, BACK - LID * .08], [hingeRight[0] + TILT * .08, BACK - LID * .08]), 3);
};
/** A rolled papyrus, tied with a red cord, whose foot is at `foot` and that leans by `lean` radians. */
const paintScroll = (lean: number, foot: Point) => {
  g.save(); g.translate(foot[0], foot[1]); g.rotate(lean);
  const roll = new Path2D(); roll.roundRect(-4.5, -34, 9, 38, 3.5);
  toon(roll, { fill: '#efdfb4', inkColor: '#4a3418', width: 1.7 }, () => {
    g.fillStyle = '#d3bd88'; g.fillRect(1, -34, 4, 38);
    g.fillStyle = '#a63a2e'; g.fillRect(-4.5, -19, 9, 3.5);
  });
  ellipse({ x: 0, y: -34, radiusX: 3.8, radiusY: 1.8, color: '#b79c62' });
  g.restore();
};

const SCROLLS: [number, number, number][] = [[0, .5, .35], [-.2, .28, .45], [.22, .72, .45], [-.38, .12, .6], [.4, .88, .6]]; // lean, across, back: the last ones to go first

/** The inside of the box: a dark well, its inner left and back walls, and the thick stone rim round the top. */
const paintOpening = () => {
  const well = poly([LEFT, TOP], [RIGHT, TOP], [RIGHT + DEPTH_X, BACK], [LEFT + DEPTH_X, BACK]);
  toon(well, { fill: '#2a2018', inkColor: INK, width: 2 }, () => {
    g.fillStyle = shade(STONE, -.5); g.fill(poly([LEFT, TOP], [LEFT + DEPTH_X, BACK], [LEFT + DEPTH_X, BACK + 22], [LEFT, TOP + 14]));
    g.fillStyle = shade(STONE, -.38); g.fill(poly([LEFT + DEPTH_X, BACK], [RIGHT + DEPTH_X, BACK], [RIGHT + DEPTH_X, BACK + 12], [LEFT + DEPTH_X, BACK + 12]));
  });
  const rim = new Path2D(); rim.moveTo(RIGHT + DEPTH_X, BACK); rim.lineTo(LEFT + DEPTH_X, BACK); rim.lineTo(LEFT, TOP);
  ink(rim, { color: INK, width: 8 }); ink(rim, { color: shade(STONE, .05), width: 5 });
};
const paintBox = () => {
  const side = poly([RIGHT, TOP], [RIGHT + DEPTH_X, BACK], [RIGHT + DEPTH_X, DEPTH_Y], [RIGHT, 0]);
  toon(side, { fill: shade(STONE, -.28), inkColor: INK, width: 2.4 });
  const front = poly([LEFT, TOP], [RIGHT, TOP], [RIGHT, 0], [LEFT, 0]);
  toon(front, { fill: STONE, inkColor: INK, width: 2.4 }, () => {
    g.fillStyle = shade(STONE, -.12); g.fillRect(LEFT, -8, WIDTH, 8);
    g.fillStyle = shade(STONE, .2); g.fillRect(LEFT + 4, TOP + 3, 9, HEIGHT - 12);
    g.strokeStyle = shade(STONE, -.5); g.lineWidth = 1.6; g.beginPath();
    for (let step = 0; step < 5; step++) { // a Greek key frieze
      const x = LEFT + 8 + step * 11;
      g.moveTo(x, -22); g.lineTo(x + 8, -22); g.lineTo(x + 8, -14); g.lineTo(x + 2, -14); g.lineTo(x + 2, -18);
    }
    g.stroke();
  });
  band(front, 3.2); band(side, 3);
  for (const x of [LEFT + 6, RIGHT - 6]) band(line([x, TOP], [x, 0]), 4);
  const lock = new Path2D(); lock.roundRect(-6, TOP - 1, 12, 14, 3);
  toon(lock, { fill: BRONZE, inkColor: INK, width: 1.8 }, () => ellipse({ x: -2, y: TOP + 3, radiusX: 2, radiusY: 1.3, color: BRONZE_LIGHT }));
  g.fillStyle = INK; g.beginPath(); g.arc(0, TOP + 6, 1.9, 0, TAU); g.fill();
};

/** Sand heaped over the foot of the front and up the right side to the back corner, so the coffer sits in a pile of sand. */
const paintDrift = (snow: boolean) => {
  const edge = new Path2D(); edge.moveTo(LEFT - 16, 7); edge.quadraticCurveTo(LEFT - 6, -4, LEFT + 8, -3); edge.quadraticCurveTo(WIDTH * .2, 1, RIGHT - 4, -4);
  edge.quadraticCurveTo(RIGHT + DEPTH_X * .5, DEPTH_Y * .45 - 5, RIGHT + DEPTH_X + 3, DEPTH_Y - 4); edge.quadraticCurveTo(RIGHT + DEPTH_X + 14, DEPTH_Y + 2, RIGHT + DEPTH_X + 24, 7);
  const drift = new Path2D(edge); drift.closePath();
  g.fillStyle = snow ? '#eef5fc' : '#e8cd96'; g.fill(drift);
  ink(edge, { color: snow ? '#5f7fa3' : '#7a5726', width: 2 });
};

/** A Roman-style stone coffer, its lid thrown open, with rolled scrolls standing in it: one is gone for each 20% of credits used. */
export const paintCoffer = (scrolls: number, snow: boolean) => {
  paintLid();
  paintOpening();
  for (const [lean, across, back] of SCROLLS.slice(0, Math.min(5, scrolls)).reverse()) {
    paintScroll(lean, [LEFT + DEPTH_X * back + across * WIDTH, TOP + DEPTH_Y * back + 3]);
  }
  paintBox();
  paintDrift(snow);
};
