import { rng, shade, TAU } from '../util';
import { ellipse, g, ink, toon } from './sceneryPen';
import type { Point } from './sceneryPen';

// 3/4 view: front face, right side face and the open top, with the lid hinged at the back and tipped open
const WIDTH = 64, HEIGHT = 36, LEFT = -WIDTH / 2, RIGHT = WIDTH / 2, TOP = -HEIGHT, DEPTH_X = 18, DEPTH_Y = -14;
const LID_HEIGHT = 30, LID_TILT = 7;
const BACK = TOP + DEPTH_Y; // back rim / hinge line
const INK = '#2a1405', BRASS = '#e0ac35', BRASS_LIGHT = '#ffe08a', GOLD_INK = '#7a4f00';

const GEMS = [
  { across: .5, back: .55, color: '#e6fbff', inkColor: '#3d7591', glow: '#bff4ff' }, // diamond
  { across: .26, back: .45, color: '#ff2d55', inkColor: '#6b0016', glow: '#ff6b88' }, // ruby
  { across: .74, back: .5, color: '#2f6bff', inkColor: '#0a1f66', glow: '#6f9bff' }, // sapphire
  { across: .38, back: .85, color: '#ff2d55', inkColor: '#6b0016', glow: '#ff6b88' }, // ruby
  { across: .64, back: .85, color: '#2f6bff', inkColor: '#0a1f66', glow: '#6f9bff' }, // sapphire
];
type Gem = typeof GEMS[number];
const SPARKLES = [[.5, .7, 5], [.22, .4, 3.5]] as const;
const SPILLED_COINS = [[RIGHT + 8, 4], [LEFT - 7, 5], [RIGHT + 17, 2], [6, 7]] as const;

const poly = (...points: Point[]) => {
  const path = new Path2D();
  points.forEach(([x, y], index) => index ? path.lineTo(x, y) : path.moveTo(x, y));
  path.closePath();
  return path;
};
const band = (path: Path2D, width: number) => {
  ink(path, { color: INK, width: width + 2.6 }); ink(path, { color: BRASS, width }); ink(path, { color: BRASS_LIGHT, width: width * .3 });
};
const line = ([fromX, fromY]: Point, [toX, toY]: Point) => {
  const path = new Path2D(); path.moveTo(fromX, fromY); path.lineTo(toX, toY);
  return path;
};

const paintShadow = () => {
  const shadow = poly([LEFT - 4, 3], [RIGHT + 4, 3], [RIGHT + DEPTH_X + 6, DEPTH_Y + 2], [LEFT + DEPTH_X, DEPTH_Y + 2]);
  g.globalAlpha = .28; g.fillStyle = '#000'; g.fill(shadow); g.globalAlpha = 1;
};

/** The lid, seen from the inside, with its domed end on the right. */
const paintLid = () => {
  const hingeLeft: Point = [LEFT + DEPTH_X, BACK], hingeRight: Point = [RIGHT + DEPTH_X, BACK];
  const edgeRight: Point = [RIGHT + DEPTH_X + LID_TILT, BACK - LID_HEIGHT], edgeLeft: Point = [LEFT + DEPTH_X + LID_TILT, BACK - LID_HEIGHT];
  const inside = poly(hingeLeft, hingeRight, edgeRight, edgeLeft);
  toon(inside, { fill: '#4a2810', inkColor: INK, width: 2.4 }, () => {
    for (let plank = 1; plank < 4; plank++) {
      const share = plank / 4;
      ink(line([hingeLeft[0] + LID_TILT * share, BACK - LID_HEIGHT * share], [hingeRight[0] + LID_TILT * share, BACK - LID_HEIGHT * share]), { color: '#2e1608', width: 1.4 });
    }
    g.fillStyle = '#5e341a'; g.fill(poly(edgeLeft, edgeRight, [edgeRight[0] - 2, edgeRight[1] + 7], [edgeLeft[0] - 2, edgeLeft[1] + 7]));
  });
  const middleX = (hingeRight[0] + edgeRight[0]) / 2, middleY = (hingeRight[1] + edgeRight[1]) / 2;
  const radius = Math.hypot(LID_TILT, LID_HEIGHT) / 2, angle = Math.atan2(edgeRight[1] - hingeRight[1], edgeRight[0] - hingeRight[0]);
  const dome = new Path2D(); dome.ellipse(middleX, middleY, radius, radius * .55, angle, Math.PI, TAU, true); dome.closePath();
  toon(dome, { fill: '#8a5428', inkColor: INK, width: 2.2 }, () => ellipse({ x: middleX + 6, y: middleY, radiusX: radius * .4, radiusY: radius * .8, rotation: angle, color: '#6a3d1a' }));
  band(dome, 2.6); band(inside, 3);
};

/** The inside of the box: a dark well with the inner back wall. */
const paintOpening = () => {
  const opening = poly([LEFT, TOP], [RIGHT, TOP], [RIGHT + DEPTH_X, BACK], [LEFT + DEPTH_X, BACK]);
  toon(opening, { fill: '#2a1407', inkColor: INK, width: 2 }, () => {
    g.fillStyle = '#5a3216'; g.fill(poly([LEFT + DEPTH_X, BACK], [RIGHT + DEPTH_X, BACK], [RIGHT + DEPTH_X, BACK + 9], [LEFT + DEPTH_X, BACK + 9]));
  });
};

/** How far the gold has sunk below the rim, and how high it heaps up in the middle. */
const goldLevel = (gold: number) => ({ sink: Math.max(0, .4 - gold) / .4 * 8, heap: Math.max(0, gold - .25) * 30 });

/** A point on the gold's surface, `across` the box from left to right and `back` from its front to its back. */
const onGold = (gold: number, lift: number) => {
  const { sink, heap } = goldLevel(gold);
  return (across: number, back: number): Point =>
    [LEFT + DEPTH_X * back + across * WIDTH, TOP + sink + DEPTH_Y * back - heap * 4 * across * (1 - across) * back * .95 - lift];
};

const paintSparkles = (at: (across: number, back: number) => Point) => {
  for (const [across, back, size] of SPARKLES) {
    const [x, y] = at(across, back), sparkle = new Path2D();
    sparkle.moveTo(x, y - size - 4); sparkle.quadraticCurveTo(x, y - 4, x + size, y - 4); sparkle.quadraticCurveTo(x, y - 4, x, y + size - 4);
    sparkle.quadraticCurveTo(x, y - 4, x - size, y - 4); sparkle.quadraticCurveTo(x, y - 4, x, y - size - 4); g.fillStyle = '#fffbe0'; g.fill(sparkle);
  }
};

/** The gold: its level shows the Copilot credits left (gold = 0..1). Low = a layer down in the box, full = a heap. */
const paintGold = (gold: number) => {
  const random = rng(4242); // own RNG so the rest of the scenery doesn't shift with the gold
  const { sink, heap } = goldLevel(gold);
  const surface = new Path2D();
  surface.moveTo(LEFT, TOP + sink); surface.lineTo(LEFT + DEPTH_X, BACK + sink);
  surface.quadraticCurveTo(DEPTH_X, BACK + sink - heap * 2, RIGHT + DEPTH_X, BACK + sink); surface.lineTo(RIGHT, TOP + sink); surface.closePath();
  g.save(); g.clip(poly([LEFT, TOP], [RIGHT, TOP], [RIGHT + DEPTH_X, BACK], [RIGHT + DEPTH_X, BACK - 80], [LEFT - 4, BACK - 80], [LEFT - 4, TOP]));
  g.save(); g.shadowColor = '#ffd34d'; g.shadowBlur = 6 + 12 * gold; g.fillStyle = '#f2c230'; g.fill(surface); g.restore();
  ink(surface, { color: GOLD_INK, width: 1.6 });
  const at = onGold(gold, 1);
  for (let index = 0, count = 6 + Math.round(16 * gold); index < count; index++) {
    const [x, y] = at(.08 + random() * .84, .15 + random() * .8);
    const coin = new Path2D(); coin.ellipse(x, y, 4, 2.6, random() * .6 - .3, 0, TAU);
    toon(coin, { fill: '#ffe27a', inkColor: GOLD_INK, width: 1 }, () => {
      ellipse({ x, y: y + 1.2, radiusX: 4, radiusY: 1.3, color: '#e0a91c' }); ellipse({ x: x - 1.2, y: y - .8, radiusX: 1.4, radiusY: .7, color: '#fffbe0' });
    });
  }
  if (gold >= .5) paintSparkles(at);
  g.restore();
};

const paintGem = (gem: Gem, [x, y]: Point) => {
  const size = 5.5;
  const cut = poly([x - size, y - size * .2], [x - size * .55, y - size * .75], [x + size * .55, y - size * .75], [x + size, y - size * .2], [x, y + size]);
  g.save(); g.shadowColor = gem.glow; g.shadowBlur = 8; g.fillStyle = gem.color; g.fill(cut); g.restore();
  toon(cut, { fill: gem.color, inkColor: gem.inkColor, width: 1.3 }, () => {
    g.fillStyle = shade(gem.color, -.35); g.fill(poly([x, y - size * .2], [x + size, y - size * .2], [x, y + size])); // shaded right pavilion
    g.fillStyle = shade(gem.color, .4); g.fill(poly([x - size * .55, y - size * .75], [x + size * .55, y - size * .75], [x + size * .3, y - size * .2], [x - size * .3, y - size * .2])); // table
    ink(line([x - size, y - size * .2], [x + size, y - size * .2]), { color: gem.inkColor, width: .8, alpha: .6 });
    ink(line([x - size * .3, y - size * .2], [x, y + size]), { color: gem.inkColor, width: .6, alpha: .4 });
    ellipse({ x: x - size * .35, y: y - size * .5, radiusX: size * .22, radiusY: size * .12, rotation: -.4, color: '#ffffff', alpha: .95 });
  });
};

/** Precious stones on top of the gold: one per started 20% of credits left. The diamond is the last one to go. */
const paintGems = (gold: number, gems: number) => {
  const at = onGold(gold, 2);
  for (const gem of GEMS.slice(0, Math.min(5, gems)).reverse()) paintGem(gem, at(gem.across, gem.back));
};

/** The right side face (in shade) and the front face with planks, their brass bands and the lock. */
const paintBox = () => {
  const side = poly([RIGHT, TOP], [RIGHT + DEPTH_X, BACK], [RIGHT + DEPTH_X, DEPTH_Y], [RIGHT, 0]);
  toon(side, { fill: '#6a3d1a', inkColor: INK, width: 2.4 }, () => {
    for (let plank = 1; plank < 3; plank++) { const share = plank / 3; ink(line([RIGHT, TOP + HEIGHT * share], [RIGHT + DEPTH_X, BACK + HEIGHT * share]), { color: '#3e2210', width: 1.4 }); }
  });
  const front = poly([LEFT, TOP], [RIGHT, TOP], [RIGHT, 0], [LEFT, 0]);
  toon(front, { fill: '#8a5428', inkColor: INK, width: 2.4 }, () => {
    g.fillStyle = '#6a3d1a'; g.fillRect(LEFT, TOP + HEIGHT * .72, WIDTH, HEIGHT * .3);
    for (let plank = 0; plank < 3; plank++) {
      const y = TOP + HEIGHT * plank / 3;
      g.fillStyle = '#a86a36'; g.fillRect(LEFT, y + 2, WIDTH, 2);
      if (plank) { g.fillStyle = '#4a2810'; g.fillRect(LEFT, y - 1, WIDTH, 1.6); }
    }
  });
  band(front, 3.5); band(side, 3);
  for (const x of [-WIDTH / 4, WIDTH / 4]) band(line([x, TOP], [x, 0]), 4);
  band(line([RIGHT + DEPTH_X * .5, TOP + DEPTH_Y * .5], [RIGHT + DEPTH_X * .5, DEPTH_Y * .5]), 3);
  for (const [x, y] of [[LEFT, TOP], [LEFT, 0], [RIGHT, TOP], [RIGHT, 0], [RIGHT + DEPTH_X, BACK], [RIGHT + DEPTH_X, DEPTH_Y]]) {
    const rivet = new Path2D(); rivet.arc(x, y, 2.6, 0, TAU); toon(rivet, { fill: BRASS, inkColor: INK, width: 1.2 });
  }
  const lock = new Path2D(); lock.roundRect(-6.5, TOP - 1, 13, 15, 3);
  toon(lock, { fill: BRASS, inkColor: INK, width: 1.8 }, () => ellipse({ x: -2.5, y: TOP + 2.5, radiusX: 2.2, radiusY: 1.4, color: BRASS_LIGHT }));
  g.fillStyle = INK; g.beginPath(); g.arc(0, TOP + 6, 2, 0, TAU); g.fill(); g.fillRect(-.9, TOP + 6, 1.8, 4.5);
};

const traceDrift = (path: Path2D) => {
  path.moveTo(LEFT - 16, 7); path.quadraticCurveTo(LEFT - 6, -3, LEFT + 8, -2); path.quadraticCurveTo(WIDTH * .2, 1, RIGHT - 4, -3);
  path.quadraticCurveTo(RIGHT + DEPTH_X * .5, DEPTH_Y * .45 - 4, RIGHT + DEPTH_X + 3, DEPTH_Y - 1); path.quadraticCurveTo(RIGHT + DEPTH_X + 14, DEPTH_Y + 4, RIGHT + DEPTH_X + 22, 7);
  return path;
};

/** Sunk into the sand: a drift over the foot of its front and up its side to the back corner. */
const paintDrift = () => {
  const drift = traceDrift(new Path2D());
  drift.closePath();
  g.fillStyle = '#e8cd96'; g.fill(drift);
  ink(traceDrift(new Path2D()), { color: '#7a5726', width: 2 });
  for (const [x, y] of [[LEFT - 4, 2], [WIDTH * .1, 3], [RIGHT + 6, 0], [RIGHT + DEPTH_X - 2, DEPTH_Y + 6]]) ellipse({ x, y, radiusX: 1.3, radiusY: 1, color: '#c9a66a' });
};

/** A few coins spilled on the sand when it's well filled. */
const paintSpill = (gold: number) => {
  const spill = gold >= .9 ? 4 : gold >= .6 ? 2 : 0;
  for (const [x, y] of SPILLED_COINS.slice(0, spill)) {
    const coin = new Path2D(); coin.ellipse(x, y, 4.2, 2.4, 0, 0, TAU);
    toon(coin, { fill: '#ffe27a', inkColor: GOLD_INK, width: 1.1 }, () => {
      ellipse({ x, y: y + 1.1, radiusX: 4.2, radiusY: 1.2, color: '#e0a91c' }); ellipse({ x: x - 1.3, y: y - .7, radiusX: 1.4, radiusY: .6, color: '#fffbe0' });
    });
  }
};

/** The treasure chest standing at `at`, holding `gold` (0..1) and `gems` precious stones. */
export const paintChest = ([x, y]: Point, gold: number, gems: number) => {
  g.save(); g.translate(x, y);
  paintShadow();
  paintLid();
  paintOpening();
  if (gold > 0) paintGold(gold);
  if (gems > 0) paintGems(gold, gems);
  paintBox();
  paintDrift();
  paintSpill(gold);
  g.restore();
};
