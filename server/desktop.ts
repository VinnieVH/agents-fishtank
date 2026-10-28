// Claude Code sessions started in the Claude desktop app: clicking their fish opens them there. The app keeps a file
// per session (<app data>/Claude/claude-code-sessions/<account>/<org>/local_<id>.json) holding its own session id and
// Claude Code's (cliSessionId), and opens claude://code/continue?session=local_<id>. Neither is documented, so this
// is best effort: if they change, the fish just can't be clicked through.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RESCAN_MS = 10_000;
const LOCAL_ID = /^local_[A-Za-z0-9-]{1,64}$/; // what the app accepts in the link

/** Where the Claude desktop app keeps its data on this platform. */
export function desktopDataDir() {
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Claude');
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Claude');
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'Claude');
}

export const desktopLink = (localId: string) => 'claude://code/continue?session=' + encodeURIComponent(localId);

export class DesktopSessions {
  /** Claude Code session id → the app's local_ id. */
  private ids = new Map<string, string>();
  /** The session files read so far, by modification time, so a rescan only reads new or changed ones. */
  private seen = new Map<string, number>();
  private scanned = -Infinity;
  readonly dir: string;

  constructor(dir = path.join(desktopDataDir(), 'claude-code-sessions')) { this.dir = dir; }

  /** The link that opens the session in the desktop app, if it was started there. */
  link(cliSessionId: string, now = Date.now()): string | undefined {
    if (!this.ids.has(cliSessionId) && now - this.scanned >= RESCAN_MS) this.scan(now);
    const id = this.ids.get(cliSessionId);
    return id && desktopLink(id);
  }

  private scan(now: number) {
    this.scanned = now;
    for (const file of sessionFiles(this.dir)) {
      let mtime: number;
      try { mtime = fs.statSync(file).mtimeMs; } catch { continue; }
      if (this.seen.get(file) === mtime) continue;
      this.seen.set(file, mtime);
      try {
        const s = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (typeof s?.cliSessionId === 'string' && typeof s.sessionId === 'string' && LOCAL_ID.test(s.sessionId)) this.ids.set(s.cliSessionId, s.sessionId);
      } catch { /* being written, or not a session */ }
    }
  }
}

/** <dir>/<account>/<org>/local_*.json */
function sessionFiles(dir: string) {
  const list = (d: string) => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };
  const out: string[] = [];
  for (const account of list(dir)) if (account.isDirectory())
    for (const org of list(path.join(dir, account.name))) if (org.isDirectory())
      for (const f of list(path.join(dir, account.name, org.name)))
        if (f.isFile() && /^local_.*\.json$/.test(f.name)) out.push(path.join(dir, account.name, org.name, f.name));
  return out;
}
