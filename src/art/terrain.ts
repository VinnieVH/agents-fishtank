import { rng } from '../util';
import { paintReefs, paintRidge, reefLayout, sandGaps } from './reef';
import { drawInto, g } from './sceneryPen';
import { canyonMouth, paintCanyon } from './terrainCanyon';
import { paintChest } from './terrainChest';
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
export const FLOOR_REACH = 300;

const landmarks = (width: number) => ({ chest: width * .2 });

/** The stretches of the floor kept free of reefs in front (art/reef.ts), so the chest (the Copilot credits) stays in sight. */
export const keepClear = (width: number): [number, number][] => {
  const { chest } = landmarks(width);
  return [[chest - 52, chest + 74]];
};

/** The reefs in a tank W x H (art/reef.ts): the floor layer paints them, scene/water.ts adds their soft corals. */
export const reefs = (width: number, height: number) => reefLayout(width, height, keepClear(width));

/** The open water at the very back, from light at the top to deep blue, and the canyon far away in it. Behind the current (scene/water.ts). */
export const paintWater = (context: CanvasRenderingContext2D, width: number, height: number) => {
  drawInto(context);
  const water = g.createLinearGradient(0, 0, 0, height);
  water.addColorStop(0, '#0b6a9e'); water.addColorStop(.45, '#06406a'); water.addColorStop(1, '#021a30');
  g.fillStyle = water; g.fillRect(0, 0, width, height);
  paintCanyon(width, height);
};

/** The static backdrop in front of the open water (paintWater) and the current far off: hills, the wreck, sand, gravel, shells and starfish. Painted on resize. */
export const paintTerrain = (context: CanvasRenderingContext2D, width: number, height: number) => {
  drawInto(context);
  const random = rng(1337), tank = { width, height };
  paintHills(tank);
  const sandLine = sandLineFor(height);
  paintDune(tank, sandLine);
  paintFrontSand(tank, sandLine);
  paintRipples(tank, sandLine, random);
  paintPebbles(tank, sandLine);
  paintShellsAndStarfish(tank, sandLine, random);
};

/**
 * The floor's things, in a layer of their own above the soft corals at the back (scene/water.ts) and below the fish:
 * the reefs with their hard corals, and the chest. Painted from FLOOR_REACH above the sand
 * line down, on resize and when the gold level changes.
 */
export const paintFloor = (
  context: CanvasRenderingContext2D, { width, height }: { width: number; height: number }, { gold, gems }: { gold: number; gems: number },
) => {
  drawInto(context);
  const sandLine = sandLineFor(height), marks = landmarks(width), floorReefs = reefs(width, height);
  g.save(); g.translate(0, FLOOR_REACH - sandLine);
  const ground = (x: number) => sandTop(x, sandLine);
  paintRidge(g, { width, sandLine, ground, gaps: sandGaps(width) });
  paintReefs(g, floorReefs, ground);
  paintChest([marks.chest, sandLine + 30], gold, gems); // well forward on the sand, in front of the reef
  g.restore();
};
