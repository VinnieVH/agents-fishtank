// The live feed the server streams to the page over /events.
import type { Settings } from './settings.ts';

export type State = 'working' | 'waiting' | 'idle';
export type Source = 'copilot' | 'claude';

export interface Subagent {
  id: string; name: string; type?: string; description?: string; model?: string;
  status: 'running' | 'done' | 'failed' | 'stopped'; start: number; end?: number;
}

export interface Session {
  id: string; source: Source; name: string; state: State; lastEvent: number; subagents: Subagent[];
  /** Opens the session where it runs, e.g. a Claude Code session in the Claude desktop app; clicking its fish follows it. */
  link?: string;
  /** Clicking its fish brings the terminal it runs in to the front, or resumes it in a new one (POST /open). */
  terminal?: boolean;
  /** The session this one carries on in the same process, e.g. the one before a /clear: its fish becomes this one's. */
  was?: string;
}

/** Copilot premium credit snapshot (from the CLI's quotaSnapshots.premium_interactions). Claude Code has plan limits instead (ClaudeLimits). */
export interface Quota {
  entitlement: number; used: number; remainingPct: number; unlimited: boolean;
  overage: number; resetDate: string; at: number;
}

/** One Claude plan usage window, from the status line's rate_limits. */
export interface LimitWindow { usedPct: number; resetsAt: number } // resetsAt in ms since the epoch

/** Claude Pro/Max usage limits; a window is null when Claude Code didn't report it. */
export interface ClaudeLimits { fiveHour: LimitWindow | null; sevenDay: LimitWindow | null; at: number }

/**
 * The tank shared on the local network: the addresses to open on another device (with the key in them), the code a
 * device that opens the address without it can pair with, or why sharing couldn't start.
 */
export interface Share { urls: string[]; pairingCode?: string; error?: string }

export interface Snapshot {
  time: number; sessions: Session[]; quota?: Quota | null; limits?: ClaudeLimits | null;
  settings?: Settings;
  /** Shown in the desktop app, which offers the notification and launch settings. */
  desktop?: boolean;
  /** While sharing is on; only sent to this computer's own page. */
  share?: Share | null;
  /** Watched from another device over the shared address: it can only look. */
  viewer?: boolean;
}
