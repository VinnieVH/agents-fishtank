// The built-in terminals: the shells behind the tabs on the left of the window (the page draws them, src/terminals.ts).
// A Claude Code or Copilot CLI tab runs the CLI in your shell, which stays when it ends; a shell tab is just the shell.
// Only the tank page itself may use them (see `allowed`), over IPC through electron/preload.ts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clipboard, dialog, ipcMain, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent, type MessageBoxOptions } from 'electron';
import { spawn, type IPty } from 'node-pty';
import type { Tab, TerminalKind, TerminalSetup } from '../shared/terminals.ts';
import { lockedOut, repair, repairCommand } from './access.ts';
import { places } from './connect.ts';

const COMMANDS: Record<Exclude<TerminalKind, 'shell'>, { name: string; command: string }> = {
  claude: { name: 'Claude Code', command: 'claude' },
  copilot: { name: 'Copilot CLI', command: 'copilot' },
};
// Set by a session for what it runs (its id, entry point, the desktop app's messaging socket ...): the app inherits
// them when a session's hook opens it, and a claude started in a tab would take them as its own. Settings people set
// themselves are kept.
const SESSION_VARS = /^(CLAUDECODE|CLAUDE_PID|CLAUDE_EFFORT|CLAUDE_CODE_.*|CLAUDE_AGENT_SDK_.*|CLAUDE_PREVIEW_.*|ELECTRON_RUN_AS_NODE|ELECTRON_NO_ATTACH_CONSOLE)$/;
const OWN_SETTINGS = /^CLAUDE_CODE_(GIT_BASH_PATH|USE_BEDROCK|USE_VERTEX|USE_FOUNDRY|MAX_OUTPUT_TOKENS|DISABLE_NONESSENTIAL_TRAFFIC)$/;

interface UserShell { file: string; name: string; args: (command?: string) => string[] }

/** The user's shell, and its arguments for an interactive shell or for running `command` first. */
const userShell = (): UserShell => {
  if (process.platform === 'win32') {
    const pwsh = [process.env.ProgramFiles, process.env.ProgramW6432]
      .map(folder => folder && path.join(folder, 'PowerShell', '7', 'pwsh.exe'))
      .find(file => file && fs.existsSync(file));
    return { file: pwsh ?? 'powershell.exe', name: 'PowerShell', args: command => command ? ['-NoLogo', '-NoExit', '-Command', command] : ['-NoLogo'] };
  }
  const file = process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
  // a login shell, so the CLIs are on the PATH (apps opened from the Dock or Finder get a short one)
  return { file, name: path.basename(file), args: command => command ? ['-l', '-i', '-c', `${command}; exec "$SHELL" -l`] : ['-l'] };
};

/** The app's environment without what the session that opened it set for itself. */
const terminalEnv = (): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [name, setting] of Object.entries(process.env)) {
    if (setting !== undefined && (!SESSION_VARS.test(name) || OWN_SETTINGS.test(name))) env[name] = setting;
  }
  return { ...env, TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'AgentFishtank' };
};

const showMessage = (window: BrowserWindow | null, options: MessageBoxOptions) =>
  window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options);

export interface Remembered { folder?: string; terminalOpen?: boolean; terminalWidth?: number }

export interface TerminalsOptions {
  /** The window showing the page from `origin`. */
  window: () => BrowserWindow | null;
  origin: () => string;
  /** Keep the folder and layout between starts. */
  remembered: () => Remembered;
  remember: (change: Remembered) => void;
}

export class Terminals {
  private ptys = new Map<number, { pty: IPty; tab: Tab }>();
  private nextId = 1;
  private readonly shell = userShell();
  private options: TerminalsOptions;

  constructor(options: TerminalsOptions) {
    this.options = options;
    // what the page sends is checked where it's used: the types only describe what the preload passes on
    const handle = <Args extends unknown[]>(channel: string, listener: (...args: Args) => unknown) =>
      ipcMain.handle(channel, (event, ...args) => { if (!this.allowed(event)) throw new Error('Not allowed'); return listener(...(args as Args)); });
    const on = <Args extends unknown[]>(channel: string, listener: (...args: Args) => void) =>
      ipcMain.on(channel, (event, ...args) => { if (this.allowed(event)) listener(...(args as Args)); });

    handle('term:setup', (): TerminalSetup => {
      const remembered = options.remembered();
      return {
        kinds: [...(['claude', 'copilot'] as const).map(kind => ({ kind, name: COMMANDS[kind].name })), { kind: 'shell', name: this.shell.name }],
        folder: this.folder(), open: remembered.terminalOpen ?? false, width: remembered.terminalWidth ?? 0,
        // still running when the page is reloaded
        tabs: [...this.ptys.values()].map(running => running.tab),
      };
    });
    handle('term:create', async (kind: TerminalKind, cols: number, rows: number) => {
      if (kind === 'copilot') await this.checkAccess(places().copilotHome);
      return this.create(kind, cols, rows);
    });
    handle('term:pick-folder', async () => {
      const window = options.window(), dialogOptions = { defaultPath: this.folder(), properties: ['openDirectory' as const] };
      const { canceled, filePaths } = await (window ? dialog.showOpenDialog(window, dialogOptions) : dialog.showOpenDialog(dialogOptions));
      if (!canceled && filePaths[0]) options.remember({ folder: filePaths[0] });
      return this.folder();
    });
    handle('term:paste', () => clipboard.readText());
    on('term:write', (id: number, data: string) => { if (typeof data === 'string') this.ptys.get(id)?.pty.write(data); });
    on('term:resize', (id: number, cols: number, rows: number) => {
      if (Number.isInteger(cols) && Number.isInteger(rows) && cols > 0 && rows > 0) this.ptys.get(id)?.pty.resize(cols, rows);
    });
    on('term:kill', (id: number) => this.ptys.get(id)?.pty.kill());
    on('term:layout', (open: boolean, width: number) => options.remember({ terminalOpen: !!open, terminalWidth: Math.round(Number(width) || 0) }));
    on('term:copy', (text: string) => { if (typeof text === 'string') clipboard.writeText(text); });
  }

  /** How many tabs are open. */
  get count() { return this.ptys.size; }

  /** Shows or hides the terminal side (View > Terminal). */
  toggle() { this.options.window()?.webContents.send('term:toggle'); }

  killAll() {
    for (const running of this.ptys.values()) { try { running.pty.kill(); } catch { /* already gone */ } }
    this.ptys.clear();
  }

  /** The folder new tabs start in: the one chosen last, if it's still there, else your home folder. */
  private folder() {
    const chosen = this.options.remembered().folder;
    return chosen && fs.existsSync(chosen) ? chosen : os.homedir();
  }


  /** Offers to repair files in the CLI's folder that only an administrator may open (see electron/access.ts). */
  private async checkAccess(folder: string) {
    const files = lockedOut(folder);
    if (!files.length) return;
    const window = this.options.window(), canRepair = process.platform === 'win32';
    const { response } = await showMessage(window, {
      type: 'warning',
      title: 'Agent Fishtank',
      message: 'The Copilot CLI won\'t work here until some of its files are repaired',
      detail: `These files can only be opened by an administrator, probably because copilot once ran as administrator:\n\n${files.join('\n')}\n\n`
        + (canRepair ? 'Repair asks for administrator rights once and gives them back to you.' : `Run this in a terminal to give them back to you:\n\n${repairCommand(files)}`),
      buttons: canRepair ? ['Repair', 'Open Anyway'] : ['Copy Command', 'Open Anyway'],
      defaultId: 0, cancelId: 1, noLink: true,
    });
    if (response !== 0) return;
    if (!canRepair) { clipboard.writeText(repairCommand(files)); return; }
    if (await repair(files)) return;
    await showMessage(window, { type: 'error', title: 'Agent Fishtank', message: 'The files couldn\'t be repaired',
      detail: `Run this in PowerShell as administrator:\n\n${repairCommand(files)}` });
  }

  /** Only the tank page itself, in this app's window. */
  private allowed(event: IpcMainEvent | IpcMainInvokeEvent) {
    const window = this.options.window(), url = event.senderFrame?.url;
    if (!window || event.sender !== window.webContents || !url) return false;
    try { return new URL(url).origin === new URL(this.options.origin()).origin; } catch { return false; }
  }

  private create(kind: TerminalKind, cols: number, rows: number): Tab {
    const command = kind === 'shell' ? undefined : COMMANDS[kind]?.command;
    if (kind !== 'shell' && !command) throw new Error('Unknown terminal: ' + kind);
    const folder = this.folder();
    const pty = spawn(this.shell.file, this.shell.args(command), {
      name: 'xterm-256color', cols: Math.max(2, cols | 0) || 80, rows: Math.max(2, rows | 0) || 24, cwd: folder, env: terminalEnv(),
    });
    const id = this.nextId++, tab = { id, kind, folder };
    this.ptys.set(id, { pty, tab });
    pty.onData(data => this.options.window()?.webContents.send('term:data', id, data));
    pty.onExit(() => {
      this.ptys.delete(id);
      this.options.window()?.webContents.send('term:exit', id);
    });
    return tab;
  }
}
