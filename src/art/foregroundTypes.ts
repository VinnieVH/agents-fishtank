import type { Coral, SoftKind } from './reefLayout';
import type { Ground } from './reefRock';
import type { Container } from './terrainContainers';

/** What sways in the water (drawn by scene/water.ts): the reef's soft corals, kelp, and the blades of eelgrass and plastic plants. */
export type SwayKind = SoftKind | 'kelp' | 'grass' | 'bulb';
export type Swayer = Coral<SwayKind>;

/** The floor of a tank `width` x `height`, with its sand line and where the sand is at x; what a foreground paints on. */
export interface Setting { width: number; height: number; sandLine: number; ground: Ground }

/** One foreground: what it paints on the floor (still), what sways in front of the back of the water, and if the anemones show. */
export interface ForegroundArt {
  paint: (setting: Setting) => void;
  swayers: (width: number, height: number) => Swayer[];
  hasAnemones: boolean;
  container?: Container;
  occupied?: (width: number) => [number, number][];
}
