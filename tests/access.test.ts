import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { lockedOut } from '../electron/access.ts';

const root = process.platform !== 'win32' && process.getuid?.() === 0; // root opens anything
let dir = '';

afterEach(() => {
  if (!dir) return;
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (process.platform === 'win32') execFileSync('icacls', [file, '/reset'], { stdio: 'ignore' });
    else fs.chmodSync(file, 0o600);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  dir = '';
});

describe('files a CLI left admin-only', () => {
  it.skipIf(root)('finds the files you may not open, and nothing else', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-access-'));
    const locked = path.join(dir, '.mcp-writer.lock'), fine = path.join(dir, 'config.json');
    fs.writeFileSync(locked, '1');
    fs.writeFileSync(fine, '{}');
    fs.mkdirSync(path.join(dir, 'session-state'));
    // like copilot run as administrator leaves it: only SYSTEM may open it (an elevated test run isn't SYSTEM either)
    if (process.platform === 'win32') execFileSync('icacls', [locked, '/inheritance:r', '/grant:r', '*S-1-5-18:F'], { stdio: 'ignore' });
    else fs.chmodSync(locked, 0);
    expect(lockedOut(dir)).toEqual([locked]);
  });

  it('is empty for a folder that isn\'t there', () => {
    expect(lockedOut(path.join(os.tmpdir(), 'fishtank-no-such-folder'))).toEqual([]);
  });
});
