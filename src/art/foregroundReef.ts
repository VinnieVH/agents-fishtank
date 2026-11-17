import { keepClear } from './chestSpot';
import type { ForegroundArt } from './foregroundTypes';
import { paintReefs, paintRidge, reefLayout, sandGaps } from './reef';
import { g } from './sceneryPen';

/** The reefs in a tank W x H (art/reef.ts): the floor layer paints them, scene/water.ts adds their soft corals. */
export const reefs = (width: number, height: number) => reefLayout(width, height, keepClear(width));

/** The coral reef: a ridge of live rock and outcrops of it with hard corals, and soft corals swaying behind them. */
export const reefForeground: ForegroundArt = {
  paint: ({ width, height, sandLine, ground }) => {
    paintRidge(g, { width, sandLine, ground, gaps: sandGaps(width) });
    paintReefs(g, reefs(width, height), ground);
  },
  swayers: (width, height) => reefs(width, height).flatMap(reef => reef.soft),
  hasAnemones: true,
};
