import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LogTail } from '../server/logtail.ts';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });
function log(content: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-tail-'));
  dirs.push(dir);
  const file = path.join(dir, 'log.jsonl');
  fs.writeFileSync(file, content);
  return file;
}

describe('LogTail', () => {
  it('returns complete new lines, holding back an unfinished one', () => {
    const file = log('a\nb\npar');
    const t = new LogTail(file, 1024);
    expect(t.read()).toEqual({ lines: ['a', 'b'], restarted: false });
    expect(t.read()).toBeNull();
    fs.appendFileSync(file, 'tial\nc\n');
    expect(t.read()?.lines).toEqual(['partial', 'c']);
  });

  it('starts near the end of a big log, dropping the cut-off line', () => {
    const file = log('first line\nsecond line\nthird\n');
    expect(new LogTail(file, 10).read()?.lines).toEqual(['third']);
  });

  it('starts over when the log is truncated', () => {
    const file = log('a\nb\n');
    const t = new LogTail(file, 1024);
    t.read();
    fs.writeFileSync(file, 'c\n');
    expect(t.read()).toEqual({ lines: ['c'], restarted: true });
  });

  it('copes with a missing file', () => {
    expect(new LogTail('/nonexistent/fishtank.jsonl', 1024).read()).toBeNull();
  });
});
