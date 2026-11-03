// Brings the terminal a session runs in to the front when its fish is clicked. On a Mac: iTerm2 and Terminal select
// the session's own tab (found by its tty); any other app (VS Code, Cursor, Warp, ...) is just brought to the front.
// On Windows: the first window up the session's process tree (Windows Terminal, a console, an editor).
// A session that has ended can be resumed in a new terminal window instead (resumeInTerminal).
import { execFile } from 'node:child_process';
import fs from 'node:fs';

const run = (command: string, args: string[]) => new Promise<string>((resolve, reject) =>
  execFile(command, args, { windowsHide: true, timeout: 10_000 }, (error, output) => error ? reject(error) : resolve(output)));

export interface Terminal {
  /** The macOS app it runs in, e.g. /Applications/iTerm.app; undefined when there is none (e.g. inside tmux). */
  app?: string;
  /** e.g. /dev/ttys003; undefined without one. */
  tty?: string;
}

/** Finds the terminal of a process in `ps -axo pid=,ppid=,tty=,comm=` output. */
export const terminalOf = (ps: string, pid: number): Terminal => {
  const processes = new Map<number, { ppid: number; tty: string; command: string }>();
  for (const line of ps.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/.exec(line);
    if (match) processes.set(Number(match[1]), { ppid: Number(match[2]), tty: match[3], command: match[4] });
  }
  const own = processes.get(pid);
  const tty = own && /^ttys?\d+$/.test(own.tty) ? '/dev/' + own.tty : undefined;
  for (let ancestor = processes.get(pid), hops = 0; ancestor && hops < 50; ancestor = processes.get(ancestor.ppid), hops++) {
    const app = /^(\/.*?\.app)\//.exec(ancestor.command); // the outermost app, also for helpers inside it (VS Code's terminal)
    if (app) return { app: app[1], tty };
    if (ancestor.ppid <= 1) break;
  }
  return { tty };
};

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

const focusMac = async (pid: number) => {
  const { app, tty } = terminalOf(await run('ps', ['-axo', 'pid=,ppid=,tty=,comm=']), pid);
  if (!app) return false;
  const script = /\/iTerm\.app$/.test(app) ? ITERM : /\/Terminal\.app$/.test(app) ? TERMINAL : null;
  if (script && tty) {
    try { if ((await run('osascript', ['-e', script, tty])).trim() === 'found') return true; } catch { /* not allowed to control it */ }
  }
  await run('open', ['-a', app]);
  return true;
};

// Windows only lets the foreground app bring another window to the front, otherwise it just flashes in the taskbar.
// A synthetic Alt key press counts as user input to this process, which lifts that lock.
const focusWindows = async (pid: number) => {
  const script = `Add-Type -Name W -Namespace F -MemberDefinition '
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);'
  $p = ${pid}; for ($i = 0; $i -lt 50 -and $p; $i++) {
    $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
    if ($proc -and $proc.MainWindowHandle -ne 0) {
      $h = $proc.MainWindowHandle
      if ([F.W]::IsIconic($h)) { [void][F.W]::ShowWindow($h, 9) }
      [F.W]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [F.W]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
      if ([F.W]::SetForegroundWindow($h)) { exit 0 }
    }
    $p = (Get-CimInstance Win32_Process -Filter "ProcessId=$p").ParentProcessId
  }; exit 1`;
  try { await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]); return true; } catch { return false; }
};

/** Brings the terminal running process `pid` to the front; false if it couldn't be found. */
export const focusTerminal = (pid: number): Promise<boolean> => {
  if (!Number.isInteger(pid) || pid <= 1) return Promise.resolve(false);
  if (process.platform === 'darwin') return focusMac(pid).catch(() => false);
  if (process.platform === 'win32') return focusWindows(pid);
  return Promise.resolve(false);
};

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

const shellQuote = (text: string) => "'" + text.replace(/'/g, "'\\''") + "'";

const resumeOnMac = async (args: string[], cwd?: string) => {
  const line = (cwd ? 'cd ' + shellQuote(cwd) + ' && ' : '') + args.map(shellQuote).join(' ');
  const hasIterm = fs.existsSync('/Applications/iTerm.app');
  await run('osascript', ['-e', hasIterm ? ITERM_NEW : TERMINAL_NEW, line]);
};

const resumeOnWindows = async (args: string[], cwd?: string) => {
  // Not hidden: Windows Terminal would apply that to the new window it opens.
  try { await new Promise<void>((resolve, reject) => execFile('wt.exe', [...(cwd ? ['-d', cwd] : []), ...args], { timeout: 10_000 }, error => error ? reject(error) : resolve())); } catch {
    await new Promise<void>((resolve, reject) => execFile('cmd.exe', ['/c', 'start', ...args], { cwd, windowsHide: true }, error => error ? reject(error) : resolve()));
  }
};

const RESUMERS: Partial<Record<NodeJS.Platform, (args: string[], cwd?: string) => Promise<void>>> = { darwin: resumeOnMac, win32: resumeOnWindows };

/**
 * Runs `args` (a CLI and its arguments, e.g. copilot --resume <id>) in a new terminal window, in `cwd` if given:
 * iTerm2 if it's installed, else Terminal on a Mac; Windows Terminal, else a console window, on Windows.
 */
export const resumeInTerminal = async (args: string[], cwd?: string): Promise<boolean> => {
  const resume = RESUMERS[process.platform];
  if (!resume) return false;
  try {
    await resume(args, cwd && fs.existsSync(cwd) ? cwd : undefined);
    return true;
  } catch { return false; } // not allowed, or no terminal
};

/** Whether this computer can bring a session's terminal to the front. */
export const canFocusTerminals = process.platform === 'darwin' || process.platform === 'win32';
