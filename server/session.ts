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

export const titleFrom = (prompt: string) => prompt.replace(/\s+/g, ' ').trim().slice(0, 60);

/** Marks running subagents as stopped, e.g. when their session ends or is aborted. */
export function stopSubagents(s: Tracked, ts: number) {
  for (const a of s.subagents.values()) if (a.status === 'running') { a.status = 'stopped'; a.end = ts; }
}

/** Forgets subagents that finished too long ago to be listed, so long sessions don't pile them up. */
export function forgetOldSubagents(s: Tracked, now: number) {
  for (const [id, a] of s.subagents) if (a.status !== 'running' && now - (a.end || s.lastEvent) > DONE_SUBAGENT_MS) s.subagents.delete(id);
}

/** The page's view of a tracked session, or null once it's been quiet for over an hour. */
export function toSession(id: string, source: Source, s: Tracked, now: number): Session | null {
  if (now - s.lastEvent > RECENT_MS) return null;
  const stale = now - s.lastEvent > STALE_MS;
  const subagents: Subagent[] = [];
  for (const a of s.subagents.values()) {
    const status = a.status === 'running' && stale ? 'stopped' : a.status;
    if (status !== 'running' && now - (a.end || s.lastEvent) > DONE_SUBAGENT_MS) continue;
    subagents.push({ ...a, status });
  }
  const running = subagents.some(a => a.status === 'running');
  let state = s.state;
  if (state === 'idle' && running) state = 'working'; // background subagents still running
  if (state === 'working' && stale) state = 'idle';
  return { id, source, state, name: s.name || s.title || id.slice(0, 8), subagents, lastEvent: s.lastEvent };
}

/** True if a process with this PID exists. */
export function pidAlive(pid: number) {
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM'; }
}
