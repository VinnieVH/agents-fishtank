import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LogTail } from '../server/logtail.ts';

const folders: string[] = [];
afterEach(() => { for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true }); });
const log = (content: string) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-tail-'));
  folders.push(dir);
  const file = path.join(dir, 'log.jsonl');
  fs.writeFileSync(file, content);
  return file;
};

describe('LogTail', () => {
  it('returns complete new lines, holding back an unfinished one', () => {
    const file = log('a\nb\npar');
    const tail = new LogTail(file, 1024);
    expect(tail.read()).toEqual({ lines: ['a', 'b'], restarted: false });
    expect(tail.read()).toBeNull();
    fs.appendFileSync(file, 'tial\nc\n');
    expect(tail.read()?.lines).toEqual(['partial', 'c']);
  });

  it('starts near the end of a big log, dropping the cut-off line', () => {
    const file = log('first line\nsecond line\nthird\n');
    expect(new LogTail(file, 10).read()?.lines).toEqual(['third']);
  });

  it('starts over when the log is truncated', () => {
    const file = log('a\nb\n');
    const tail = new LogTail(file, 1024);
    tail.read();
    fs.writeFileSync(file, 'c\n');
    expect(tail.read()).toEqual({ lines: ['c'], restarted: true });
  });

  it('copes with a missing file', () => {
    expect(new LogTail('/nonexistent/fishtank.jsonl', 1024).read()).toBeNull();
  });
});
