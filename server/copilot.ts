// GitHub Copilot CLI: tails the session logs in ~/.copilot/session-state/<session>/events.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import type { Quota, Session } from '../shared/types.ts';
import { LogTail } from './logtail.ts';
import { RECENT_MS, forgetOldSubagents, newTracked, pidAlive, stopSubagents, titleFrom, toSession, type Tracked } from './session.ts';

// A session seen for the first time is read from at most this far before the end: its recent state is all we need,
// and long sessions write logs of hundreds of MB.
const FIRST_READ_BYTES = 8 * 1024 * 1024;

interface CopilotSession extends Tracked { log: LogTail; nameMtime: number; mtime: number }

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

const WORKING = new Set([
  'user.message', 'assistant.turn_start', 'assistant.message', 'model.turn_started',
  'model.model_call_started', 'model.response', 'tool.execution_complete',
  'permission.completed', 'human_response.recorded', 'session.compaction_start',
  'skill.invoked', 'subagent.started',
]);
const IDLE = new Set(['assistant.turn_end', 'abort', 'session.shutdown', 'session.task_complete']);

export class Copilot {
  readonly root: string;
  private sessions = new Map<string, CopilotSession>();
  // Latest premium credit snapshot. The CLI logs one with every model call (quotaSnapshots.premium_interactions).
  quota: Quota | null = null;

  constructor(root: string) { this.root = root; }

  private noteQuota(d: CopilotData, ts: number) {
    const q = d.quotaSnapshots?.premium_interactions;
    if (!q || (this.quota && ts < this.quota.at)) return;
    this.quota = {
      entitlement: q.entitlementRequests, used: q.usedRequests, remainingPct: q.remainingPercentage,
      unlimited: !!q.isUnlimitedEntitlement, overage: q.overage || 0, resetDate: q.resetDate || '', at: ts,
    };
  }

  private dirs() {
    try { return fs.readdirSync(this.root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch { return []; }
  }

  // On startup, find the last snapshot in the most recently written logs (also older than an hour),
  // so the credits show before the first model call of a new session. Only the tail of each file is read.
  seedQuota() {
    const files = this.dirs().flatMap(name => {
      const file = path.join(this.root, name, 'events.jsonl');
      try { return [{ file, st: fs.statSync(file) }]; } catch { return []; }
    }).sort((a, b) => b.st.mtimeMs - a.st.mtimeMs).slice(0, 10);
    for (const { file, st } of files) {
      const len = Math.min(st.size, 4 * 1024 * 1024), buf = Buffer.alloc(len);
      try { const fd = fs.openSync(file, 'r'); fs.readSync(fd, buf, 0, len, st.size - len); fs.closeSync(fd); } catch { continue; }
      const lines = buf.toString('utf8').split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].includes('"quotaSnapshots"')) continue;
        try { const ev: CopilotEvent = JSON.parse(lines[i]); this.noteQuota(ev.data || {}, Date.parse(ev.timestamp ?? '') || st.mtimeMs); break; } catch { /* partial line */ }
      }
      if (this.quota) return;
    }
  }

  private applyEvent(s: CopilotSession, ev: CopilotEvent) {
    const t = ev.type;
    const d = ev.data || {};
    const ts = Date.parse(ev.timestamp ?? '') || Date.now();
    s.lastEvent = Math.max(s.lastEvent, ts);
    if (d.quotaSnapshots) this.noteQuota(d, ts);
    if (t === 'tool.execution_start') {
      s.state = d.toolName === 'ask_user' ? 'waiting' : 'working';
    } else if (t === 'permission.requested') {
      s.state = 'waiting';
    } else if (WORKING.has(t)) {
      s.state = 'working';
    } else if (IDLE.has(t)) {
      s.state = 'idle';
    }

    const id = d.toolCallId || d.agentId || ev.id || '';
    if (t === 'subagent.started') {
      s.subagents.set(id, {
        id, name: d.agentDisplayName || d.agentName || 'subagent', type: d.agentType || d.agentName || '',
        description: d.agentDescription || '', model: d.model || '', status: 'running', start: ts, end: 0,
      });
    } else if (t === 'subagent.completed' || t === 'subagent.failed') {
      const a = s.subagents.get(id);
      if (a) { a.status = t === 'subagent.failed' ? 'failed' : 'done'; a.end = ts; }
    } else if (t === 'session.shutdown' || t === 'abort') {
      stopSubagents(s, ts);
    }

    if (t === 'user.message' && !s.title && typeof d.content === 'string') s.title = titleFrom(d.content);
  }

  private readName(id: string, s: CopilotSession) {
    const file = path.join(this.root, id, 'workspace.yaml');
    let st;
    try { st = fs.statSync(file); } catch { return; }
    if (st.mtimeMs === s.nameMtime) return;
    s.nameMtime = st.mtimeMs;
    const m = /^name:\s*(.+)$/m.exec(fs.readFileSync(file, 'utf8'));
    if (m) s.name = m[1].trim().replace(/^(['"])(.*)\1$/, '$2').replace(/''/g, "'");
  }

  private readSession(id: string) {
    const file = path.join(this.root, id, 'events.jsonl');
    let st;
    try { st = fs.statSync(file); } catch { return; }
    let s = this.sessions.get(id);
    if (!s) {
      if (Date.now() - st.mtimeMs > RECENT_MS) return;
      s = { ...newTracked(), log: new LogTail(file, FIRST_READ_BYTES), nameMtime: 0, mtime: 0 };
      this.sessions.set(id, s);
    }
    s.mtime = st.mtimeMs;
    this.readName(id, s);
    const update = s.log.read();
    if (!update) return;
    if (update.restarted) s.subagents.clear();
    for (const line of update.lines) {
      try { this.applyEvent(s, JSON.parse(line)); } catch { /* ignore malformed line */ }
    }
  }

  poll() { for (const id of this.dirs()) this.readSession(id); }

  list(now: number): Session[] {
    for (const [id, s] of this.sessions) {
      // forget sessions whose log hasn't been written for an hour (they'd only be picked up again if it is)
      if (now - s.lastEvent > RECENT_MS && now - s.mtime > RECENT_MS) this.sessions.delete(id);
      else forgetOldSubagents(s, now);
    }
    return [...this.sessions].flatMap(([id, s]) => toSession(id, 'copilot', s, now) ?? []);
  }

  // Each live CLI session holds an inuse.<pid>.lock file; the PID is the copilot process.
  private lockPids() {
    const pids = new Set<number>();
    for (const name of this.dirs()) {
      let files: string[] = [];
      try { files = fs.readdirSync(path.join(this.root, name)); } catch { continue; }
      for (const f of files) { const m = /^inuse\.(\d+)\.lock$/.exec(f); if (m) pids.add(Number(m[1])); }
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
      execFile('tasklist', ['/FO', 'CSV', '/NH', '/FI', 'IMAGENAME eq copilot*'], { windowsHide: true }, (err, out) => {
        if (err) return resolve(true);
        resolve(out.split(/\r?\n/).some(line => { const c = line.split('","'); return c.length > 1 && pids.has(Number(c[1])); }));
      });
    });
  }
}
