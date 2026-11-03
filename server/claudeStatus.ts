// What Claude Code says about a running session outside its hooks: the file it keeps per session process
// (<config>/sessions/<pid>.json) and the status line updates it sends.
import fs from 'node:fs';
import path from 'node:path';
import type { ClaudeLimits, LimitWindow, State } from '../shared/types.ts';
import { isRecord, parseJson, pidAlive } from './session.ts';

/** A running session's state right now, and the name the user gave it with /rename. */
export interface LiveStatus { state: State; name: string }

/** A running session's file, <config>/sessions/<pid>.json. Undocumented, so every field is optional. */
export interface RunningSession {
  sessionId?: string; status?: string; name?: string; nameSource?: string; statusUpdatedAt?: number;
  kind?: string;   // interactive, bg, daemon, daemon-worker
  spare?: boolean; // a session process started in advance, waiting for your next session
}

/** Spare session processes and Claude Code's daemons register too, but aren't sessions anyone is using. */
export const isRealSession = (running: RunningSession) => running.spare !== true && running.kind !== 'daemon' && running.kind !== 'daemon-worker';

// Each field is checked where it's used.
const isSessionFile = (candidate: unknown): candidate is RunningSession => isRecord(candidate);

const LIVE_STATE: Record<string, State> = { busy: 'working', waiting: 'waiting', idle: 'idle' };

/** The session's state and user-given name from its file, or undefined if the file says something we don't know. */
export const liveFrom = (running: RunningSession): LiveStatus | undefined => {
  const state = LIVE_STATE[running.status ?? ''];
  if (!state) return undefined;
  return { state, name: running.nameSource && running.nameSource !== 'derived' && running.name ? running.name : '' };
};

const field = (source: unknown, key: string): unknown => isRecord(source) ? source[key] : undefined;

const limitWindowFrom = (window: unknown): LimitWindow | null => {
  const usedPct = field(window, 'used_percentage'), resetsAt = field(window, 'resets_at');
  return typeof usedPct === 'number' && typeof resetsAt === 'number' ? { usedPct, resetsAt: resetsAt * 1000 } : null;
};

/** Plan usage from a status line update (https://code.claude.com/docs/en/statusline), or null if it has none. */
export const limitsFrom = (statusLine: string, at: number): ClaudeLimits | null => {
  const rateLimits = field(parseJson(statusLine), 'rate_limits');
  const fiveHour = limitWindowFrom(field(rateLimits, 'five_hour')), sevenDay = limitWindowFrom(field(rateLimits, 'seven_day'));
  return fiveHour || sevenDay ? { fiveHour, sevenDay, at } : null;
};

/** The running sessions' files that are real sessions, with their process ids. */
export const readRunningSessions = (folder: string) => {
  let files: string[] = [];
  try { files = fs.readdirSync(folder).filter(file => /^\d+\.json$/.test(file)); } catch { /* none running, or an older Claude Code */ }
  return files.map(file => Number(file.slice(0, -5))).filter(pidAlive).flatMap(pid => {
    let running: unknown;
    try { running = JSON.parse(fs.readFileSync(path.join(folder, pid + '.json'), 'utf8')); } catch { return []; }
    return isSessionFile(running) && isRealSession(running) ? [{ pid, running }] : [];
  });
};
