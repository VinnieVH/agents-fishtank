// The user's preferences, chosen in the tank's settings dialog. The server keeps them (a JSON file in the app's data
// folder) and sends them with every snapshot; the desktop app acts on the ones about notifications and launching.

export type Daylight = 'sun' | 'day' | 'night';
export type Motion = 'auto' | 'full' | 'calm' | 'minimal';

export interface Settings {
  /** Follow the real sun, or keep it always day or always night. */
  daylight: Daylight;
  /** Where the sun is computed for; null guesses it from the timezone. */
  location: { lat: number; lon: number } | null;
  /** A visitor swims past now and then: a whale, a shark, an orca, a manta ray, dolphins, jellyfish, the submarine or the kraken. */
  visitors: boolean;
  /** The crab stays out on the sand, not only when every session is idle. */
  crabAlways: boolean;
  /** How much the scenery moves; auto is full, or calm when the system asks for reduced motion. */
  motion: Motion;
  /** Desktop notifications (the app only), once a session has been waiting or done for `notifyAfter` seconds. */
  notifyWaiting: boolean;
  notifyFinished: boolean;
  notifyAfter: number;
  /** Launching (the app only). */
  openOnSession: boolean;
  quitWhenIdle: boolean;
  openAtLogin: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  daylight: 'sun', location: null, visitors: true, crabAlways: false, motion: 'auto',
  notifyWaiting: true, notifyFinished: false, notifyAfter: 60, openOnSession: true, quitWhenIdle: true, openAtLogin: false,
};

const DAYLIGHT: Daylight[] = ['sun', 'day', 'night'];
const MOTION: Motion[] = ['auto', 'full', 'calm', 'minimal'];
export const NOTIFY_AFTER = [30, 60, 300];
const FLAGS = ['visitors', 'crabAlways', 'notifyWaiting', 'notifyFinished', 'openOnSession', 'quitWhenIdle', 'openAtLogin'] as const;

const isOneOf = <T>(options: readonly T[], candidate: unknown): candidate is T => options.includes(candidate as T);

/** The location in `change`: null to guess it, undefined when it isn't a valid one. */
const validLocation = (change: unknown): Settings['location'] | undefined => {
  if (change === null) return null;
  if (!change || typeof change !== 'object') return undefined;
  const { lat, lon } = change as Record<string, unknown>;
  const isValid = typeof lat === 'number' && typeof lon === 'number' && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  return isValid ? { lat, lon } : undefined;
};

/**
 * `base` with the valid parts of `change` applied: known keys with the right type only, so a stored file from another
 * version or a bad request can't put anything odd in.
 */
export const mergeSettings = (base: Settings, change: unknown): Settings => {
  const next: Settings = { ...base };
  if (!change || typeof change !== 'object') return next;
  const changed = change as Record<string, unknown>;
  const { daylight, motion, notifyAfter } = changed;
  if (isOneOf(DAYLIGHT, daylight)) next.daylight = daylight;
  if (isOneOf(MOTION, motion)) next.motion = motion;
  for (const flag of FLAGS) {
    const isOn = changed[flag];
    if (typeof isOn === 'boolean') next[flag] = isOn;
  }
  if (isOneOf(NOTIFY_AFTER, notifyAfter)) next.notifyAfter = notifyAfter;
  const location = validLocation(changed.location);
  if (location !== undefined) next.location = location;
  return next;
};
