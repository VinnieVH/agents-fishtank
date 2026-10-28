// The user's preferences, chosen in the tank's settings dialog. The server keeps them (a JSON file in the app's data
// folder) and sends them with every snapshot; the desktop app acts on the ones about notifications and launching.

export type Daylight = 'sun' | 'day' | 'night';
export type Motion = 'auto' | 'full' | 'calm' | 'minimal';

export interface Settings {
  /** Follow the real sun, or keep it always day or always night. */
  daylight: Daylight;
  /** Where the sun is computed for; null guesses it from the timezone. */
  location: { lat: number; lon: number } | null;
  /** A whale or a shark swims past now and then. */
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

/**
 * `base` with the valid parts of `change` applied: known keys with the right type only, so a stored file from another
 * version or a bad request can't put anything odd in.
 */
export function mergeSettings(base: Settings, change: unknown): Settings {
  const next: Settings = { ...base };
  if (!change || typeof change !== 'object') return next;
  const c = change as Record<string, unknown>;
  if (DAYLIGHT.includes(c.daylight as Daylight)) next.daylight = c.daylight as Daylight;
  if (MOTION.includes(c.motion as Motion)) next.motion = c.motion as Motion;
  for (const k of FLAGS) if (typeof c[k] === 'boolean') next[k] = c[k];
  if (NOTIFY_AFTER.includes(c.notifyAfter as number)) next.notifyAfter = c.notifyAfter as number;
  if (c.location === null) next.location = null;
  else if (c.location && typeof c.location === 'object') {
    const { lat, lon } = c.location as Record<string, unknown>;
    if (typeof lat === 'number' && typeof lon === 'number' && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) next.location = { lat, lon };
  }
  return next;
}
