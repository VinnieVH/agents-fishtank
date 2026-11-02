// The built-in terminals: the shells behind the tabs on the left of the window (the page draws them, src/terminals.ts).
// A Claude Code or Copilot CLI tab runs the CLI in your shell, which stays when it ends; a shell tab is just the shell.
// Only the tank page itself may use them (see `allowed`), over IPC through electron/preload.ts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clipboard, dialog, ipcMain, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { spawn, type IPty } from 'node-pty';
import type { Tab, TerminalKind, TerminalSetup } from '../shared/terminals.ts';

const COMMANDS: Record<Exclude<TerminalKind, 'shell'>, { name: string; command: string }> = {
  claude: { name: 'Claude Code', command: 'claude' },
  copilot: { name: 'Copilot CLI', command: 'copilot' },
};
// Set by a session for what it runs (its id, entry point, the desktop app's messaging socket ...): the app inherits
// them when a session's hook opens it, and a claude started in a tab would take them as its own. Settings people set
// themselves are kept.
const SESSION_VARS = /^(CLAUDECODE|CLAUDE_PID|CLAUDE_EFFORT|CLAUDE_CODE_.*|CLAUDE_AGENT_SDK_.*|CLAUDE_PREVIEW_.*|ELECTRON_RUN_AS_NODE|ELECTRON_NO_ATTACH_CONSOLE)$/;
const OWN_SETTINGS = /^CLAUDE_CODE_(GIT_BASH_PATH|USE_BEDROCK|USE_VERTEX|USE_FOUNDRY|MAX_OUTPUT_TOKENS|DISABLE_NONESSENTIAL_TRAFFIC)$/;

/** The user's shell, and its arguments for an interactive shell or for running `command` first. */
function shell(): { file: string; name: string; args: (command?: string) => string[] } {
  if (process.platform === 'win32') {
    const pwsh = [process.env.ProgramFiles, process.env.ProgramW6432].map(d => d && path.join(d, 'PowerShell', '7', 'pwsh.exe')).find(f => f && fs.existsSync(f));
    return { file: pwsh ?? 'powershell.exe', name: 'PowerShell', args: c => c ? ['-NoLogo', '-NoExit', '-Command', c] : ['-NoLogo'] };
  }
  const file = process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
  // a login shell, so the CLIs are on the PATH (apps opened from the Dock or Finder get a short one)
  return { file, name: path.basename(file), args: c => c ? ['-l', '-i', '-c', `${c}; exec "$SHELL" -l`] : ['-l'] };
}

export interface Remembered { folder?: string; terminalOpen?: boolean; terminalWidth?: number }

export interface TerminalsOptions {
  /** The window showing the page from `origin`. */
  win: () => BrowserWindow | null;
  origin: () => string;
  /** Keep the folder and layout between starts. */
  remembered: () => Remembered;
  remember: (r: Remembered) => void;
}

export class Terminals {
  private ptys = new Map<number, { pty: IPty; tab: Tab }>();
  private nextId = 1;
  private readonly sh = shell();
  private o: TerminalsOptions;

  constructor(o: TerminalsOptions) {
    this.o = o;
    const handle = (channel: string, fn: (...args: any[]) => unknown) =>
      ipcMain.handle(channel, (e, ...args) => { if (!this.allowed(e)) throw new Error('Not allowed'); return fn(...args); });
    const on = (channel: string, fn: (...args: any[]) => void) =>
      ipcMain.on(channel, (e, ...args) => { if (this.allowed(e)) fn(...args); });

    handle('term:setup', (): TerminalSetup => {
      const r = o.remembered();
      return {
        kinds: [...(['claude', 'copilot'] as const).map(kind => ({ kind, name: COMMANDS[kind].name })), { kind: 'shell', name: this.sh.name }],
        folder: this.folder(), open: r.terminalOpen ?? false, width: r.terminalWidth ?? 0,
        // still running when the page is reloaded
        tabs: [...this.ptys.values()].map(t => t.tab),
      };
    });
    handle('term:create', (kind: TerminalKind, cols: number, rows: number) => this.create(kind, cols, rows));
    handle('term:pick-folder', async () => {
      const win = o.win(), options = { defaultPath: this.folder(), properties: ['openDirectory' as const] };
      const { canceled, filePaths } = await (win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options));
      if (!canceled && filePaths[0]) o.remember({ folder: filePaths[0] });
      return this.folder();
    });
    handle('term:paste', () => clipboard.readText());
    on('term:write', (id: number, data: string) => { if (typeof data === 'string') this.ptys.get(id)?.pty.write(data); });
    on('term:resize', (id: number, cols: number, rows: number) => {
      if (Number.isInteger(cols) && Number.isInteger(rows) && cols > 0 && rows > 0) this.ptys.get(id)?.pty.resize(cols, rows);
    });
    on('term:kill', (id: number) => this.ptys.get(id)?.pty.kill());
    on('term:layout', (open: boolean, width: number) => o.remember({ terminalOpen: !!open, terminalWidth: Math.round(Number(width) || 0) }));
    on('term:copy', (text: string) => { if (typeof text === 'string') clipboard.writeText(text); });
  }

  /** How many tabs are open. */
  get count() { return this.ptys.size; }

  /** Shows or hides the terminal side (View > Terminal). */
  toggle() { this.o.win()?.webContents.send('term:toggle'); }

  killAll() {
    for (const t of this.ptys.values()) { try { t.pty.kill(); } catch { /* already gone */ } }
    this.ptys.clear();
  }

  /** The folder new tabs start in: the one chosen last, if it's still there, else your home folder. */
  private folder() {
    const f = this.o.remembered().folder;
    return f && fs.existsSync(f) ? f : os.homedir();
  }

  /** Only the tank page itself, in this app's window. */
  private allowed(e: IpcMainEvent | IpcMainInvokeEvent) {
    const win = this.o.win(), url = e.senderFrame?.url;
    if (!win || e.sender !== win.webContents || !url) return false;
    try { return new URL(url).origin === new URL(this.o.origin()).origin; } catch { return false; }
  }

  private create(kind: TerminalKind, cols: number, rows: number): Tab {
    const command = kind === 'shell' ? undefined : COMMANDS[kind]?.command;
    if (kind !== 'shell' && !command) throw new Error('Unknown terminal: ' + kind);
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined && (!SESSION_VARS.test(k) || OWN_SETTINGS.test(k))) env[k] = v;
    Object.assign(env, { TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'AgentFishtank' });
    const folder = this.folder();
    const p = spawn(this.sh.file, this.sh.args(command), {
      name: 'xterm-256color', cols: Math.max(2, cols | 0) || 80, rows: Math.max(2, rows | 0) || 24, cwd: folder, env,
    });
    const id = this.nextId++, tab = { id, kind, folder };
    this.ptys.set(id, { pty: p, tab });
    p.onData(data => this.o.win()?.webContents.send('term:data', id, data));
    p.onExit(() => {
      this.ptys.delete(id);
      this.o.win()?.webContents.send('term:exit', id);
    });
    return tab;
  }
}
