import { rng } from '../util';
import { DEFAULT_FOREGROUND, type ForegroundId } from '../foregrounds';
import { Season, type SeasonId } from '../seasons';
import { chestSpot, keepClear } from './chestSpot';
import { FOREGROUND_ART } from './foreground';
import { setSnowy } from './reefRock';
import { drawInto, g } from './sceneryPen';
import { paintSeasonFloor } from './seasonFloor';
import { canyonMouth, paintCanyon } from './terrainCanyon';
import { paintContainer } from './terrainContainers';
import { paintHills } from './terrainHills';
import { paintDune, paintFrontSand, paintPebbles, paintRipples, paintShellsAndStarfish, sandTop } from './terrainSand';

export const sandLineFor = (height: number) => height - 70;

/**
 * The ocean current far off (drawn by scene/water.ts): its middle at `distance` (0 near, 1 far away) and how wide it
 * is there. It comes in wide from the left, high in the water, and slaloms off into the distance, its turns dying out
 * as it heads into the canyon's mouth, where it fades away.
 */
export const currentAt = (distance: number, width: number, height: number) => {
  const mouth = canyonMouth(width, height), progress = 1 - Math.pow(1 - distance, 1.6);
  return {
    x: -.05 * width + (mouth.x + .05 * width) * progress + Math.sin(distance * Math.PI * 2.4) * width * .14 * Math.pow(1 - distance, 1.2),
    y: .18 * height + (mouth.y - .18 * height) * progress,
    w: 6 + 110 * Math.pow(1 - distance, 1.5),
  };
};

/** How far above the sand line the floor's things reach: paintFloor paints from there down. */
export const FLOOR_REACH = 520;

export { keepClear } from './chestSpot';
export { reefs } from './foregroundReef';

/** The open water at the very back, from light at the top to deep blue, and the canyon far away in it. Behind the current (scene/water.ts). */
export const paintWater = (context: CanvasRenderingContext2D, width: number, height: number) => {
  drawInto(context);
  const water = g.createLinearGradient(0, 0, 0, height);
  water.addColorStop(0, '#0b6a9e'); water.addColorStop(.45, '#06406a'); water.addColorStop(1, '#021a30');
  g.fillStyle = water; g.fillRect(0, 0, width, height);
  paintCanyon(width, height);
};

/** The static backdrop in front of the open water (paintWater) and the current far off: hills, the wreck, sand, gravel, shells and starfish. Painted on resize. */
export const paintTerrain = (context: CanvasRenderingContext2D, { width, height, season = null, foreground = DEFAULT_FOREGROUND }: { width: number; height: number; season?: SeasonId | null; foreground?: ForegroundId }) => {
  drawInto(context);
  const random = rng(1337), tank = { width, height };
  paintHills(tank);
  const sandLine = sandLineFor(height);
  paintDune(tank, sandLine, season === Season.Winter);
  paintFrontSand(tank, sandLine, season === Season.Winter);
  const spots = [...keepClear(width), ...(FOREGROUND_ART[foreground].occupied?.(width) ?? [])], taken = (x: number) => spots.some(([from, to]) => x > from - 34 && x < to + 34);
  if (season !== Season.Winter) paintRipples(tank, sandLine, random, taken);
  if (season) return; // a season brings its own things for the sand
  paintPebbles(tank, sandLine, taken);
  paintShellsAndStarfish(tank, sandLine, random, taken);
};

/** Where the chest (or the clam, or the coffer) stands: well forward on the sand, in front of the rest. */
export const containerSpot = (width: number, sandLine: number): [number, number] => [chestSpot(width), sandLine + 30];

/** The room the container's own layer has around its spot: left of it, above it, and the spot's offset inside the layer. */
export const CONTAINER_BOX = { w: 260, h: 230, x: 130, y: 195 };

/** The container alone, in a small layer of its own so the clam can be animated without repainting the whole floor. */
export const paintContainerLayer = (context: CanvasRenderingContext2D, fill: { gold: number; gems: number; season?: SeasonId | null; foreground?: ForegroundId; open?: number }) => {
  const { gold, gems, season = null, foreground = DEFAULT_FOREGROUND, open } = fill, winter = season === Season.Winter;
  drawInto(context); setSnowy(winter);
  paintContainer(FOREGROUND_ART[foreground].container ?? 'chest', [CONTAINER_BOX.x, CONTAINER_BOX.y], gold, gems, winter, open);
};

/**
 * The floor's things, in a layer of their own above the soft corals at the back (scene/water.ts) and below the fish:
 * the chosen foreground (the reef, the kelp forest, the sunken ruins) and the chest. Painted from FLOOR_REACH above
 * the sand line down, on resize, when the gold level changes and when another foreground is chosen.
 */
export const paintFloor = (
  context: CanvasRenderingContext2D, { width, height }: { width: number; height: number },
  { gold, gems, season = null, foreground = DEFAULT_FOREGROUND, withContainer = true }: { gold: number; gems: number; season?: SeasonId | null; foreground?: ForegroundId; withContainer?: boolean },
) => {
  drawInto(context);
  const sandLine = sandLineFor(height);
  g.save(); g.translate(0, FLOOR_REACH - sandLine);
  setSnowy(season === Season.Winter);
  FOREGROUND_ART[foreground].paint({ width, height, sandLine, ground: x => sandTop(x, sandLine) });
  if (withContainer) paintContainer(FOREGROUND_ART[foreground].container ?? 'chest', containerSpot(width, sandLine), gold, gems, season === Season.Winter);
  if (season) paintSeasonFloor({ width, sandLine }, season, keepClear(width));
  g.restore();
};
