// Connects the fishtank to Claude Code and GitHub Copilot CLI, and disconnects it again, leaving everything else in
// their settings alone. Used by the app's first-run dialog and menu (electron/main.ts) and by the Windows uninstaller
// (electron/cli.ts disconnect).
//  - Claude Code (~/.claude/settings.json): a SessionStart hook that starts the app, http hooks that POST every event
//    to the app, and a status line that passes the plan usage on and then runs the user's own status line.
//  - Copilot CLI (~/.copilot/hooks/fishtank.json): a sessionStart hook that starts the app.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

interface Hook { type: string; command?: string; url?: string; timeout?: number; shell?: string }
interface MatcherGroup { matcher?: string; hooks?: Hook[] }
type HookMap = Record<string, MatcherGroup[]>;
interface StatusLine { type: string; command?: string; [key: string]: unknown }
interface Settings { hooks?: HookMap; statusLine?: StatusLine; [key: string]: unknown }

export type Cli = 'claude' | 'copilot';

/** Where each CLI keeps its configuration (CLAUDE_CONFIG_DIR and COPILOT_HOME move them). */
export interface Places { claudeDir: string; copilotHome: string }

export const places = (env: NodeJS.ProcessEnv = process.env, home = os.homedir()): Places => ({
  claudeDir: env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'),
  copilotHome: env.COPILOT_HOME || path.join(home, '.copilot'),
});

/**
 * How the CLIs run the app's command line (electron/bin/fishtank.sh or .cmd, which run electron/cli.ts with the app's
 * own binary, so no Node.js is needed). Claude Code runs commands in Git Bash on Windows, or PowerShell without it.
 */
export interface Launcher { bin: string; shell: 'sh' | 'bash' | 'powershell' }

/** What a connected CLI runs: this app's launcher, and the port its server listens on. */
export interface Connection { launcher: Launcher; port: number }

const SHELL_PREFIX: Record<Launcher['shell'], string> = { sh: 'sh ', powershell: '& ', bash: '' };

/** The shell command that runs `fishtank <args>`. Forward slashes work in every one of these shells. */
export const launch = (launcher: Launcher, args: string) =>
  `${SHELL_PREFIX[launcher.shell]}${JSON.stringify(launcher.bin.replaceAll('\\', '/'))} ${args}`;

// Every hook event the server turns into fish behaviour (see server/claude.ts). SessionStart starts the app instead.
export const HTTP_EVENTS = [
  'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PermissionDenied', 'PostToolUse', 'PostToolUseFailure',
  'Notification', 'Stop', 'StopFailure', 'SubagentStart', 'SubagentStop', 'SessionEnd',
];

// Ours, also those of the earlier script-based install (start-fishtank.sh/.ps1, scripts/statusline.ts), so connecting
// replaces them and disconnecting removes them.
const OUR_COMMAND = /start-fishtank\.(sh|ps1)|[\\/]bin[\\/]fishtank\.(sh|cmd)"? start/;
// Our status line carries yours base64-encoded (shell-safe on every platform) as its last argument.
const OUR_STATUS_LINE = /(?:scripts[\\/]statusline\.ts"?|[\\/]bin[\\/]fishtank\.(?:sh|cmd)"? statusline) (\d+)(?: ([A-Za-z0-9+/=]+))?$/;

const isOurs = (hook: Hook) =>
  (hook.type === 'http' && /^http:\/\/127\.0\.0\.1:\d+\/hook\/claude$/.test(hook.url ?? '')) ||
  (hook.type === 'command' && OUR_COMMAND.test(hook.command ?? ''));

/** The hooks with ours taken out; events and groups left empty are dropped. */
export const withoutOurs = (hooks: HookMap = {}): HookMap => {
  const theirs: HookMap = {};
  for (const [event, groups] of Object.entries(hooks)) {
    const kept = groups.flatMap(group => {
      if (!group.hooks?.some(isOurs)) return [group];
      const rest = group.hooks.filter(hook => !isOurs(hook));
      return rest.length ? [{ ...group, hooks: rest }] : [];
    });
    if (kept.length) theirs[event] = kept;
  }
  return theirs;
};

/** The hooks with ours (re)added at the end of each event. */
export const withOurs = (hooks: HookMap | undefined, port: number, start: Hook): HookMap => {
  const all = withoutOurs(hooks);
  const add = (event: string, hook: Hook) => { all[event] = [...(all[event] ?? []), { hooks: [hook] }]; };
  add('SessionStart', start);
  for (const event of HTTP_EVENTS) add(event, { type: 'http', url: `http://127.0.0.1:${port}/hook/claude`, timeout: 2 });
  return all;
};

/** Your own status line: unchanged if it isn't ours, else the one ours wraps (undefined if none). */
export const unwrapStatusLine = (current: StatusLine | undefined): StatusLine | undefined => {
  const match = current?.type === 'command' ? OUR_STATUS_LINE.exec(current.command ?? '') : null;
  if (!current || !match) return current;
  return match[2] ? { ...current, command: Buffer.from(match[2], 'base64').toString('utf8') } : undefined;
};

/** Our status line (`ours` is the command without your status line), wrapping yours and keeping its other settings. */
export const wrapStatusLine = (current: StatusLine | undefined, ours: string): StatusLine => {
  const yours = unwrapStatusLine(current);
  const inner = yours?.type === 'command' && yours.command ? ' ' + Buffer.from(yours.command).toString('base64') : '';
  return { ...yours, type: 'command', command: ours + inner };
};

const claudeSettings = (folders: Places) => path.join(folders.claudeDir, 'settings.json');

const readSettings = (file: string): { settings: Settings; original: string } => {
  if (!fs.existsSync(file)) return { settings: {}, original: '' };
  const original = fs.readFileSync(file, 'utf8');
  try { return { settings: original.trim() ? JSON.parse(original) : {}, original }; } catch {
    throw new Error(`Could not read ${file}: it isn't valid JSON. Nothing was changed; fix the file and try again.`);
  }
};

const writeSettings = (file: string, settings: Settings, original: string) => {
  const updated = JSON.stringify(settings, null, 2) + '\n';
  if (updated === original) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // settings can hold secrets (env, API key helpers), so the backup and the new file keep its permissions
  const mode = original ? fs.statSync(file).mode & 0o777 : 0o600;
  if (original) fs.writeFileSync(file + '.fishtank-backup', original, { mode });
  const partialFile = file + '.fishtank-tmp';
  fs.writeFileSync(partialFile, updated, { mode });
  fs.renameSync(partialFile, file);
};

const connectClaude = (folders: Places, { launcher, port }: Connection) => {
  const file = claudeSettings(folders);
  const { settings, original } = readSettings(file);
  const start: Hook = { type: 'command', command: launch(launcher, 'start'), timeout: 15, ...(launcher.shell === 'powershell' && { shell: 'powershell' }) };
  settings.hooks = withOurs(settings.hooks, port, start);
  settings.statusLine = wrapStatusLine(settings.statusLine, launch(launcher, `statusline ${port}`));
  writeSettings(file, settings, original);
};

const disconnectClaude = (folders: Places) => {
  const file = claudeSettings(folders);
  if (!fs.existsSync(file)) return;
  const { settings, original } = readSettings(file);
  settings.hooks = withoutOurs(settings.hooks);
  if (!Object.keys(settings.hooks).length) delete settings.hooks;
  settings.statusLine = unwrapStatusLine(settings.statusLine);
  if (!settings.statusLine) delete settings.statusLine;
  writeSettings(file, settings, original);
};

const isClaudeConnected = (folders: Places) => {
  try {
    const { settings } = readSettings(claudeSettings(folders));
    return JSON.stringify(withoutOurs(settings.hooks)) !== JSON.stringify(settings.hooks ?? {});
  } catch { return false; }
};

const copilotHook = (folders: Places) => path.join(folders.copilotHome, 'hooks', 'fishtank.json');

const connectCopilot = (folders: Places, launcher: Launcher) => {
  const file = copilotHook(folders);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Copilot runs `bash` on macOS/Linux and `powershell` on Windows
  const bash = launch(launcher.shell === 'powershell' ? { ...launcher, shell: 'bash' } : launcher, 'start');
  const powershell = launch({ ...launcher, shell: 'powershell' }, 'start');
  const hook = { version: 1, hooks: { sessionStart: [{ type: 'command', bash, powershell, timeoutSec: 15 }] } };
  fs.writeFileSync(file, JSON.stringify(hook, null, 2) + '\n');
};

/** Which CLIs seem to be installed: their configuration folder exists. */
export const installed = (folders: Places): Record<Cli, boolean> =>
  ({ claude: fs.existsSync(folders.claudeDir), copilot: fs.existsSync(folders.copilotHome) });

export const connected = (folders: Places): Record<Cli, boolean> =>
  ({ claude: isClaudeConnected(folders), copilot: fs.existsSync(copilotHook(folders)) });

/** Connects (or re-points) a CLI to this app. Throws if its settings can't be read. */
export const connect = (cli: Cli, folders: Places, connection: Connection) => {
  if (cli === 'claude') connectClaude(folders, connection); else connectCopilot(folders, connection.launcher);
};

export const disconnect = (cli: Cli, folders: Places) => {
  if (cli === 'claude') disconnectClaude(folders); else fs.rmSync(copilotHook(folders), { force: true });
};
