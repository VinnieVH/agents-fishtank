import { hash } from './util';

export type Species = 'tropical' | 'koi' | 'sturgeon' | 'angelfish' | 'puffer';

export interface SpeciesInfo {
  /** half body height incl. fins, in body units */
  half: number;
  /** body scale */
  size: number;
  /** swim speed factor */
  speed: number;
  /** label below / marks above, in body units */
  labelY: number;
  markY: number;
  /** drawing bounds in body units: [left, top, right, bottom], head points right */
  bounds: [number, number, number, number];
}

export const SPECIES: Record<Species, SpeciesInfo> = {
  tropical:  { half: .9,   size: 1,    speed: 1,   labelY: .95, markY: 1.05, bounds: [-1.56, -1.02, 1.06, .86] },
  koi:       { half: .6,   size: 1.15, speed: .9,  labelY: .75, markY: .85,  bounds: [-1.8, -.68, 1.06, .66] },
  sturgeon:  { half: .5,   size: 1.1,  speed: .8,  labelY: .55, markY: .7,   bounds: [-1.84, -.66, 1.34, .44] },
  angelfish: { half: 1.55, size: .8,   speed: .85, labelY: 1.7, markY: 1.75, bounds: [-1.46, -1.6, .92, 1.6] },
  puffer:    { half: .7,   size: 1.25, speed: .7,  labelY: .95, markY: .95,  bounds: [-.98, -.78, .84, .78] },
};
export const ALL_SPECIES = Object.keys(SPECIES) as Species[];

/** The species least represented right now; ties are broken by the session id so the choice is stable. */
export function pickSpecies(sessionId: string, inTank: Iterable<Species>): Species {
  const count = Object.fromEntries(ALL_SPECIES.map(s => [s, 0])) as Record<Species, number>;
  for (const s of inTank) count[s]++;
  const min = Math.min(...Object.values(count));
  const options = ALL_SPECIES.filter(s => count[s] === min);
  return options[hash(sessionId + ':species') % options.length];
}

/** Remembers each session's species (also across reloads) so a fish never changes species. */
export class SpeciesStore {
  private map: Record<string, Species> = {};
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null, private key = 'fishtank.species') {
    try { this.map = JSON.parse(storage?.getItem(key) || '{}') || {}; } catch { this.map = {}; }
  }
  get(sessionId: string, inTank: Iterable<Species>): Species {
    const known = this.map[sessionId];
    if (known && known in SPECIES) return known;
    return this.map[sessionId] = pickSpecies(sessionId, inTank);
  }
  /** Forget sessions that are gone and persist. */
  prune(live: Set<string>) {
    for (const id of Object.keys(this.map)) if (!live.has(id)) delete this.map[id];
    try { this.storage?.setItem(this.key, JSON.stringify(this.map)); } catch { /* storage full or blocked */ }
  }
}
