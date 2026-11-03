// Claude Code: its hooks POST every event to /hook/claude (added to ~/.claude/settings.json when the app connects).
// The transcript format is internal to Claude Code, so we rely on the documented hook payloads, refined by the small
// file Claude Code keeps per running session (<config>/sessions/<pid>.json), which says the moment a session goes
// busy, idle or waiting, also on an interrupt or a denied permission, which fire no hook.
import fs from 'node:fs';
import path from 'node:path';
import type { Session, State } from '../shared/types.ts';
import { liveFrom, readRunningSessions, type LiveStatus, type RunningSession } from './claudeStatus.ts';
import { DesktopSessions } from './desktop.ts';
import { LogTail } from './logtail.ts';
import { canFocusTerminals } from './terminal.ts';
import { RECENT_MS, STALE_MS, forgetOldSubagents, isRecord, newTracked, parseJson, stopSubagents, titleFrom, toSession, type Tracked } from './session.ts';

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
  /** Has sent a hook event other than opening or closing, i.e. has really been used. */
  hooked: boolean;
  /** The Claude Code process, while it runs. */
  pid?: number;
  /** From the running session's file: its state right now, and the name the user gave it with /rename. */
  live?: LiveStatus;
  /** The session's titles from its transcript: the one Claude Code generated, and one the user set. */
  titles: { ai: string; custom: string };
  transcript?: LogTail;
  /** Agent tool calls waiting for their SubagentStart, to give the subagent its description and model. */
  launching: { type: string; description: string; model: string }[];
  /** The shown session this one carries on in the same process (after /clear or /resume), and what it was called. */
  was?: { id: string; name: string };
}

export const newClaudeSession = (): ClaudeSession => ({ ...newTracked(), ended: false, hooked: false, launching: [], titles: { ai: '', custom: '' } });

/**
 * Whether the session gets a fish: once it has been used (a hook, a title, a name). A session that's only been
 * opened (e.g. "+ New" in the desktop app) runs under a temporary id until the first message, so it would show up twice.
 * One that carries on a shown session (after a /clear) keeps that one's fish right away.
 */
export const isShown = (session: ClaudeSession) =>
  session.hooked || !!(session.was || session.titles.ai || session.titles.custom || session.live?.name);

// Claude Code repeats its title records through the transcript, so the end of a long one has them too.
const TRANSCRIPT_FIRST_READ = 4 * 1024 * 1024;

const TITLE_RECORDS: Record<string, { field: string; title: keyof ClaudeSession['titles'] }> = {
  'ai-title': { field: 'aiTitle', title: 'ai' },
  'custom-title': { field: 'customTitle', title: 'custom' },
};

/**
 * Picks the session's titles out of transcript lines. The transcript format is internal to Claude Code, so this is
 * best effort: if it changes, the fish keeps the start of the first prompt as its name.
 */
export const noteTitles = (session: ClaudeSession, lines: string[]) => {
  for (const line of lines) {
    if (!line.includes('-title"')) continue; // cheap check: titles are a handful of lines among many
    const record = parseJson(line);
    if (!isRecord(record) || typeof record.type !== 'string') continue;
    if (!Object.hasOwn(TITLE_RECORDS, record.type)) continue;
    const { field: titleField, title: titleKind } = TITLE_RECORDS[record.type];
    const title = record[titleField];
    if (typeof title === 'string') session.titles[titleKind] = title;
  }
};

/**
 * What the fish is called: a name the user gave it, Claude Code's title, else the start of the first prompt; until
 * it has any of those, the name of the session it carries on.
 */
export const nameOf = (session: ClaudeSession) =>
  session.live?.name || session.titles.custom || session.titles.ai || session.name || session.title || session.was?.name || '';

// Tools that stop and wait for the user's answer, like Copilot's ask_user.
const ASKS_USER = new Set(['AskUserQuestion', 'ExitPlanMode']);
const AGENT_TOOLS = new Set(['Agent', 'Task']);
const NEEDS_USER = new Set(['permission_prompt', 'elicitation_dialog', 'agent_needs_input']);
// Fired by a session that's only been opened and closed again too: quitting right away, or the id it had before
// /clear, /login or the first message. They don't make it a session anyone used.
const OPEN_CLOSE = new Set(['SessionStart', 'SessionEnd']);

interface HookContext { session: ClaudeSession; event: HookEvent; time: number; isMain: boolean }

const noteLaunch = ({ session, event }: HookContext) => {
  // subagents can start subagents too, so their Agent calls count as well
  if (!AGENT_TOOLS.has(event.tool_name ?? '')) return;
  const input = event.tool_input ?? {};
  session.launching.push({ type: input.subagent_type || 'general-purpose', description: input.description || '', model: input.model || '' });
};

const startSubagent = ({ session, event, time }: HookContext) => {
  const id = event.agent_id ?? '', type = event.agent_type || 'subagent';
  const index = session.launching.findIndex(launch => launch.type === type);
  const launch = index >= 0 ? session.launching.splice(index, 1)[0] : undefined;
  session.subagents.set(id, { id, name: type, type, description: launch?.description ?? '', model: launch?.model ?? '', status: 'running', start: time, end: 0 });
};

const notify = ({ session, event }: HookContext) => {
  if (NEEDS_USER.has(event.notification_type ?? '')) session.state = 'waiting';
  else if (event.notification_type === 'idle_prompt') session.state = 'idle';
};

// Tool calls inside a subagent shouldn't change what the main session is doing.
const fromMain = (state: State) => (context: HookContext) => { if (context.isMain) context.session.state = state; };

const HOOK_HANDLERS: Record<string, (context: HookContext) => void> = {
  SessionStart: ({ session, event }) => {
    session.ended = false;
    if (event.session_title) session.name = event.session_title;
  },
  UserPromptSubmit: ({ session, event }) => {
    session.state = 'working';
    if (!session.title && event.prompt) session.title = titleFrom(event.prompt);
  },
  PreToolUse: context => {
    noteLaunch(context);
    fromMain(ASKS_USER.has(context.event.tool_name ?? '') ? 'waiting' : 'working')(context);
  },
  PermissionRequest: ({ session }) => { session.state = 'waiting'; }, // also from a subagent: either way the user has to answer
  PostToolUse: fromMain('working'),
  PostToolUseFailure: fromMain('working'),
  PermissionDenied: fromMain('working'),
  Notification: notify,
  Stop: fromMain('idle'),
  StopFailure: fromMain('idle'),
  SubagentStart: startSubagent,
  SubagentStop: ({ session, event, time }) => {
    const subagent = session.subagents.get(event.agent_id ?? '');
    if (subagent) { subagent.status = 'done'; subagent.end = time; }
  },
  SessionEnd: ({ session, time }) => {
    session.state = 'idle'; session.ended = true; session.launching = [];
    stopSubagents(session, time);
  },
};

export const applyHook = (session: ClaudeSession, event: HookEvent, time: number) => {
  session.lastEvent = Math.max(session.lastEvent, time);
  if (!OPEN_CLOSE.has(event.hook_event_name)) session.hooked = true;
  const isMain = !event.agent_id;
  if (event.transcript_path && isMain && session.transcript?.file !== event.transcript_path) session.transcript = new LogTail(event.transcript_path, TRANSCRIPT_FIRST_READ);
  if (Object.hasOwn(HOOK_HANDLERS, event.hook_event_name)) HOOK_HANDLERS[event.hook_event_name]({ session, event, time, isMain });
};

const isHookEvent = (candidate: unknown): candidate is HookEvent =>
  isRecord(candidate) && typeof candidate.hook_event_name === 'string' && typeof candidate.session_id === 'string' && !!candidate.session_id;

/** Parses a hook POST body; null if it isn't a hook event. */
export const parseHook = (body: string): HookEvent | null => {
  const event = parseJson(body);
  return isHookEvent(event) ? event : null;
};

export class Claude {
  readonly configDir: string;
  private sessions = new Map<string, ClaudeSession>();
  /** PIDs of the running sessions, from the last poll. */
  private pids: number[] = [];
  /** The session each of those processes was running at the last poll: a /clear or /resume moves it to another id. */
  private inProcess = new Map<number, string>();
  /** When we last looked for a session's transcript, for sessions no hook has told us about yet. */
  private searched = new Map<string, number>();

  private desktop: DesktopSessions;

  constructor(configDir: string, desktop = new DesktopSessions()) { this.configDir = configDir; this.desktop = desktop; }

  private session(id: string) {
    let session = this.sessions.get(id);
    if (!session) this.sessions.set(id, session = newClaudeSession());
    return session;
  }

  private forget(id: string) { this.sessions.delete(id); this.searched.delete(id); }

  handle(event: HookEvent, time = Date.now()) { applyHook(this.session(event.session_id), event, time); }

  /** Reads the running sessions' files. Sessions show up from these alone, also before their first hook arrives. */
  poll() {
    const running = readRunningSessions(path.join(this.configDir, 'sessions'));
    this.pids = running.map(entry => entry.pid);
    const liveIds = new Set<string>(), inProcess = new Map<number, string>();
    for (const { pid, running: file } of running) {
      if (typeof file.sessionId !== 'string' || !file.sessionId) continue;
      this.noteRunning(pid, file.sessionId, file);
      inProcess.set(pid, file.sessionId);
      liveIds.add(file.sessionId);
    }
    this.inProcess = inProcess;
    for (const [id, session] of this.sessions) this.refresh(id, session, liveIds.has(id));
  }

  private noteRunning(pid: number, id: string, file: RunningSession) {
    const session = this.session(id), was = this.inProcess.get(pid);
    if (was && was !== id) this.carryOn(was, session);
    session.live = liveFrom(file);
    session.pid = pid;
    if (typeof file.statusUpdatedAt === 'number') session.lastEvent = Math.max(session.lastEvent, file.statusUpdatedAt);
  }

  private refresh(id: string, session: ClaudeSession, isLive: boolean) {
    if (!isLive) { session.live = undefined; session.pid = undefined; }
    // an opened session that's gone again without ever being used, e.g. its temporary id before the first message
    if (!session.live && !isShown(session)) { this.forget(id); return; }
    if (!session.transcript) this.findTranscript(id, session);
    const update = session.transcript?.read();
    if (update) noteTitles(session, update.lines);
  }

  /**
   * A process moved on from session `id` to `session`: a /clear starts a new session in it, a /resume switches to
   * another. It's still the same Claude Code the user is working in, so the old session's fish carries on as `session`
   * (Session.was).
   */
  private carryOn(id: string, session: ClaudeSession) {
    const old = this.sessions.get(id);
    if (!old || !isShown(old)) return; // e.g. the temporary id a session runs under until its first message
    session.was = { id, name: nameOf(old) };
    this.forget(id);
  }

  /** <config>/projects/<project>/<session id>.jsonl; looked up at most every 10 s until found. */
  private findTranscript(id: string, session: ClaudeSession) {
    const now = Date.now();
    if (now - (this.searched.get(id) ?? 0) < 10_000) return;
    this.searched.set(id, now);
    const projects = path.join(this.configDir, 'projects');
    let projectFolders: string[] = [];
    try { projectFolders = fs.readdirSync(projects); } catch { return; }
    const file = projectFolders.map(project => path.join(projects, project, id + '.jsonl')).find(candidate => fs.existsSync(candidate));
    if (file) { session.transcript = new LogTail(file, TRANSCRIPT_FIRST_READ); this.searched.delete(id); }
  }

  private toShownSession(id: string, session: ClaudeSession, now: number): Session | null {
    forgetOldSubagents(session, now);
    const tracked = { ...session, state: session.live?.state ?? session.state, name: nameOf(session) };
    const shown = toSession({ id, source: 'claude', tracked, now });
    if (!shown) return null;
    if (session.was) shown.was = session.was.id;
    const link = this.desktop.link(id, now);
    if (link) return { ...shown, link };
    return session.pid && canFocusTerminals ? { ...shown, terminal: true } : shown;
  }

  list(now: number): Session[] {
    const shownSessions: Session[] = [];
    for (const [id, session] of this.sessions) {
      if (!session.live && now - session.lastEvent > RECENT_MS) { this.forget(id); continue; }
      if (!isShown(session)) continue;
      const shown = this.toShownSession(id, session, now);
      if (shown) shownSessions.push(shown);
    }
    return shownSessions;
  }

  /** The process of a running session, to bring its terminal to the front. */
  pidOf(id: string) { return this.sessions.get(id)?.pid; }

  /** True while any Claude Code session is running (as of the last poll; spares and daemons don't count), or one that
   *  hasn't ended was recently active. */
  running(now = Date.now()) {
    return this.pids.length > 0 || [...this.sessions.values()].some(session => !session.ended && now - session.lastEvent < STALE_MS);
  }
}
