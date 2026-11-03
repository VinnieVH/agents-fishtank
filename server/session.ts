// What both providers track per session, and how it turns into what the page sees.
import type { Session, Source, State, Subagent } from '../shared/types.ts';

export const RECENT_MS = 60 * 60 * 1000;        // show sessions active in the last hour
export const STALE_MS = 15 * 60 * 1000;         // "working" with no events for this long -> idle
const DONE_SUBAGENT_MS = 10 * 60 * 1000;        // keep finished subagents in the list this long

export interface Tracked {
  state: State;
  lastEvent: number;
  subagents: Map<string, Subagent>;
  name: string;   // set by the user (/rename) or the CLI
  title: string;  // fallback: the start of the first prompt
}

export const newTracked = (): Tracked => ({ state: 'idle', lastEvent: 0, subagents: new Map(), name: '', title: '' });

export const isRecord = (candidate: unknown): candidate is Record<string, unknown> => typeof candidate === 'object' && candidate !== null;

export const parseJson = (line: string): unknown => {
  try { return JSON.parse(line); } catch { return undefined; }
};

export const titleFrom = (prompt: string) => prompt.replace(/\s+/g, ' ').trim().slice(0, 60);

/** Marks running subagents as stopped, e.g. when their session ends or is aborted. */
export const stopSubagents = (tracked: Tracked, time: number) => {
  for (const subagent of tracked.subagents.values()) {
    if (subagent.status === 'running') { subagent.status = 'stopped'; subagent.end = time; }
  }
};

const isLongDone = (subagent: Subagent, lastEvent: number, now: number) =>
  subagent.status !== 'running' && now - (subagent.end || lastEvent) > DONE_SUBAGENT_MS;

/** Forgets subagents that finished too long ago to be listed, so long sessions don't pile them up. */
export const forgetOldSubagents = (tracked: Tracked, now: number) => {
  for (const [id, subagent] of tracked.subagents) if (isLongDone(subagent, tracked.lastEvent, now)) tracked.subagents.delete(id);
};

const listedSubagents = (tracked: Tracked, isStale: boolean, now: number) => {
  const subagents: Subagent[] = [];
  for (const subagent of tracked.subagents.values()) {
    const status = subagent.status === 'running' && isStale ? 'stopped' : subagent.status;
    const listed = { ...subagent, status };
    if (!isLongDone(listed, tracked.lastEvent, now)) subagents.push(listed);
  }
  return subagents;
};

const shownState = (state: State, hasRunningSubagent: boolean, isStale: boolean): State => {
  if (state === 'idle' && hasRunningSubagent) return 'working'; // background subagents still running
  if (state === 'working' && isStale) return 'idle';
  return state;
};

export interface SessionSource { id: string; source: Source; tracked: Tracked; now: number }

/** The page's view of a tracked session, or null once it's been quiet for over an hour. */
export const toSession = ({ id, source, tracked, now }: SessionSource): Session | null => {
  if (now - tracked.lastEvent > RECENT_MS) return null;
  const isStale = now - tracked.lastEvent > STALE_MS;
  const subagents = listedSubagents(tracked, isStale, now);
  const hasRunningSubagent = subagents.some(subagent => subagent.status === 'running');
  const state = shownState(tracked.state, hasRunningSubagent, isStale);
  return { id, source, state, name: tracked.name || tracked.title || id.slice(0, 8), subagents, lastEvent: tracked.lastEvent };
};

/** True if a process with this PID exists. */
export const pidAlive = (pid: number) => {
  try { process.kill(pid, 0); return true; } catch (error) { return error instanceof Error && 'code' in error && error.code === 'EPERM'; }
};
