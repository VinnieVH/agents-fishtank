import { hash } from './util';

export type Species = 'tropical' | 'koi' | 'sturgeon' | 'angelfish' | 'puffer' | 'squid' | 'shrimp' | 'lobster' | 'angler' | 'lionfish' | 'octopus' | 'seahorse';

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
  /** swims with a fin, keeping its body straight (the fin is a layer of its own, see SeparateFin in art/fishLook.ts) */
  stiff?: boolean;
  /** where a hat sits: the middle of the top of the head, in body units */
  crown: [number, number];
}

export const SPECIES: Record<Species, SpeciesInfo> = {
  tropical:  { half: .9,   size: 1,    speed: 1,   labelY: .95, markY: 1.05, bounds: [-1.56, -1.02, 1.06, .86], crown: [.5, -.45] },
  koi:       { half: .6,   size: 1.15, speed: .9,  labelY: .75, markY: .85,  bounds: [-1.8, -.68, 1.06, .66], crown: [.6, -.28] },
  sturgeon:  { half: .5,   size: 1.1,  speed: .8,  labelY: .55, markY: .7,   bounds: [-1.84, -.66, 1.34, .44], crown: [.85, -.2] },
  angelfish: { half: 1.55, size: .8,   speed: .85, labelY: 1.7, markY: 1.75, bounds: [-1.46, -1.6, .92, 1.6], crown: [.4, -.5] },
  puffer:    { half: .7,   size: 1.25, speed: .7,  labelY: .95, markY: .95,  bounds: [-.98, -.78, .84, .78], crown: [.3, -.5] },
  squid:     { half: .55,  size: 1,    speed: 1.1, labelY: .75, markY: .75,  bounds: [-1.8, -.62, 1.16, .62], crown: [.2, -.4] },
  shrimp:    { half: .6,   size: .95,  speed: .9,  labelY: .8,  markY: 1,    bounds: [-1.38, -.94, 1.22, .66], crown: [.6, -.55] },
  lobster:   { half: .65,  size: .85,  speed: .75, labelY: .8,  markY: .9,   bounds: [-1.46, -.8, 1.76, .66], crown: [.9, -.4] },
  angler:    { half: .7,   size: 1.1,  speed: .7,  labelY: .8,  markY: 1.15, bounds: [-1.26, -1.12, 1.42, .72], crown: [.5, -.55] },
  lionfish:  { half: .9,   size: .95,  speed: .75, labelY: 1,   markY: 1.2,  bounds: [-1.42, -1.3, 1, 1], crown: [.45, -.6] },
  octopus:   { half: 1,    size: .85,  speed: .85, labelY: 1.25, markY: 1.05, bounds: [-1.55, -1, 1.55, 1.3], crown: [.1, -.8] },
  seahorse:  { half: 1.15, size: 1.05, speed: .6,  labelY: 1.25, markY: 1.3,  bounds: [-.64, -1.18, .62, 1.18], stiff: true, crown: [.1, -.9] },
};
export const ALL_SPECIES = Object.keys(SPECIES) as Species[];

/** The species least represented right now; ties are broken by the session id so the choice is stable. */
export const pickSpecies = (sessionId: string, inTank: Iterable<Species>): Species => {
  const count = Object.fromEntries(ALL_SPECIES.map(species => [species, 0])) as Record<Species, number>;
  for (const species of inTank) count[species]++;
  const min = Math.min(...Object.values(count));
  const options = ALL_SPECIES.filter(species => count[species] === min);
  return options[hash(sessionId + ':species') % options.length];
};

/** Neon glow colours, far enough apart to tell sessions apart (also in the panel's swatches). All are light enough to read as titles on the water (contrast of 4.1 or more against its lightest part). */
export const NEON = ['#39ff14', '#00f0ff', '#fff200', '#00ffb3', '#b6ff00', '#e8f4ff', '#ffd1f0', '#ffd9a0',
  '#e6d6ff', '#ffd6c4', '#a0ffe0', '#d4f0a0', '#cfe0ff', '#ffd6e8', '#ffeaa0', '#f2f2f2'];

/** A session's species and glow colour. */
export interface Look { species: Species; neon: string }

/**
 * The glow colour least used in the tank, above all among fish of the same species, so two fish that look the same
 * are as rare as possible. Ties are broken by the session id.
 */
export const pickNeon = (sessionId: string, species: Species, inTank: Iterable<Look>): string => {
  const score = new Map(NEON.map(neon => [neon, 0]));
  for (const look of inTank) {
    const current = score.get(look.neon);
    if (current !== undefined) score.set(look.neon, current + (look.species === species ? 100 : 1));
  }
  const min = Math.min(...score.values());
  const options = NEON.filter(neon => score.get(neon) === min);
  return options[hash(sessionId + ':neon') % options.length];
};

/** Remembers each session's look (also across reloads) so a fish never changes species or colour. */
export class SpeciesStore {
  private map: Record<string, Look | Species> = {}; // a bare species was stored before fish got their colour here
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null, private key = 'fishtank.species') {
    try { this.map = JSON.parse(storage?.getItem(key) || '{}') || {}; } catch { this.map = {}; }
  }
  get(sessionId: string, inTank: Look[]): Look {
    const known = this.map[sessionId];
    const kept = typeof known === 'string' ? known : known?.species;
    const species = kept && kept in SPECIES ? kept : pickSpecies(sessionId, inTank.map(look => look.species));
    const neon = typeof known === 'object' && NEON.includes(known.neon) ? known.neon : pickNeon(sessionId, species, inTank);
    return this.map[sessionId] = { species, neon };
  }
  /** A session carries on under a new id, and keeps its look. */
  move(from: string, to: string) {
    if (from in this.map) { this.map[to] = this.map[from]; delete this.map[from]; }
  }
  /** Forget sessions that are gone and persist. */
  prune(live: Set<string>) {
    for (const id of Object.keys(this.map)) if (!live.has(id)) delete this.map[id];
    try { this.storage?.setItem(this.key, JSON.stringify(this.map)); } catch { /* storage full or blocked */ }
  }
}
