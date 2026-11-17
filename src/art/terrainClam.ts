import { shade, TAU } from '../util';
import { g, ink, toon } from './sceneryPen';
import type { Point } from './sceneryPen';

type Pearl = [x: number, y: number, radius: number];
/** Takes a point on a shell half laid flat (across, along from the hinge to the lip) to the screen. */
type Flat = (across: number, along: number) => Point;

const INK = '#2a1a12';
const SHELL = '#b8935f';
const RIM = '#ead5a8';
const FLESH = '#ec8466';
const PEARLS: Pearl[] = [[0, -26, 11], [-24, -31, 9], [24, -31, 9], [-8, -40, 8], [10, -41, 8]]; // the last ones go first

// both halves share one footprint, so a shut clam is one whole: it is HALF wide, LENGTH from the hinge to the lip, seen from 24 degrees above
const HALF = 54, LENGTH = 92, BELLY = 52, HINGE_Y = -54, BUMPS = 9;
const SIN_VIEW = .407, COS_VIEW = .914, OPEN_ANGLE = Math.PI * 100 / 180, DOME = 22;

/** The lid turned up by `open` (0 shut, 1 wide open) about the hinge, arched away from its plane: how far a point moves down the screen (up when negative). */
const lidFlat = (open: number): Flat => {
  const angle = open * OPEN_ANGLE, cos = Math.cos(angle), sin = Math.sin(angle);
  return (across, along) => {
    const arch = DOME * (1 - open) ** 2 * (1 - (across / HALF) ** 2) * Math.sin(Math.PI * along / LENGTH);
    return [across, HINGE_Y + SIN_VIEW * (along * cos - arch * sin) - COS_VIEW * (along * sin + arch * cos)];
  };
};
const shut = (across: number, along: number): Point => [across, HINGE_Y + SIN_VIEW * along];

const paintPearl = ([x, y, radius]: Pearl) => {
  g.save(); g.shadowColor = '#fff6ff'; g.shadowBlur = 8;
  const pearl = new Path2D(); pearl.arc(x, y, radius, 0, TAU);
  toon(pearl, { fill: '#f9f1e6', inkColor: '#8a6f78', width: 1.6 }, () => {
    const shine = new Path2D(); shine.ellipse(x - radius * .35, y - radius * .4, radius * .32, radius * .22, -.5, 0, TAU);
    g.fillStyle = '#e2cdd0'; g.beginPath(); g.ellipse(x + radius * .3, y + radius * .4, radius * .75, radius * .6, 0, 0, TAU); g.fill();
    g.fillStyle = '#fff'; g.fill(shine);
  });
  g.restore();
};

const rimPoint = (angle: number, grow = 1): [number, number] => [HALF * grow * Math.cos(angle), BELLY + (LENGTH - BELLY) * grow * Math.sin(angle)];

/** Adds the scalloped lip from the left edge round the front to the right edge, continuing from the left edge. */
const scallops = (path: Path2D, flat: Flat) => {
  for (let step = 0; step < BUMPS; step++) {
    path.quadraticCurveTo(...flat(...rimPoint(Math.PI - (step + .5) / BUMPS * Math.PI, 1.1)), ...flat(...rimPoint(Math.PI - (step + 1) / BUMPS * Math.PI)));
  }
};

/** The shared footprint of both shell halves: narrow at the hinge, full at the belly, a scalloped lip at the front. */
const footprint = (flat: Flat) => {
  const path = new Path2D();
  path.moveTo(...flat(-18, 0));
  path.bezierCurveTo(...flat(-36, 10), ...flat(-HALF, 26), ...flat(-HALF, BELLY));
  scallops(path, flat);
  path.bezierCurveTo(...flat(HALF, 26), ...flat(36, 10), ...flat(18, 0));
  path.closePath();
  return path;
};

/** Ribs fanning from the hinge out to the lip's scallops. */
const ribs = (flat: Flat, color: string) => {
  g.strokeStyle = color; g.lineWidth = 2.2; g.beginPath();
  for (let rib = 1; rib < BUMPS; rib++) {
    const [across, along] = rimPoint(Math.PI - rib / BUMPS * Math.PI);
    g.moveTo(...flat(0, 3)); g.quadraticCurveTo(...flat(across * .5, along * .45 + 6), ...flat(across, along));
  }
  g.stroke();
};

const paintMouth = (pearls: number) => {
  const mouth = footprint(shut), pit: Flat = (across, along) => shut(across * .86, 8 + along * .8);
  toon(mouth, { fill: shade(FLESH, -.4), inkColor: INK, width: 2.2 }, () => {
    g.fillStyle = shade(FLESH, -.05); g.fill(footprint(pit));
    g.fillStyle = shade(FLESH, .2);
    for (const [across, along] of [[-28, 40], [-8, 52], [14, 46], [30, 36], [20, 24]]) { g.beginPath(); g.ellipse(...pit(across, along), 6, 2.4, 0, 0, TAU); g.fill(); }
  });
  for (const spot of PEARLS.slice(0, Math.min(5, pearls)).reverse()) paintPearl(spot);
};

/** The bowl under the mouth: its wall ribbed down from the scalloped lip to the sand. */
const paintBowl = () => {
  const [side, belly] = shut(HALF, BELLY), wall = new Path2D();
  wall.moveTo(side, belly); wall.bezierCurveTo(side + 4, belly + 36, 30, 3, 0, 3); wall.bezierCurveTo(-30, 3, -side - 4, belly + 36, -side, belly);
  scallops(wall, shut); wall.closePath();
  toon(wall, { fill: SHELL, inkColor: INK, width: 2.4 }, () => {
    g.fillStyle = shade(SHELL, -.14); g.fillRect(-side - 6, belly + 22, 130, 40);
    g.strokeStyle = shade(SHELL, -.4); g.lineWidth = 2; g.beginPath();
    for (let rib = 1; rib < BUMPS; rib++) {
      const [px, py] = shut(...rimPoint(Math.PI - rib / BUMPS * Math.PI));
      g.moveTo(px, py); g.quadraticCurveTo(px * .85, py + 12, px * .3, 3);
    }
    g.stroke();
  });
  const lip = new Path2D(); lip.moveTo(-side, belly); scallops(lip, shut);
  ink(lip, { color: RIM, width: 4 }); ink(lip, { color: INK, width: 1.2 });
};

/** The lid seen from outside, shut or nearly: the domed back of the shell, ribbed from the hinge. */
const paintLidOutside = (flat: Flat) => {
  toon(footprint(flat), { fill: SHELL, inkColor: INK, width: 2.4 }, () => {
    const dome = g.createLinearGradient(...flat(0, 0), ...flat(0, LENGTH));
    dome.addColorStop(0, shade(SHELL, -.12)); dome.addColorStop(.55, shade(SHELL, .14)); dome.addColorStop(1, shade(SHELL, -.1));
    g.fillStyle = dome; g.fillRect(-HALF - 4, -200, HALF * 2 + 8, 400);
    ribs(flat, shade(SHELL, -.38));
  });
  const lip = new Path2D(); lip.moveTo(...flat(-HALF, BELLY)); scallops(lip, flat);
  ink(lip, { color: RIM, width: 3 });
};

/** The lid seen from inside, raised: a coral cup in a thick tan rim, shaded deeper toward the lip. */
const paintLidInside = (flat: Flat) => {
  toon(footprint(flat), { fill: SHELL, inkColor: INK, width: 2.4 }, () => {
    const rim = g.createLinearGradient(...flat(0, 0), ...flat(0, LENGTH));
    rim.addColorStop(0, shade(SHELL, -.1)); rim.addColorStop(1, shade(SHELL, .2));
    g.fillStyle = rim; g.fillRect(-HALF - 4, -200, HALF * 2 + 8, 400);
  });
  const cup: Flat = (across, along) => flat(across * .8, 6 + (along - 6) * .8);
  toon(footprint(cup), { fill: FLESH, inkColor: shade(FLESH, -.45), width: 1.8 }, () => {
    const depth = g.createLinearGradient(...flat(0, 0), ...flat(0, LENGTH));
    depth.addColorStop(0, shade(FLESH, .15)); depth.addColorStop(.55, FLESH); depth.addColorStop(1, shade(FLESH, -.4));
    g.fillStyle = depth; g.fillRect(-HALF - 4, -200, HALF * 2 + 8, 400);
    ribs(cup, shade(FLESH, -.28));
  });
};

/** A giant clam facing us, its shell `open` (0 shut .. 1 wide open) over five pearls: one is gone for each 20% of credits used. */
export const paintClam = (pearls: number, open = 1) => {
  paintMouth(pearls);
  paintBowl();
  const flat = lidFlat(open);
  if (SIN_VIEW * Math.cos(open * OPEN_ANGLE) > COS_VIEW * Math.sin(open * OPEN_ANGLE)) paintLidOutside(flat); else paintLidInside(flat);
};
