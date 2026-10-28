import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DesktopSessions } from '../server/desktop.ts';

describe('Claude desktop app sessions', () => {
  it('links a Claude Code session to the desktop session it runs in', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-desktop-'));
    const org = path.join(dir, 'account', 'org');
    fs.mkdirSync(org, { recursive: true });
    const write = (name: string, s: object) => fs.writeFileSync(path.join(org, name), JSON.stringify(s));
    write('local_abc-1.json', { sessionId: 'local_abc-1', cliSessionId: 'cli-1' });
    write('local_bad.json', { sessionId: 'local_../bad', cliSessionId: 'cli-2' }); // not an id the app accepts
    write('scheduled-tasks.json', { scheduledTasks: [] });

    const desktop = new DesktopSessions(dir);
    expect(desktop.link('cli-1', 0)).toBe('claude://code/continue?session=local_abc-1');
    expect(desktop.link('cli-2', 0)).toBeUndefined();

    // a session started later is found on the next look, at most every 10 s
    write('local_def-2.json', { sessionId: 'local_def-2', cliSessionId: 'cli-3' });
    expect(desktop.link('cli-3', 5_000)).toBeUndefined();
    expect(desktop.link('cli-3', 10_000)).toBe('claude://code/continue?session=local_def-2');
    fs.rmSync(dir, { recursive: true });
  });

  it('has no links without the desktop app', () => {
    expect(new DesktopSessions(path.join(os.tmpdir(), 'no-such-fishtank-dir')).link('cli-1')).toBeUndefined();
  });
});
