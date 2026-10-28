import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Copilot } from '../server/copilot.ts';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

/** A session-state folder with one session whose events.jsonl holds these events. */
function sessionState(events: object[], workspace?: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-'));
  dirs.push(root);
  fs.mkdirSync(path.join(root, 'sess-1'));
  const now = Date.now();
  const lines = events.map((e, i) => JSON.stringify({ timestamp: new Date(now - (events.length - i) * 1000).toISOString(), ...e }));
  fs.writeFileSync(path.join(root, 'sess-1', 'events.jsonl'), lines.join('\n') + '\n');
  if (workspace) fs.writeFileSync(path.join(root, 'sess-1', 'workspace.yaml'), workspace);
  return root;
}

describe('Copilot CLI session logs', () => {
  it('derives state, name, subagents and quota from events.jsonl', () => {
    const c = new Copilot(sessionState([
      { type: 'user.message', data: { content: 'Add a crab' } },
      { type: 'subagent.started', data: { toolCallId: 't1', agentDisplayName: 'Explore Agent', agentType: 'explore' } },
      { type: 'model.response', data: { quotaSnapshots: { premium_interactions: { entitlementRequests: 300, usedRequests: 30, remainingPercentage: 90 } } } },
      { type: 'tool.execution_start', data: { toolName: 'ask_user' } },
    ], "name: 'Crab work'\n"));
    c.poll();
    const [s] = c.list(Date.now());
    expect(s).toMatchObject({ id: 'sess-1', source: 'copilot', state: 'waiting', name: 'Crab work' });
    expect(s.subagents).toMatchObject([{ id: 't1', name: 'Explore Agent', type: 'explore', status: 'running' }]);
    expect(c.quota).toMatchObject({ entitlement: 300, used: 30, remainingPct: 90 });
  });

  it('goes idle at the end of the turn and falls back to the first prompt as name', () => {
    const c = new Copilot(sessionState([{ type: 'user.message', data: { content: 'Add a crab' } }, { type: 'assistant.turn_end' }]));
    c.poll();
    expect(c.list(Date.now())[0]).toMatchObject({ state: 'idle', name: 'Add a crab' });
  });
});

describe('Copilot CLI long logs', () => {
  it('reads only the end of a big log when it first sees the session', () => {
    const filler = Array.from({ length: 90_000 }, (_, i) => JSON.stringify({ type: 'assistant.message', id: 'm' + i, data: { content: 'x'.repeat(80) } }));
    const root = sessionState([]);
    const file = path.join(root, 'sess-1', 'events.jsonl');
    const ts = new Date().toISOString();
    fs.writeFileSync(file, [JSON.stringify({ type: 'user.message', timestamp: ts, data: { content: 'first prompt' } }), ...filler,
      JSON.stringify({ type: 'assistant.turn_end', timestamp: ts })].join('\n') + '\n');
    expect(fs.statSync(file).size).toBeGreaterThan(8 * 1024 * 1024);
    const c = new Copilot(root);
    c.poll();
    // the first prompt is beyond the 8 MB it reads, the latest state isn't
    expect(c.list(Date.now())[0]).toMatchObject({ state: 'idle', name: 'sess-1' });
  });
});
