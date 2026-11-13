import type { SeasonId } from '../seasons';
import { g, setPenScale } from './sceneryPen';
import { snowySnowman, snowyTree } from './propsXmas';
import { sandTop } from './terrainSand';

interface Placement { at: number; prop: (index: number) => void; index?: number; scale?: number }

const place = (prop: Placement['prop'], at: number, ...rest: [index?: number, scale?: number]): Placement => ({ prop, at, index: rest[0] ?? 0, scale: rest[1] ?? 1 });

/** What stands on the sand in each season, left to right as a share of the tank's width; things are drawn in this order. */
const SCENES: Partial<Record<SeasonId, Placement[]>> = {
  winter: [place(snowySnowman, .36, 0, 2), place(snowyTree, .7, 0, 3.2)],
};

/** The season's things on the sand, in front of the reefs; `clear` are stretches of x to leave free (the chest). */
export const paintSeasonFloor = (
  { width, sandLine }: { width: number; sandLine: number }, season: SeasonId, clear: [number, number][],
) => {
  const fit = Math.min(1, sandLine / 650); // smaller tanks get smaller props, so the big ones still fit
  for (const { at, prop, index = 0, scale = 1 } of SCENES[season] ?? []) {
    const x = at * width;
    if (clear.some(([from, to]) => x > from && x < to)) continue;
    g.save(); g.translate(x, sandTop(x, sandLine) + 14); g.scale(scale * fit, scale * fit); setPenScale(scale * fit); prop(index); setPenScale(1); g.restore();
  }
};
