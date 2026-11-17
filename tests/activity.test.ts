import { describe, expect, it } from 'vitest';
import { activityOf, requestOf } from '../server/activity.ts';
import { applyHook, newClaudeSession, type HookEvent } from '../server/claude.ts';
import { toSession } from '../server/session.ts';
import { waitPhrase } from '../shared/wait.ts';

const NOW = 1_000_000;

const play = (...events: Partial<HookEvent>[]) => {
  const session = newClaudeSession();
  events.forEach((event, index) => applyHook(session, { hook_event_name: 'PreToolUse', session_id: 's', ...event }, NOW + index));
  return toSession({ id: 's', source: 'claude', tracked: session, now: NOW + events.length });
};

describe('tool activity', () => {
  it('words what a tool call does', () => {
    expect(activityOf('Edit', { file_path: 'C:\\repo\\src\\reef.ts' })).toBe('Editing reef.ts');
    expect(activityOf('Bash', { command: 'npm test' })).toBe('Running npm test');
    expect(activityOf('WebFetch', { url: 'https://example.com/a/b' })).toBe('Fetching example.com');
    expect(activityOf('mcp__thing', {})).toBe('Using mcp__thing');
    expect(requestOf('Bash', { command: 'rm -rf dist' })).toBe('run rm -rf dist');
    expect(requestOf('Bash', {})).toBe('');
  });

  it('shows what a working session does, until it stops', () => {
    const tool = { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: '/a/b.ts' } };
    expect(play(tool)?.activity).toBe('Reading b.ts');
    expect(play(tool, { hook_event_name: 'PostToolUse' })?.activity).toBe('Reading b.ts');
    expect(play(tool, { hook_event_name: 'Stop' })?.activity).toBeUndefined();
  });
});

describe('why a session waits', () => {
  it('tells a question, a plan and a permission apart', () => {
    expect(play({ tool_name: 'AskUserQuestion' })?.wait).toEqual({ kind: 'question' });
    expect(play({ tool_name: 'ExitPlanMode' })?.wait).toEqual({ kind: 'plan' });
    const permission = play({ hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'rm -rf dist' } });
    expect(permission?.wait).toEqual({ kind: 'permission', detail: 'run rm -rf dist' });
    expect(waitPhrase(permission?.wait)).toBe('wants to run rm -rf dist');
  });

  it('forgets the reason once the session carries on', () => {
    expect(play({ hook_event_name: 'PermissionRequest', tool_name: 'Bash' }, { hook_event_name: 'PostToolUse' })?.wait).toBeUndefined();
  });

  it('knows a permission prompt from a notification', () => {
    expect(play({ hook_event_name: 'Notification', notification_type: 'permission_prompt' })?.wait).toEqual({ kind: 'permission' });
  });
});
