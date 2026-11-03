import { rng, shade } from '../util';
import { g, ink } from './sceneryPen';
import type { Point } from './sceneryPen';
import { wavyEdge } from './terrainSand';
import type { Tank } from './terrainSand';
import { paintShipwreck } from './terrainWreck';

/** A distant hill: its colour, how high its middle is (share of the tank's height), how much it swells, and where its waves start. */
interface Hill { color: string; base: number; swell: number; phase: number }
const HILLS: Hill[] = [
  { color: '#08385c', base: .62, swell: 70, phase: 0 },
  { color: '#0a2f4c', base: .7, swell: 55, phase: 2 },
  { color: '#0b2a40', base: .77, swell: 40, phase: 5 },
];
const WRECK_HILL = 1;

/** A far-off outcrop of rock, a hazy silhouette standing w wide and h tall on (x, y), with a faint lit rim along its top. */
const paintFarRock = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }, color: string, random: () => number) => {
  const ridge = new Path2D(), count = 7, points: Point[] = [];
  for (let index = 0; index <= count; index++) {
    const t = index / count, bump = .75 + random() * .5, peak = Math.pow(Math.sin(Math.PI * t), .6);
    points.push([x - w / 2 + t * w, y - h * peak * (index === 0 || index === count ? 0 : bump)]);
  }
  ridge.moveTo(...points[0]);
  for (let index = 1; index < points.length - 1; index++) {
    ridge.quadraticCurveTo(...points[index], (points[index][0] + points[index + 1][0]) / 2, (points[index][1] + points[index + 1][1]) / 2);
  }
  ridge.lineTo(...points[count]);
  const body = new Path2D(ridge); body.lineTo(x + w / 2, y + 40); body.lineTo(x - w / 2, y + 40); body.closePath();
  g.fillStyle = shade(color, .06); g.fill(body);
  ink(ridge, { color: shade(color, .2), width: 2, alpha: .4 });
};

const paintHill = (hill: Hill, layer: number, tank: Tank) => {
  const { color, base, swell, phase } = hill;
  const top = (x: number) => tank.height * base - Math.sin(x / 210 + phase) * swell - Math.sin(x / 77 + phase * 2) * swell * .35;
  // rocky outcrops, at their own spots along the floor so they stay put on a resize; smaller further away
  for (let spot = 0; spot * 300 < tank.width + 300; spot++) {
    const random = rng(7700 + layer * 100 + spot);
    if (random() < .35) continue;
    const x = spot * 300 + random() * 200, w = (40 + random() * 70) * (.7 + layer * .15), h = (22 + random() * 50) * (.7 + layer * .15);
    paintFarRock({ x, y: top(x) + 14, w, h }, color, random);
  }
  if (layer === WRECK_HILL) {
    paintShipwreck({ centerX: tank.width * .7, top, scale: Math.min(1, Math.max(.6, tank.width / 1800)), color: shade(color, .1), rim: shade(color, .32) });
  }
  const edge = wavyEdge(tank, 20, top);
  g.fillStyle = color; g.fill(edge.fill);
  ink(edge.top, { color: shade(color, .18), width: 2.5, alpha: .35 });
};

/**
 * Distant hills (3 flat layers with a soft lit crest), with rocks rising out of each and, far off, a shipwreck.
 * Each hill is filled after what stands on it, so its own slope hides their feet.
 */
export const paintHills = (tank: Tank) => {
  HILLS.forEach((hill, layer) => paintHill(hill, layer, tank));
};
