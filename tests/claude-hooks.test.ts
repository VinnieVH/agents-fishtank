import { describe, expect, it } from 'vitest';
import { HTTP_EVENTS, unwrapStatusLine, withOurs, withoutOurs, wrapStatusLine } from '../scripts/claude-hooks.ts';

const START = 'bash "/opt/fishtank/start-fishtank.sh" --claude';
const mine = {
  Stop: [{ hooks: [{ type: 'command', command: 'afplay done.aiff' }] }],
  PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'guard.sh' }] }],
};

describe('Claude Code settings hooks', () => {
  it('adds the start script and an http hook per event, after the user\'s own hooks', () => {
    const h = withOurs(mine, 4321, START);
    expect(h.SessionStart).toEqual([{ hooks: [{ type: 'command', command: START, timeout: 15 }] }]);
    for (const e of HTTP_EVENTS) expect(h[e].at(-1)).toEqual({ hooks: [{ type: 'http', url: 'http://127.0.0.1:4321/hook/claude', timeout: 2 }] });
    expect(h.Stop[0]).toEqual(mine.Stop[0]);
    expect(h.PreToolUse[0]).toEqual(mine.PreToolUse[0]);
  });

  it('installs only once, also after a port change', () => {
    const twice = withOurs(withOurs(mine, 4321, START), 5000, START);
    expect(twice.Stop).toHaveLength(2);
    expect(twice.SessionStart).toHaveLength(1);
    expect(JSON.stringify(twice)).not.toContain(':4321/');
  });

  it('uninstalls back to exactly the user\'s hooks', () => {
    expect(withoutOurs(withOurs(mine, 4321, START))).toEqual(mine);
    expect(withoutOurs(withOurs(undefined, 4321, START))).toEqual({});
  });

  it('keeps other hooks that share a group with ours', () => {
    const shared = { Stop: [{ hooks: [{ type: 'command', command: 'say done' }, { type: 'http', url: 'http://127.0.0.1:4321/hook/claude' }] }] };
    expect(withoutOurs(shared)).toEqual({ Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] });
  });
});

describe('Claude Code status line', () => {
  const script = '/opt/fishtank/scripts/statusline.ts';
  const gsd = { type: 'command', command: 'node "/Users/me/.claude/hooks/gsd-statusline.js"', padding: 1 };

  it('wraps your status line and gives it back unchanged on uninstall', () => {
    const ours = wrapStatusLine(gsd, script, 4321);
    expect(ours).toMatchObject({ type: 'command', padding: 1 });
    expect(ours.command).toMatch(/^node "\/opt\/fishtank\/scripts\/statusline\.ts" 4321 [A-Za-z0-9+/=]+$/);
    expect(unwrapStatusLine(ours)).toEqual(gsd);
  });

  it('wraps only once, also after a port change', () => {
    const twice = wrapStatusLine(wrapStatusLine(gsd, script, 4321), script, 5000);
    expect(twice.command).toContain(' 5000 ');
    expect(unwrapStatusLine(twice)).toEqual(gsd);
  });

  it('works without a status line of your own', () => {
    const ours = wrapStatusLine(undefined, script, 4321);
    expect(ours.command).toBe(`node "${script}" 4321`);
    expect(unwrapStatusLine(ours)).toBeUndefined();
  });

  it('leaves other status lines alone', () => {
    expect(unwrapStatusLine(gsd)).toBe(gsd);
    expect(unwrapStatusLine(undefined)).toBeUndefined();
  });
});
