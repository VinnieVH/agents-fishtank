// GitHub Copilot CLI: tails the session logs in ~/.copilot/session-state/<session>/events.jsonl.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Quota, Session, State } from '../shared/types.ts';
import { LogTail } from './logtail.ts';
import { canFocusTerminals } from './terminal.ts';
import { RECENT_MS, forgetOldSubagents, isRecord, newTracked, pidAlive, stopSubagents, titleFrom, toSession, type Tracked } from './session.ts';

// A session seen for the first time is read from at most this far before the end: its recent state is all we need,
// and long sessions write logs of hundreds of MB.
const FIRST_READ_BYTES = 8 * 1024 * 1024;
const QUOTA_SEED_BYTES = 4 * 1024 * 1024;

// base: the state from the conversation's own events; compacting overrides it with 'working' while it lasts.
// talked: the log holds conversation events, not just the bookkeeping of a CLI that opened and was left (or resumed another).
interface CopilotSession extends Tracked {
  log: LogTail; nameMtime: number; mtime: number; base: State; compacting: boolean; talked: boolean;
}

interface PremiumQuota {
  entitlementRequests: number; usedRequests: number; remainingPercentage: number;
  isUnlimitedEntitlement?: boolean; overage?: number; resetDate?: string;
}
// The fields we read from events.jsonl; each event type uses a few of them.
interface CopilotData {
  toolName?: string; toolCallId?: string; content?: unknown; model?: string;
  agentId?: string; agentName?: string; agentDisplayName?: string; agentType?: string; agentDescription?: string;
  quotaSnapshots?: { premium_interactions?: PremiumQuota };
}
interface CopilotEvent { type: string; id?: string; timestamp?: string; data?: CopilotData }

// The log is the CLI's own; a line that isn't an object is skipped, and fields fall back where they're used.
const isCopilotEvent = (candidate: unknown): candidate is CopilotEvent => isRecord(candidate);

const WORKING = new Set([
  'user.message', 'assistant.turn_start', 'assistant.message', 'model.turn_started',
  'model.model_call_started', 'model.response', 'tool.execution_complete',
  'permission.completed', 'human_response.recorded', 'skill.invoked', 'subagent.started',
]);
const IDLE = new Set(['assistant.turn_end', 'abort', 'session.shutdown', 'session.task_complete']);
// Besides the WORKING ones, events that show the session has really been used.
const TALKING = new Set(['tool.execution_start', 'permission.requested', 'assistant.turn_end', 'session.compaction_start']);
const COMPACTING: Record<string, boolean> = {
  'session.compaction_start': true, 'session.compaction_complete': false, 'session.shutdown': false,
};
const LOCK_FILE = /^inuse\.(\d+)\.lock$/;

const baseStateOf = (type: string, data: CopilotData): State | undefined => {
  if (type === 'tool.execution_start') return data.toolName === 'ask_user' ? 'waiting' : 'working';
  if (type === 'permission.requested') return 'waiting';
  if (WORKING.has(type)) return 'working';
  if (IDLE.has(type)) return 'idle';
  return undefined;
};

interface EventContext { session: CopilotSession; event: CopilotEvent; data: CopilotData; time: number }

const finishSubagent = ({ session, event, data, time }: EventContext) => {
  const subagent = session.subagents.get(data.toolCallId || data.agentId || event.id || '');
  if (subagent) { subagent.status = event.type === 'subagent.failed' ? 'failed' : 'done'; subagent.end = time; }
};

const SUBAGENT_EVENTS: Record<string, (context: EventContext) => void> = {
  'subagent.started': ({ session, event, data, time }) => {
    const id = data.toolCallId || data.agentId || event.id || '';
    session.subagents.set(id, {
      id, name: data.agentDisplayName || data.agentName || 'subagent', type: data.agentType || data.agentName || '',
      description: data.agentDescription || '', model: data.model || '', status: 'running', start: time, end: 0,
    });
  },
  'subagent.completed': finishSubagent,
  'subagent.failed': finishSubagent,
  'session.shutdown': ({ session, time }) => stopSubagents(session, time),
  'abort': ({ session, time }) => stopSubagents(session, time),
};

const noteState = (session: CopilotSession, type: string, data: CopilotData) => {
  session.base = baseStateOf(type, data) ?? session.base;
  if (Object.hasOwn(COMPACTING, type)) session.compacting = COMPACTING[type];
  if (WORKING.has(type) || TALKING.has(type)) session.talked = true;
  // A compaction runs on its own (e.g. /compact) or during a turn; afterwards the turn's own state applies again.
  session.state = session.compacting && session.base !== 'waiting' ? 'working' : session.base;
};

const unquote = (yamlValue: string) => yamlValue.trim().replace(/^(['"])(.*)\1$/, '$2');

const lockPidOf = (fileName: string) => {
  const match = LOCK_FILE.exec(fileName);
  return match ? Number(match[1]) : undefined;
};

const readTailText = (file: string, size: number) => {
  const length = Math.min(size, QUOTA_SEED_BYTES), buffer = Buffer.alloc(length);
  const descriptor = fs.openSync(file, 'r');
  fs.readSync(descriptor, buffer, 0, length, size - length);
  fs.closeSync(descriptor);
  return buffer.toString('utf8');
};

export class Copilot {
  readonly root: string;
  private sessions = new Map<string, CopilotSession>();
  // Latest premium credit snapshot. The CLI logs one with every model call (quotaSnapshots.premium_interactions).
  quota: Quota | null = null;

  constructor(root: string) { this.root = root; }

  private noteQuota(data: CopilotData, time: number) {
    const premium = data.quotaSnapshots?.premium_interactions;
    if (!premium || (this.quota && time < this.quota.at)) return;
    this.quota = {
      entitlement: premium.entitlementRequests, used: premium.usedRequests, remainingPct: premium.remainingPercentage,
      unlimited: !!premium.isUnlimitedEntitlement, overage: premium.overage || 0, resetDate: premium.resetDate || '', at: time,
    };
  }

  private sessionIds() {
    try { return fs.readdirSync(this.root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name); } catch { return []; }
  }

  // On startup, find the last snapshot in the most recently written logs (also older than an hour),
  // so the credits show before the first model call of a new session. Only the tail of each file is read.
  seedQuota() {
    const logs = this.sessionIds().flatMap(id => {
      const file = path.join(this.root, id, 'events.jsonl');
      try { return [{ file, stats: fs.statSync(file) }]; } catch { return []; }
    }).sort((first, second) => second.stats.mtimeMs - first.stats.mtimeMs).slice(0, 10);
    for (const { file, stats } of logs) {
      let text: string;
      try { text = readTailText(file, stats.size); } catch { continue; }
      this.noteLastQuota(text.split('\n'), stats.mtimeMs);
      if (this.quota) return;
    }
  }

  private noteLastQuota(lines: string[], fileTime: number) {
    for (let index = lines.length - 1; index >= 0; index--) {
      if (!lines[index].includes('"quotaSnapshots"')) continue;
      try {
        const event: unknown = JSON.parse(lines[index]);
        if (!isCopilotEvent(event)) continue;
        this.noteQuota(event.data || {}, Date.parse(event.timestamp ?? '') || fileTime);
        return;
      } catch { /* partial line */ }
    }
  }

  private applyEvent(session: CopilotSession, event: CopilotEvent) {
    const data = event.data || {};
    const time = Date.parse(event.timestamp ?? '') || Date.now();
    session.lastEvent = Math.max(session.lastEvent, time);
    if (data.quotaSnapshots) this.noteQuota(data, time);
    noteState(session, event.type, data);
    if (Object.hasOwn(SUBAGENT_EVENTS, event.type)) SUBAGENT_EVENTS[event.type]({ session, event, data, time });
    if (event.type === 'user.message' && !session.title && typeof data.content === 'string') session.title = titleFrom(data.content);
  }

  private readName(id: string, session: CopilotSession) {
    const file = path.join(this.root, id, 'workspace.yaml');
    let stats;
    try { stats = fs.statSync(file); } catch { return; }
    if (stats.mtimeMs === session.nameMtime) return;
    session.nameMtime = stats.mtimeMs;
    const match = /^name:\s*(.+)$/m.exec(fs.readFileSync(file, 'utf8'));
    if (match) session.name = unquote(match[1]).replace(/''/g, "'");
  }

  private trackedSession(id: string, file: string, modified: number) {
    const known = this.sessions.get(id);
    if (known || Date.now() - modified > RECENT_MS) return known;
    const session: CopilotSession = { ...newTracked(), log: new LogTail(file, FIRST_READ_BYTES), nameMtime: 0, mtime: 0, base: 'idle', compacting: false, talked: false };
    this.sessions.set(id, session);
    return session;
  }

  private readSession(id: string) {
    const file = path.join(this.root, id, 'events.jsonl');
    let stats;
    try { stats = fs.statSync(file); } catch { return; }
    const session = this.trackedSession(id, file, stats.mtimeMs);
    if (!session) return;
    session.mtime = stats.mtimeMs;
    this.readName(id, session);
    const update = session.log.read();
    if (!update) return;
    if (update.restarted) session.subagents.clear();
    for (const line of update.lines) {
      try {
        const event: unknown = JSON.parse(line);
        if (isCopilotEvent(event)) this.applyEvent(session, event);
      } catch { /* ignore malformed line */ }
    }
  }

  poll() { for (const id of this.sessionIds()) this.readSession(id); }

  list(now: number): Session[] {
    for (const [id, session] of this.sessions) {
      // forget sessions whose log hasn't been written for an hour (they'd only be picked up again if it is)
      if (now - session.lastEvent > RECENT_MS && now - session.mtime > RECENT_MS) this.sessions.delete(id);
      else forgetOldSubagents(session, now);
    }
    return [...this.sessions].flatMap(([id, tracked]) => {
      if (!tracked.talked) return [];
      const session = toSession({ id, source: 'copilot', tracked, now });
      if (!session) return [];
      return canFocusTerminals ? { ...session, terminal: true } : session; // its terminal, or resumed in a new one
    });
  }

  has(id: string) { return this.sessions.has(id); }

  /** The folder a session was started in, from its workspace.yaml (best effort), to resume it there. */
  cwdOf(id: string) {
    if (!this.sessions.has(id)) return undefined;
    try {
      const match = /^cwd:\s*(.+)$/m.exec(fs.readFileSync(path.join(this.root, id, 'workspace.yaml'), 'utf8'));
      return match ? unquote(match[1]) : undefined;
    } catch { return undefined; }
  }

  /**
   * The CLI process to bring to the front for a session: the one running it, else one that left it for another
   * session (the user can /resume it there), so clicks don't open a new terminal each time.
   */
  pidOf(id: string) {
    if (!this.sessions.has(id)) return undefined;
    let files: string[] = [];
    try { files = fs.readdirSync(path.join(this.root, id)); } catch { return undefined; }
    let left: number | undefined;
    for (const pid of files.map(lockPidOf)) {
      if (pid === undefined || !pidAlive(pid)) continue;
      if (this.latestLock(pid) === id) return pid;
      left ??= pid;
    }
    return left;
  }

  // A CLI that /resumes another session keeps the lock of the one it left, so a PID can be locked by several
  // sessions: it runs the one that locked it last.
  private latestLock(pid: number) {
    let latestId = '', latestTime = -1;
    for (const id of this.sessionIds()) {
      try {
        const lockTime = fs.statSync(path.join(this.root, id, `inuse.${pid}.lock`)).mtimeMs;
        if (lockTime > latestTime) { latestId = id; latestTime = lockTime; }
      } catch { /* not locked by this PID */ }
    }
    return latestId;
  }

  // Each live CLI session holds an inuse.<pid>.lock file; the PID is the copilot process.
  private lockPids() {
    const pids = new Set<number>();
    for (const id of this.sessionIds()) {
      let files: string[] = [];
      try { files = fs.readdirSync(path.join(this.root, id)); } catch { continue; }
      for (const pid of files.map(lockPidOf)) if (pid !== undefined) pids.add(pid);
    }
    return pids;
  }

  /** True while any Copilot CLI process is running. */
  running(): Promise<boolean> {
    const pids = this.lockPids();
    if (!pids.size) return Promise.resolve(false);
    if (process.platform !== 'win32') return Promise.resolve([...pids].some(pidAlive));
    // Verify the image name too, so a stale lock whose PID got reused doesn't keep us alive.
    return new Promise(resolve => {
      execFile('tasklist', ['/FO', 'CSV', '/NH', '/FI', 'IMAGENAME eq copilot*'], { windowsHide: true }, (error, output) => {
        if (error) return resolve(true);
        resolve(output.split(/\r?\n/).some(line => { const columns = line.split('","'); return columns.length > 1 && pids.has(Number(columns[1])); }));
      });
    });
  }
}
