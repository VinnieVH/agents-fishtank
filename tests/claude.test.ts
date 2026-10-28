import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyHook, Claude, limitsFrom, liveFrom, newClaudeSession, parseHook, type HookEvent } from '../server/claude.ts';
import { toSession } from '../server/session.ts';

const T = 1_000_000;
/** Plays hook events (as name or [name, extra fields]) into a fresh session, one second apart. */
function play(...events: (string | [string, Partial<HookEvent>])[]) {
  const s = newClaudeSession();
  events.forEach((e, i) => {
    const [name, extra] = typeof e === 'string' ? [e, {}] : e;
    applyHook(s, { hook_event_name: name, session_id: 's1', ...extra }, T + i * 1000);
  });
  return s;
}

describe('Claude Code hooks', () => {
  it('works from the prompt until Stop', () => {
    expect(play('SessionStart').state).toBe('idle');
    expect(play('SessionStart', 'UserPromptSubmit', ['PreToolUse', { tool_name: 'Bash' }]).state).toBe('working');
    expect(play('UserPromptSubmit', ['PreToolUse', { tool_name: 'Bash' }], 'PostToolUse', 'Stop').state).toBe('idle');
  });

  it('waits for the user on permission prompts and questions', () => {
    expect(play('UserPromptSubmit', ['PreToolUse', { tool_name: 'Bash' }], 'PermissionRequest').state).toBe('waiting');
    expect(play('UserPromptSubmit', ['Notification', { notification_type: 'permission_prompt' }]).state).toBe('waiting');
    expect(play('UserPromptSubmit', ['PreToolUse', { tool_name: 'AskUserQuestion' }]).state).toBe('waiting');
    expect(play('UserPromptSubmit', ['PreToolUse', { tool_name: 'AskUserQuestion' }], 'PostToolUse').state).toBe('working');
  });

  it('names the session after its title, else the first prompt', () => {
    expect(play(['UserPromptSubmit', { prompt: 'Fix   the\nlogin bug' }], ['UserPromptSubmit', { prompt: 'and tests' }]).title).toBe('Fix the login bug');
    expect(play(['SessionStart', { session_title: 'auth-refactor' }]).name).toBe('auth-refactor');
  });

  it('tracks subagents with the description from their Agent call', () => {
    const s = play('UserPromptSubmit',
      ['PreToolUse', { tool_name: 'Agent', tool_input: { subagent_type: 'Explore', description: 'Find the parser' } }],
      ['SubagentStart', { agent_id: 'a1', agent_type: 'Explore' }]);
    expect(s.subagents.get('a1')).toMatchObject({ name: 'Explore', description: 'Find the parser', status: 'running' });
    applyHook(s, { hook_event_name: 'SubagentStop', session_id: 's1', agent_id: 'a1', agent_type: 'Explore' }, T + 9000);
    expect(s.subagents.get('a1')).toMatchObject({ status: 'done', end: T + 9000 });
  });

  it('describes subagents started by another subagent', () => {
    const s = play('UserPromptSubmit',
      ['PreToolUse', { agent_id: 'boss', agent_type: 'general-purpose', tool_name: 'Agent', tool_input: { subagent_type: 'Explore', description: 'Scout the reef' } }],
      ['SubagentStart', { agent_id: 'scout', agent_type: 'Explore' }]);
    expect(s.subagents.get('scout')?.description).toBe('Scout the reef');
  });

  it('ignores tool calls inside a subagent, but not its permission prompts', () => {
    const sub = { agent_id: 'a1', agent_type: 'Explore' };
    expect(play('UserPromptSubmit', ['PreToolUse', { tool_name: 'AskUserQuestion' }], ['PostToolUse', sub]).state).toBe('waiting');
    expect(play('UserPromptSubmit', ['PermissionRequest', sub]).state).toBe('waiting');
  });

  it('keeps working while a background subagent runs after the turn ends', () => {
    const s = play('UserPromptSubmit', ['SubagentStart', { agent_id: 'a1', agent_type: 'general-purpose' }], 'Stop');
    expect(s.state).toBe('idle');
    expect(toSession('s1', 'claude', s, T + 5000)?.state).toBe('working');
  });

  it('stops running subagents when the session ends', () => {
    const s = play('UserPromptSubmit', ['SubagentStart', { agent_id: 'a1', agent_type: 'Explore' }], 'SessionEnd');
    expect(s).toMatchObject({ state: 'idle', ended: true });
    expect(s.subagents.get('a1')?.status).toBe('stopped');
  });

  it('replays a real session with a background subagent', () => {
    // hook order captured from Claude Code 2.1.312 (payloads trimmed to the fields we use)
    const sub = { agent_id: 'a3ad7cd4db', agent_type: 'general-purpose' };
    const agentCall = { tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose', description: 'Read package name' } };
    const s = play('UserPromptSubmit', ['PreToolUse', agentCall], ['SubagentStart', sub], ['PostToolUse', agentCall],
      ['PreToolUse', { ...sub, tool_name: 'Read' }], ['PostToolUse', { ...sub, tool_name: 'Read' }], 'Stop');
    expect(toSession('s1', 'claude', s, T + 7000)?.state).toBe('working'); // the subagent is still reading
    applyHook(s, { hook_event_name: 'SubagentStop', session_id: 's1', ...sub }, T + 8000);
    expect(toSession('s1', 'claude', s, T + 8000)).toMatchObject({
      state: 'idle', subagents: [{ name: 'general-purpose', description: 'Read package name', status: 'done' }],
    });
  });

  it('settles down on the idle prompt after an interrupt, which fires no Stop', () => {
    expect(play('UserPromptSubmit', ['PreToolUse', { tool_name: 'Bash' }], ['Notification', { notification_type: 'idle_prompt' }]).state).toBe('idle');
    expect(play('UserPromptSubmit', 'PermissionRequest', ['Notification', { notification_type: 'idle_prompt' }]).state).toBe('idle');
  });

  it('only accepts hook events', () => {
    expect(parseHook('{"hook_event_name":"Stop","session_id":"s1"}')).toMatchObject({ session_id: 's1' });
    expect(parseHook('{"hook_event_name":"Stop"}')).toBeNull();
    expect(parseHook('[1,2]')).toBeNull();
    expect(parseHook('not json')).toBeNull();
  });
});

describe('running session files', () => {
  it('maps the status, and only uses names the user gave', () => {
    expect(liveFrom({ status: 'busy', name: 'repo-2b', nameSource: 'derived' })).toEqual({ state: 'working', name: '' });
    expect(liveFrom({ status: 'waiting', name: 'auth fix', nameSource: 'user' })).toEqual({ state: 'waiting', name: 'auth fix' });
    expect(liveFrom({ status: 'idle' })).toEqual({ state: 'idle', name: '' });
    expect(liveFrom({ status: 'something-new' })).toBeUndefined();
  });

  it('overrides the hooks while the session runs, e.g. right after an interrupt', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-claude-'));
    try {
      fs.mkdirSync(path.join(dir, 'sessions'));
      const file = path.join(dir, 'sessions', process.pid + '.json'); // a PID that's certainly alive
      const write = (status: string) => fs.writeFileSync(file, JSON.stringify({ pid: process.pid, sessionId: 's1', status, name: 'renamed', nameSource: 'user', statusUpdatedAt: Date.now() }));
      const c = new Claude(dir);
      c.handle({ hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt: 'long task' });
      write('idle'); c.poll();
      expect(c.list(Date.now())).toMatchObject([{ id: 's1', state: 'idle', name: 'renamed' }]);
      expect(c.running()).toBe(true);
      fs.rmSync(file); c.poll();
      expect(c.list(Date.now())).toMatchObject([{ state: 'working', name: 'long task' }]); // back to the hooks
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('forgets sessions that ended over an hour ago', () => {
    const c = new Claude(os.tmpdir());
    c.handle({ hook_event_name: 'SessionEnd', session_id: 'old' }, Date.now() - 2 * 3600_000);
    expect(c.list(Date.now())).toEqual([]);
    expect(c.running()).toBe(false);
  });
});

describe('plan usage from the status line', () => {
  it('reads both windows, with reset times in ms', () => {
    const l = limitsFrom(JSON.stringify({ rate_limits: { five_hour: { used_percentage: 23.5, resets_at: 1738425600 }, seven_day: { used_percentage: 41.2, resets_at: 1738857600 } } }), 5);
    expect(l).toEqual({ fiveHour: { usedPct: 23.5, resetsAt: 1738425600_000 }, sevenDay: { usedPct: 41.2, resetsAt: 1738857600_000 }, at: 5 });
  });

  it('copes with a missing window, and ignores input without usage', () => {
    expect(limitsFrom(JSON.stringify({ rate_limits: { seven_day: { used_percentage: 10, resets_at: 1 } } }), 0)?.fiveHour).toBeNull();
    expect(limitsFrom(JSON.stringify({ model: { id: 'x' } }), 0)).toBeNull();
    expect(limitsFrom('nope', 0)).toBeNull();
  });
});
