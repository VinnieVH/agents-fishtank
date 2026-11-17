// What the tank shows about a session's fish: which fish is under the pointer, and how long a waiting one has waited.
import type { Session } from '../shared/types';
import { stateLabel } from './panel';
import type { Fish, Waiting } from './scene/fish';

/** The fish at (x, y), subagents included; the biggest wins, as it's drawn on top. */
export const fishAt = (fishes: Iterable<Fish>, x: number, y: number) => {
  let best: Fish | undefined;
  for (const fish of fishes) if (fish.hit(x, y) && (!best || fish.size > best.size)) best = fish;
  return best;
};

export const hoverTitle = (session: Session | undefined) => session ? `${session.name}: ${stateLabel(session)}` : '';

// The server's time at the last snapshot: this device's own clock may differ from it.
let snapshotTime = 0, snapshotSeen = 0;
export const noteSnapshot = (time: number, t: number) => { snapshotTime = time; snapshotSeen = t; };

/** How a session has waited so far (t: the frame's time); undefined if it doesn't wait. */
export const waitingOf = (session: Session | undefined, t: number): Waiting | undefined =>
  session?.state === 'waiting' ? { kind: session.wait?.kind, ms: snapshotTime + (t - snapshotSeen) - session.lastEvent } : undefined;
