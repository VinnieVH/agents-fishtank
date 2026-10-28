// The live feed the server streams to the page over /events.

export type State = 'working' | 'waiting' | 'idle';
export type Source = 'copilot' | 'claude';

export interface Subagent {
  id: string; name: string; type?: string; description?: string; model?: string;
  status: 'running' | 'done' | 'failed' | 'stopped'; start: number; end?: number;
}

export interface Session { id: string; source: Source; name: string; state: State; lastEvent: number; subagents: Subagent[] }

/** Copilot premium credit snapshot (from the CLI's quotaSnapshots.premium_interactions). Claude Code has plan limits instead (ClaudeLimits). */
export interface Quota {
  entitlement: number; used: number; remainingPct: number; unlimited: boolean;
  overage: number; resetDate: string; at: number;
}

/** One Claude plan usage window, from the status line's rate_limits. */
export interface LimitWindow { usedPct: number; resetsAt: number } // resetsAt in ms since the epoch

/** Claude Pro/Max usage limits; a window is null when Claude Code didn't report it. */
export interface ClaudeLimits { fiveHour: LimitWindow | null; sevenDay: LimitWindow | null; at: number }

export interface Snapshot { time: number; sessions: Session[]; quota?: Quota | null; limits?: ClaudeLimits | null }
