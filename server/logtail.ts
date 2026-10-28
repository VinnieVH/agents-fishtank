// Follows a growing JSON-lines log: each read returns the complete lines added since the last one. Used for Copilot's
// session logs and Claude Code's transcripts, which long sessions grow to hundreds of MB.
import fs from 'node:fs';

export class LogTail {
  readonly file: string;
  private readonly firstRead: number;
  private offset = -1;     // -1: not read yet
  private partial = '';    // an unfinished last line, completed by the next read
  private midLine = false; // the first read started inside a line: drop it

  /** `firstRead`: the first read starts at most this many bytes before the end; only the recent part matters. */
  constructor(file: string, firstRead: number) {
    this.file = file;
    this.firstRead = firstRead;
  }

  /** The new complete lines (`restarted` if the file was truncated or replaced), or null if there are none. */
  read(): { lines: string[]; restarted: boolean } | null {
    let size;
    try { size = fs.statSync(this.file).size; } catch { return null; }
    let restarted = false;
    if (this.offset < 0) {
      this.offset = Math.max(0, size - this.firstRead);
      this.midLine = this.offset > 0;
    } else if (size < this.offset) {
      this.offset = 0; this.partial = ''; this.midLine = false; restarted = true;
    }
    if (size === this.offset) return restarted ? { lines: [], restarted } : null;
    const buf = Buffer.alloc(size - this.offset);
    const fd = fs.openSync(this.file, 'r');
    try { fs.readSync(fd, buf, 0, buf.length, this.offset); } finally { fs.closeSync(fd); }
    this.offset = size;
    const lines = (this.partial + buf.toString('utf8')).split('\n');
    this.partial = lines.pop() ?? '';
    if (this.midLine) { lines.shift(); this.midLine = false; }
    return { lines: lines.filter(l => l.trim()), restarted };
  }
}
