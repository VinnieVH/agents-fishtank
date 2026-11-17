import { g, ink } from './sceneryPen';
import type { Point } from './sceneryPen';
import { paintClam } from './terrainClam';
import { paintChest } from './terrainChest';
import { paintCoffer } from './terrainCoffer';

/** What holds the treasure: the reef's wooden chest, a giant clam of pearls in the kelp forest, a Roman coffer of scrolls in the ruins. */
export type Container = 'chest' | 'clam' | 'coffer';

/** A drift of sand (or snow) over the foot of the container, so it stands in the sand and not on it. */
const paintDrift = (width: number, snow: boolean, heap = 6) => {
  const edge = new Path2D();
  edge.moveTo(-width, 6); edge.quadraticCurveTo(-width * .62, -heap - 2, 0, -heap + 2); edge.quadraticCurveTo(width * .62, -heap - 2, width, 6);
  const drift = new Path2D(edge); drift.closePath();
  g.fillStyle = snow ? '#eef5fc' : '#e8cd96'; g.fill(drift);
  ink(edge, { color: snow ? '#5f7fa3' : '#7a5726', width: 2 });
};

/** The container standing at `at`: the chest shows the gold (0..1) and gems; the clam and the coffer only count the 5 pearls or scrolls left. */
export const paintContainer = (container: Container, [x, y]: Point, ...fill: [gold: number, gems: number, snow: boolean, open?: number]) => {
  const [gold, gems, snow, open] = fill;
  if (container === 'chest') { paintChest([x, y], gold, gems, snow); return; }
  g.save(); g.translate(x, y);
  if (container === 'clam') { paintClam(gems, open); paintDrift(58, snow, 8); } else paintCoffer(gems, snow);
  g.restore();
};