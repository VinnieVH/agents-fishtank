// Brings the terminal a session runs in to the front when its fish is clicked. On a Mac: iTerm2 and Terminal select
// the session's own tab (found by its tty); any other app (VS Code, Cursor, Warp, ...) is just brought to the front.
// On Windows: the first window up the session's process tree (Windows Terminal, a console, an editor).
// A session that has ended can be resumed in a new terminal window instead (resumeInTerminal).
import { execFile } from 'node:child_process';
import fs from 'node:fs';

const run = (cmd: string, args: string[]) => new Promise<string>((resolve, reject) =>
  execFile(cmd, args, { windowsHide: true, timeout: 10_000 }, (err, out) => err ? reject(err) : resolve(out)));

export interface Terminal {
  /** The macOS app it runs in, e.g. /Applications/iTerm.app; undefined when there is none (e.g. inside tmux). */
  app?: string;
  /** e.g. /dev/ttys003; undefined without one. */
  tty?: string;
}

/** Finds the terminal of a process in `ps -axo pid=,ppid=,tty=,comm=` output. */
export function terminalOf(ps: string, pid: number): Terminal {
  const procs = new Map<number, { ppid: number; tty: string; comm: string }>();
  for (const line of ps.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line);
    if (m) procs.set(Number(m[1]), { ppid: Number(m[2]), tty: m[3], comm: m[4] });
  }
  const own = procs.get(pid);
  const tty = own && /^ttys?\d+$/.test(own.tty) ? '/dev/' + own.tty : undefined;
  for (let p = procs.get(pid), hops = 0; p && hops < 50; p = procs.get(p.ppid), hops++) {
    const app = /^(\/.*?\.app)\//.exec(p.comm); // the outermost app, also for helpers inside it (VS Code's terminal)
    if (app) return { app: app[1], tty };
    if (p.ppid <= 1) break;
  }
  return { tty };
}

// The tty is passed as an argument, never put into the script.
const ITERM = `on run argv
  tell application "iTerm2"
    repeat with w in windows
      repeat with t in tabs of w
        repeat with s in sessions of t
          if tty of s is item 1 of argv then
            select w
            tell t to select
            tell s to select
            activate
            return "found"
          end if
        end repeat
      end repeat
    end repeat
  end tell
end run`;

const TERMINAL = `on run argv
  tell application "Terminal"
    repeat with w in windows
      repeat with t in tabs of w
        if tty of t is item 1 of argv then
          set selected of t to true
          set index of w to 1
          activate
          return "found"
        end if
      end repeat
    end repeat
  end tell
end run`;

async function focusMac(pid: number) {
  const { app, tty } = terminalOf(await run('ps', ['-axo', 'pid=,ppid=,tty=,comm=']), pid);
  if (!app) return false;
  const script = /\/iTerm\.app$/.test(app) ? ITERM : /\/Terminal\.app$/.test(app) ? TERMINAL : null;
  if (script && tty) {
    try { if ((await run('osascript', ['-e', script, tty])).trim() === 'found') return true; } catch { /* not allowed to control it */ }
  }
  await run('open', ['-a', app]);
  return true;
}

async function focusWindows(pid: number) {
  const script = `$p = ${pid}; for ($i = 0; $i -lt 50 -and $p; $i++) {
    $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
    if ($proc -and $proc.MainWindowHandle -ne 0) { if ((New-Object -ComObject WScript.Shell).AppActivate($p)) { exit 0 } }
    $p = (Get-CimInstance Win32_Process -Filter "ProcessId=$p").ParentProcessId
  }; exit 1`;
  try { await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]); return true; } catch { return false; }
}

/** Brings the terminal running process `pid` to the front; false if it couldn't be found. */
export function focusTerminal(pid: number): Promise<boolean> {
  if (!Number.isInteger(pid) || pid <= 1) return Promise.resolve(false);
  if (process.platform === 'darwin') return focusMac(pid).catch(() => false);
  if (process.platform === 'win32') return focusWindows(pid);
  return Promise.resolve(false);
}

// The command line is passed as an argument, never put into the script.
const ITERM_NEW = `on run argv
  tell application "iTerm2"
    create window with default profile
    tell current session of current window to write text (item 1 of argv)
    activate
  end tell
end run`;

const TERMINAL_NEW = `on run argv
  tell application "Terminal"
    do script (item 1 of argv)
    activate
  end tell
end run`;

const shellQuote = (s: string) => "'" + s.replace(/'/g, "'\\''") + "'";

/**
 * Runs `args` (a CLI and its arguments, e.g. copilot --resume <id>) in a new terminal window, in `cwd` if given:
 * iTerm2 if it's installed, else Terminal on a Mac; Windows Terminal, else a console window, on Windows.
 */
export async function resumeInTerminal(args: string[], cwd?: string): Promise<boolean> {
  if (cwd && !fs.existsSync(cwd)) cwd = undefined;
  try {
    if (process.platform === 'darwin') {
      const line = (cwd ? 'cd ' + shellQuote(cwd) + ' && ' : '') + args.map(shellQuote).join(' ');
      const iterm = fs.existsSync('/Applications/iTerm.app');
      await run('osascript', ['-e', iterm ? ITERM_NEW : TERMINAL_NEW, line]);
      return true;
    }
    if (process.platform === 'win32') {
      // Not hidden: Windows Terminal would apply that to the new window it opens.
      try { await new Promise<void>((resolve, reject) => execFile('wt.exe', [...(cwd ? ['-d', cwd] : []), ...args], { timeout: 10_000 }, err => err ? reject(err) : resolve())); } catch {
        await new Promise<void>((resolve, reject) => execFile('cmd.exe', ['/c', 'start', ...args], { cwd, windowsHide: true }, err => err ? reject(err) : resolve()));
      }
      return true;
    }
  } catch { /* not allowed, or no terminal */ }
  return false;
}

/** Whether this computer can bring a session's terminal to the front. */
export const canFocusTerminals = process.platform === 'darwin' || process.platform === 'win32';
