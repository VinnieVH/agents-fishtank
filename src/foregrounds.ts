// The foreground is the zone along the bottom of the tank: the reef, the sand and what grows or stands on it. The user
// picks one on the scenery page (src/foregroundPage.ts); it's remembered by the page, like the species in the panel.

export type ForegroundId = 'reef' | 'kelp' | 'ruins';

export interface ForegroundInfo { id: ForegroundId; title: string; description: string }

export const DEFAULT_FOREGROUND: ForegroundId = 'reef';

export const FOREGROUNDS: ForegroundInfo[] = [
  { id: 'reef', title: 'Coral reef', description: 'Live rock crowded with hard and swaying soft corals, and anemones on the sand.' },
  { id: 'kelp', title: 'Kelp forest', description: 'Mossy boulders under tall kelp that sways in the current, with eelgrass and sea urchins.' },
  { id: 'ruins', title: 'Sunken ruins', description: 'A broken temple front, fallen columns and clay amphorae, grown over with moss and sea grass.' },
];

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const isForegroundId = (candidate: unknown): candidate is ForegroundId =>
  FOREGROUNDS.some(foreground => foreground.id === candidate);

/** Which foreground is chosen, kept across reloads; an unknown or missing one is the default. */
export class ForegroundStore {
  private current: ForegroundId;
  constructor(private storage: KeyValueStorage | null, private key = 'fishtank.foreground') {
    this.current = DEFAULT_FOREGROUND;
    try {
      const saved = storage?.getItem(key);
      if (isForegroundId(saved)) this.current = saved;
    } catch { /* storage blocked */ }
  }
  get(): ForegroundId { return this.current; }
  set(id: ForegroundId) {
    this.current = id;
    try { this.storage?.setItem(this.key, id); } catch { /* storage full or blocked */ }
  }
}
