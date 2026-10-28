import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { connect, connected, disconnect, HTTP_EVENTS, launch, unwrapStatusLine, withOurs, withoutOurs, wrapStatusLine, type Launcher } from '../electron/connect.ts';

const START = { type: 'command', command: 'sh "/Applications/Agent Fishtank.app/Contents/Resources/bin/fishtank.sh" start', timeout: 15 };
const mine = {
  Stop: [{ hooks: [{ type: 'command', command: 'afplay done.aiff' }] }],
  PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'guard.sh' }] }],
};

describe('Claude Code hooks', () => {
  it('adds the start hook and an http hook per event, after your own hooks', () => {
    const h = withOurs(mine, 4321, START);
    expect(h.SessionStart).toEqual([{ hooks: [START] }]);
    for (const e of HTTP_EVENTS) expect(h[e].at(-1)).toEqual({ hooks: [{ type: 'http', url: 'http://127.0.0.1:4321/hook/claude', timeout: 2 }] });
    expect(h.Stop[0]).toEqual(mine.Stop[0]);
    expect(h.PreToolUse[0]).toEqual(mine.PreToolUse[0]);
  });

  it('adds them only once, also after a port change', () => {
    const twice = withOurs(withOurs(mine, 4321, START), 5000, START);
    expect(twice.Stop).toHaveLength(2);
    expect(twice.SessionStart).toHaveLength(1);
    expect(JSON.stringify(twice)).not.toContain(':4321/');
  });

  it('removes them again, leaving exactly your own hooks', () => {
    expect(withoutOurs(withOurs(mine, 4321, START))).toEqual(mine);
    expect(withoutOurs(withOurs(undefined, 4321, START))).toEqual({});
  });

  it('keeps other hooks that share a group with ours', () => {
    const shared = { Stop: [{ hooks: [{ type: 'command', command: 'say done' }, { type: 'http', url: 'http://127.0.0.1:4321/hook/claude' }] }] };
    expect(withoutOurs(shared)).toEqual({ Stop: [{ hooks: [{ type: 'command', command: 'say done' }] }] });
  });
});

describe('Claude Code status line', () => {
  const ours = 'sh "/Applications/Agent Fishtank.app/Contents/Resources/bin/fishtank.sh" statusline 4321';
  const gsd = { type: 'command', command: 'node "/Users/me/.claude/hooks/gsd-statusline.js"', padding: 1 };

  it('wraps your status line and gives it back unchanged', () => {
    const wrapped = wrapStatusLine(gsd, ours);
    expect(wrapped).toMatchObject({ type: 'command', padding: 1 });
    expect(wrapped.command).toMatch(/statusline 4321 [A-Za-z0-9+/=]+$/);
    expect(unwrapStatusLine(wrapped)).toEqual(gsd);
    expect(unwrapStatusLine(wrapStatusLine(wrapped, ours.replace('4321', '5000')))).toEqual(gsd); // wraps once
  });

  it('works without a status line of your own, and leaves other status lines alone', () => {
    expect(unwrapStatusLine(wrapStatusLine(undefined, ours))).toBeUndefined();
    expect(unwrapStatusLine(gsd)).toBe(gsd);
  });
});

describe('launch commands', () => {
  it('quotes the launcher for each shell, with forward slashes', () => {
    expect(launch({ bin: '/Applications/Agent Fishtank.app/Contents/Resources/bin/fishtank.sh', shell: 'sh' }, 'start'))
      .toBe('sh "/Applications/Agent Fishtank.app/Contents/Resources/bin/fishtank.sh" start');
    const win = 'C:\\Users\\Jo Doe\\AppData\\Local\\Programs\\Agent Fishtank\\resources\\bin\\fishtank.cmd';
    expect(launch({ bin: win, shell: 'bash' }, 'start')).toBe('"C:/Users/Jo Doe/AppData/Local/Programs/Agent Fishtank/resources/bin/fishtank.cmd" start');
    expect(launch({ bin: win, shell: 'powershell' }, 'start')).toMatch(/^& "C:\/Users\/Jo Doe\/.*fishtank\.cmd" start$/);
  });
});

describe('connecting and disconnecting', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });
  const setup = (settings?: object) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-connect-'));
    dirs.push(root);
    const p = { claudeDir: path.join(root, '.claude'), copilotHome: path.join(root, '.copilot') };
    if (settings) { fs.mkdirSync(p.claudeDir); fs.writeFileSync(path.join(p.claudeDir, 'settings.json'), JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 }); }
    return p;
  };
  const mac: Launcher = { bin: '/Applications/Agent Fishtank.app/Contents/Resources/bin/fishtank.sh', shell: 'sh' };

  it('replaces the earlier script install, and disconnecting gives back your settings exactly', () => {
    const original = {
      model: 'opus',
      statusLine: { type: 'command', command: 'node "/Users/me/.claude/hooks/gsd-statusline.js"' },
      hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node gsd-check.js' }] }] },
    };
    // what install.sh wrote before the desktop app
    const scriptInstall = {
      ...original,
      statusLine: { type: 'command', command: `node "/Users/me/fishtank/scripts/statusline.ts" 4321 ${Buffer.from(original.statusLine.command).toString('base64')}` },
      hooks: {
        SessionStart: [...original.hooks.SessionStart, { hooks: [{ type: 'command', command: 'bash "/Users/me/fishtank/start-fishtank.sh" --claude', timeout: 15 }] }],
        Stop: [{ hooks: [{ type: 'http', url: 'http://127.0.0.1:4321/hook/claude', timeout: 2 }] }],
      },
    };
    const p = setup(scriptInstall);
    const file = path.join(p.claudeDir, 'settings.json');

    connect('claude', p, mac, 4321);
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(JSON.stringify(s)).not.toContain('start-fishtank');
    expect(JSON.stringify(s)).not.toContain('statusline.ts');
    expect(s.hooks.SessionStart).toHaveLength(2);
    expect(s.statusLine.command).toMatch(/^sh ".*fishtank\.sh" statusline 4321 /);
    expect(connected(p).claude).toBe(true);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);

    disconnect('claude', p);
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(original);
    expect(connected(p).claude).toBe(false);
  });

  it('refuses settings that aren\'t valid JSON, without touching them', () => {
    const p = setup();
    fs.mkdirSync(p.claudeDir);
    fs.writeFileSync(path.join(p.claudeDir, 'settings.json'), '{bad');
    expect(() => connect('claude', p, mac, 4321)).toThrow(/isn't valid JSON/);
    expect(fs.readFileSync(path.join(p.claudeDir, 'settings.json'), 'utf8')).toBe('{bad');
  });

  it('runs PowerShell hooks through PowerShell on Windows without Git Bash', () => {
    const p = setup({});
    connect('claude', p, { bin: 'C:\\App\\resources\\bin\\fishtank.cmd', shell: 'powershell' }, 4321);
    const s = JSON.parse(fs.readFileSync(path.join(p.claudeDir, 'settings.json'), 'utf8'));
    expect(s.hooks.SessionStart[0].hooks[0]).toMatchObject({ command: '& "C:/App/resources/bin/fishtank.cmd" start', shell: 'powershell' });
  });

  it('gives Copilot CLI a sessionStart hook for both shells, and removes it', () => {
    const p = setup();
    connect('copilot', p, mac, 4321);
    const hook = JSON.parse(fs.readFileSync(path.join(p.copilotHome, 'hooks', 'fishtank.json'), 'utf8'));
    expect(hook.hooks.sessionStart[0]).toMatchObject({ type: 'command', bash: expect.stringContaining('fishtank.sh" start'), powershell: expect.stringMatching(/^& ".*" start$/) });
    expect(connected(p).copilot).toBe(true);
    disconnect('copilot', p);
    expect(connected(p).copilot).toBe(false);
  });
});
