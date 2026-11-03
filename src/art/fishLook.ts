import type { Species } from '../species';

/** Everything that decides how a fish looks (derived from its session). */
export interface FishLook {
  species: Species;
  body: string;
  neon: string;
  pattern: number;
  variant: number;
  small: boolean;
  spots: { x: number; y: number; rx: number; ry: number; rot: number }[];
}

/** How far the tail swings, how far the fins sway, and the fin flutter's phase. */
export interface Pose {
  wag: number;
  sway: number;
  phase: number;
}

export type Painter = (look: FishLook, size: number, pose: Pose) => void;

/**
 * A fin on a layer of its own, for creatures that swim with a fin instead of bending their body (`stiff` in
 * SPECIES): where the fin joins the body, the box it's drawn in around that point, and how to paint it.
 */
export interface SeparateFin {
  root: [number, number];
  box: [number, number, number, number];
  paint: Painter;
  outline: (size: number) => void;
}

export interface Creature {
  paint: Painter;
  /** the paths the neon halo traces */
  outline: (size: number) => (() => void)[];
  fin?: SeparateFin;
}
