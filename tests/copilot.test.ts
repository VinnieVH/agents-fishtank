import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Copilot } from '../server/copilot.ts';

const folders: string[] = [];
afterEach(() => { for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true }); });

/** A session-state folder with one session whose events.jsonl holds these events. */
const sessionState = (events: object[], workspace?: string) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-'));
  folders.push(root);
  fs.mkdirSync(path.join(root, 'sess-1'));
  const now = Date.now();
  const lines = events.map((event, index) => JSON.stringify({ timestamp: new Date(now - (events.length - index) * 1000).toISOString(), ...event }));
  fs.writeFileSync(path.join(root, 'sess-1', 'events.jsonl'), lines.join('\n') + '\n');
  if (workspace) fs.writeFileSync(path.join(root, 'sess-1', 'workspace.yaml'), workspace);
  return root;
};

describe('Copilot CLI session logs', () => {
  it('derives state, name, subagents and quota from events.jsonl', () => {
    const copilot = new Copilot(sessionState([
      { type: 'user.message', data: { content: 'Add a crab' } },
      { type: 'subagent.started', data: { toolCallId: 't1', agentDisplayName: 'Explore Agent', agentType: 'explore' } },
      { type: 'model.response', data: { quotaSnapshots: { premium_interactions: { entitlementRequests: 300, usedRequests: 30, remainingPercentage: 90 } } } },
      { type: 'tool.execution_start', data: { toolName: 'ask_user' } },
    ], "name: 'Crab work'\n"));
    copilot.poll();
    const [session] = copilot.list(Date.now());
    expect(session).toMatchObject({ id: 'sess-1', source: 'copilot', state: 'waiting', name: 'Crab work' });
    expect(session.subagents).toMatchObject([{ id: 't1', name: 'Explore Agent', type: 'explore', status: 'running' }]);
    expect(copilot.quota).toMatchObject({ entitlement: 300, used: 30, remainingPct: 90 });
  });

  it('goes idle at the end of the turn and falls back to the first prompt as name', () => {
    const copilot = new Copilot(sessionState([{ type: 'user.message', data: { content: 'Add a crab' } }, { type: 'assistant.turn_end' }]));
    copilot.poll();
    expect(copilot.list(Date.now())[0]).toMatchObject({ state: 'idle', name: 'Add a crab' });
  });

  it('works while compacting and goes back to the turn state when compaction completes', () => {
    const events = [{ type: 'user.message', data: { content: 'hi' } }, { type: 'assistant.turn_end' }, { type: 'session.compaction_start' }];
    const copilot = new Copilot(sessionState(events));
    copilot.poll();
    expect(copilot.list(Date.now())[0].state).toBe('working');
    const compacted = new Copilot(sessionState([...events, { type: 'session.compaction_complete' }]));
    compacted.poll();
    expect(compacted.list(Date.now())[0].state).toBe('idle');
  });

  it('hides a session that was opened but never used', () => {
    const copilot = new Copilot(sessionState([{ type: 'session.start' }, { type: 'session.model_change' }]));
    copilot.poll();
    expect(copilot.list(Date.now())).toEqual([]);
  });

  it('prefers the CLI process running a session over one that resumed away from it', () => {
    const root = sessionState([{ type: 'user.message', data: { content: 'old' } }]);
    fs.mkdirSync(path.join(root, 'sess-2'));
    fs.copyFileSync(path.join(root, 'sess-1', 'events.jsonl'), path.join(root, 'sess-2', 'events.jsonl'));
    const lock = (id: string, pid: number, ago: number) => {
      const lockFile = path.join(root, id, `inuse.${pid}.lock`);
      fs.writeFileSync(lockFile, String(pid));
      const lockTime = new Date(Date.now() - ago);
      fs.utimesSync(lockFile, lockTime, lockTime);
    };
    // process.pid ran sess-1, then resumed sess-2; process.ppid resumed sess-1 after that
    lock('sess-1', process.pid, 60_000);
    lock('sess-2', process.pid, 1_000);
    lock('sess-1', process.ppid, 30_000);
    const copilot = new Copilot(root);
    copilot.poll();
    expect(copilot.pidOf('sess-1')).toBe(process.ppid);
    expect(copilot.pidOf('sess-2')).toBe(process.pid);
    fs.rmSync(path.join(root, 'sess-1', `inuse.${process.ppid}.lock`));
    expect(copilot.pidOf('sess-1')).toBe(process.pid); // only the CLI it was left in: focus that one
  });
});

describe('Copilot CLI long logs', () => {
  it('reads only the end of a big log when it first sees the session', () => {
    const filler = Array.from({ length: 90_000 }, (_, index) => JSON.stringify({ type: 'assistant.message', id: 'm' + index, data: { content: 'x'.repeat(80) } }));
    const root = sessionState([]);
    const file = path.join(root, 'sess-1', 'events.jsonl');
    const timestamp = new Date().toISOString();
    fs.writeFileSync(file, [JSON.stringify({ type: 'user.message', timestamp, data: { content: 'first prompt' } }), ...filler,
      JSON.stringify({ type: 'assistant.turn_end', timestamp })].join('\n') + '\n');
    expect(fs.statSync(file).size).toBeGreaterThan(8 * 1024 * 1024);
    const copilot = new Copilot(root);
    copilot.poll();
    // the first prompt is beyond the 8 MB it reads, the latest state isn't
    expect(copilot.list(Date.now())[0]).toMatchObject({ state: 'idle', name: 'sess-1' });
  });
});
