import type { ClaudeLimits, LimitWindow } from '../shared/types';

/** One air tank: Claude plan usage shown as the air left in it. */
export interface Air {
  left: number;     // 0..100 % of the window left
  warn: boolean;    // under 25% left
  low: boolean;     // under 10% left: the tank leaks bubbles
  refill: string;   // when the window resets, e.g. "16:40" or "Mon 2 Nov"; empty if unknown
}

export interface Tanks { fiveHour: Air | null; week: Air | null }

/** The 5-hour and weekly air tanks, or null when Claude Code hasn't reported any usage. */
export function airTanks(l: ClaudeLimits | null | undefined, now: number): Tanks | null {
  if (!l || (!l.fiveHour && !l.sevenDay)) return null;
  return { fiveHour: air(l.fiveHour, now), week: air(l.sevenDay, now) };
}

function air(w: LimitWindow | null, now: number): Air | null {
  if (!w) return null;
  // a window whose reset time has passed is full again, even before Claude Code reports the new one
  const expired = w.resetsAt <= now;
  const left = expired ? 100 : Math.max(0, Math.min(100, 100 - w.usedPct));
  return { left, warn: left < 25, low: left < 10, refill: expired ? '' : refillLabel(new Date(w.resetsAt), now) };
}

/** The time if it's within the next day, else the day, e.g. "Mon 2 Nov" (in English, like the rest of the page). */
export function refillLabel(d: Date, now: number): string {
  return +d - now < 20 * 60 * 60 * 1000
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
