// Claude Code: its hooks POST every event to /hook/claude (added to ~/.claude/settings.json when the app connects).
// The transcript format is internal to Claude Code, so we rely on the documented hook payloads, refined by the small
// file Claude Code keeps per running session (<config>/sessions/<pid>.json), which says the moment a session goes
// busy, idle or waiting, also on an interrupt or a denied permission, which fire no hook.
import fs from 'node:fs';
import path from 'node:path';
import type { ClaudeLimits, LimitWindow, Session, State } from '../shared/types.ts';
import { LogTail } from './logtail.ts';
import { RECENT_MS, STALE_MS, forgetOldSubagents, newTracked, pidAlive, stopSubagents, titleFrom, toSession, type Tracked } from './session.ts';

/** The hook input fields we use (https://code.claude.com/docs/en/hooks). */
export interface HookEvent {
  hook_event_name: string;
  session_id: string;
  agent_id?: string;          // set when the event comes from inside a subagent
  agent_type?: string;
  tool_name?: string;
  tool_input?: { subagent_type?: string; description?: string; model?: string };
  notification_type?: string;
  prompt?: string;
  session_title?: string;
  transcript_path?: string;
}

export interface ClaudeSession extends Tracked {
  ended: boolean;
  /** From the running session's file: its state right now, and the name the user gave it with /rename. */
  live?: { state: State; name: string };
  /** The session's titles from its transcript: the one Claude Code generated, and one the user set. */
  titles: { ai: string; custom: string };
  transcript?: LogTail;
  /** Agent tool calls waiting for their SubagentStart, to give the subagent its description and model. */
  launching: { type: string; description: string; model: string }[];
}

export const newClaudeSession = (): ClaudeSession => ({ ...newTracked(), ended: false, launching: [], titles: { ai: '', custom: '' } });

// Claude Code repeats its title records through the transcript, so the end of a long one has them too.
const TRANSCRIPT_FIRST_READ = 4 * 1024 * 1024;

/**
 * Picks the session's titles out of transcript lines. The transcript format is internal to Claude Code, so this is
 * best effort: if it changes, the fish keeps the start of the first prompt as its name.
 */
export function noteTitles(s: ClaudeSession, lines: string[]) {
  for (const line of lines) {
    if (!line.includes('-title"')) continue; // cheap check: titles are a handful of lines among many
    try {
      const e = JSON.parse(line);
      if (e.type === 'ai-title' && typeof e.aiTitle === 'string') s.titles.ai = e.aiTitle;
      else if (e.type === 'custom-title' && typeof e.customTitle === 'string') s.titles.custom = e.customTitle;
    } catch { /* partial or other line */ }
  }
}

/** What the fish is called: a name the user gave it, Claude Code's title, else the start of the first prompt. */
export function nameOf(s: ClaudeSession) {
  return s.live?.name || s.titles.custom || s.titles.ai || s.name || s.title;
}

// Tools that stop and wait for the user's answer, like Copilot's ask_user.
const ASKS_USER = new Set(['AskUserQuestion', 'ExitPlanMode']);
const AGENT_TOOLS = new Set(['Agent', 'Task']);
const NEEDS_USER = new Set(['permission_prompt', 'elicitation_dialog', 'agent_needs_input']);

export function applyHook(s: ClaudeSession, ev: HookEvent, ts: number) {
  s.lastEvent = Math.max(s.lastEvent, ts);
  if (ev.transcript_path && !ev.agent_id && s.transcript?.file !== ev.transcript_path) s.transcript = new LogTail(ev.transcript_path, TRANSCRIPT_FIRST_READ);
  // Tool calls inside a subagent shouldn't change what the main session is doing.
  const main = !ev.agent_id;
  switch (ev.hook_event_name) {
    case 'SessionStart':
      s.ended = false;
      if (ev.session_title) s.name = ev.session_title;
      break;
    case 'UserPromptSubmit':
      s.state = 'working';
      if (!s.title && ev.prompt) s.title = titleFrom(ev.prompt);
      break;
    case 'PreToolUse':
      // subagents can start subagents too, so their Agent calls count as well
      if (AGENT_TOOLS.has(ev.tool_name ?? '')) {
        const i = ev.tool_input ?? {};
        s.launching.push({ type: i.subagent_type || 'general-purpose', description: i.description || '', model: i.model || '' });
      }
      if (main) s.state = ASKS_USER.has(ev.tool_name ?? '') ? 'waiting' : 'working';
      break;
    case 'PermissionRequest':
      s.state = 'waiting'; // also from a subagent: either way the user has to answer
      break;
    case 'PostToolUse': case 'PostToolUseFailure': case 'PermissionDenied':
      if (main) s.state = 'working';
      break;
    case 'Notification':
      if (NEEDS_USER.has(ev.notification_type ?? '')) s.state = 'waiting';
      else if (ev.notification_type === 'idle_prompt') s.state = 'idle';
      break;
    case 'Stop': case 'StopFailure':
      if (main) s.state = 'idle';
      break;
    case 'SubagentStart': {
      const id = ev.agent_id ?? '', type = ev.agent_type || 'subagent';
      const i = s.launching.findIndex(l => l.type === type);
      const l = i >= 0 ? s.launching.splice(i, 1)[0] : undefined;
      s.subagents.set(id, { id, name: type, type, description: l?.description ?? '', model: l?.model ?? '', status: 'running', start: ts, end: 0 });
      break;
    }
    case 'SubagentStop': {
      const a = s.subagents.get(ev.agent_id ?? '');
      if (a) { a.status = 'done'; a.end = ts; }
      break;
    }
    case 'SessionEnd':
      s.state = 'idle'; s.ended = true; s.launching = [];
      stopSubagents(s, ts);
      break;
  }
}

/** Parses a hook POST body; null if it isn't a hook event. */
export function parseHook(body: string): HookEvent | null {
  try {
    const ev = JSON.parse(body);
    return ev && typeof ev.hook_event_name === 'string' && typeof ev.session_id === 'string' && ev.session_id ? ev : null;
  } catch { return null; }
}

/** A running session's file, <config>/sessions/<pid>.json. Undocumented, so every field is optional. */
interface RunningSession { sessionId?: string; status?: string; name?: string; nameSource?: string; statusUpdatedAt?: number }

const LIVE_STATE: Record<string, State> = { busy: 'working', waiting: 'waiting', idle: 'idle' };

/** The session's state and user-given name from its file, or undefined if the file says something we don't know. */
export function liveFrom(r: RunningSession): ClaudeSession['live'] {
  const state = LIVE_STATE[r.status ?? ''];
  if (!state) return undefined;
  return { state, name: r.nameSource && r.nameSource !== 'derived' && r.name ? r.name : '' };
}

/** Plan usage from a status line update (https://code.claude.com/docs/en/statusline), or null if it has none. */
interface RawWindow { used_percentage?: unknown; resets_at?: unknown }

export function limitsFrom(statusLine: string, at: number): ClaudeLimits | null {
  let input: { rate_limits?: { five_hour?: RawWindow; seven_day?: RawWindow } } | null;
  try { input = JSON.parse(statusLine); } catch { return null; }
  const window = (w: RawWindow | undefined): LimitWindow | null =>
    typeof w?.used_percentage === 'number' && typeof w.resets_at === 'number' ? { usedPct: w.used_percentage, resetsAt: w.resets_at * 1000 } : null;
  const fiveHour = window(input?.rate_limits?.five_hour), sevenDay = window(input?.rate_limits?.seven_day);
  return fiveHour || sevenDay ? { fiveHour, sevenDay, at } : null;
}

export class Claude {
  readonly configDir: string;
  private sessions = new Map<string, ClaudeSession>();
  /** PIDs of the running sessions, from the last poll. */
  private pids: number[] = [];
  /** When we last looked for a session's transcript, for sessions no hook has told us about yet. */
  private searched = new Map<string, number>();

  constructor(configDir: string) { this.configDir = configDir; }

  private session(id: string) {
    let s = this.sessions.get(id);
    if (!s) this.sessions.set(id, s = newClaudeSession());
    return s;
  }

  handle(ev: HookEvent, ts = Date.now()) { applyHook(this.session(ev.session_id), ev, ts); }

  /** Reads the running sessions' files. Sessions show up from these alone, also before their first hook arrives. */
  poll() {
    const dir = path.join(this.configDir, 'sessions');
    let files: string[] = [];
    try { files = fs.readdirSync(dir).filter(f => /^\d+\.json$/.test(f)); } catch { /* none running, or an older Claude Code */ }
    this.pids = files.map(f => Number(f.slice(0, -5))).filter(pidAlive);
    const live = new Set<string>();
    for (const pid of this.pids) {
      let r: RunningSession;
      try { r = JSON.parse(fs.readFileSync(path.join(dir, pid + '.json'), 'utf8')); } catch { continue; }
      if (typeof r?.sessionId !== 'string' || !r.sessionId) continue;
      const s = this.session(r.sessionId);
      s.live = liveFrom(r);
      if (typeof r.statusUpdatedAt === 'number') s.lastEvent = Math.max(s.lastEvent, r.statusUpdatedAt);
      live.add(r.sessionId);
    }
    for (const [id, s] of this.sessions) {
      if (!live.has(id)) s.live = undefined;
      if (!s.transcript) this.findTranscript(id, s);
      const update = s.transcript?.read();
      if (update) noteTitles(s, update.lines);
    }
  }

  /** <config>/projects/<project>/<session id>.jsonl; looked up at most every 10 s until found. */
  private findTranscript(id: string, s: ClaudeSession) {
    const now = Date.now();
    if (now - (this.searched.get(id) ?? 0) < 10_000) return;
    this.searched.set(id, now);
    const projects = path.join(this.configDir, 'projects');
    let dirs: string[] = [];
    try { dirs = fs.readdirSync(projects); } catch { return; }
    const file = dirs.map(d => path.join(projects, d, id + '.jsonl')).find(f => fs.existsSync(f));
    if (file) { s.transcript = new LogTail(file, TRANSCRIPT_FIRST_READ); this.searched.delete(id); }
  }

  list(now: number): Session[] {
    const out: Session[] = [];
    for (const [id, s] of this.sessions) {
      if (!s.live && now - s.lastEvent > RECENT_MS) { this.sessions.delete(id); this.searched.delete(id); continue; }
      forgetOldSubagents(s, now);
      const shown = { ...s, state: s.live?.state ?? s.state, name: nameOf(s) };
      const session = toSession(id, 'claude', shown, now);
      if (session) out.push(session);
    }
    return out;
  }

  /** True while any Claude Code session is running (as of the last poll), or one that hasn't ended was recently active. */
  running(now = Date.now()) {
    return this.pids.length > 0 || [...this.sessions.values()].some(s => !s.ended && now - s.lastEvent < STALE_MS);
  }
}
