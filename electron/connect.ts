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

export function places(env: NodeJS.ProcessEnv = process.env, home = os.homedir()): Places {
  return {
    claudeDir: env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'),
    copilotHome: env.COPILOT_HOME || path.join(home, '.copilot'),
  };
}

/**
 * How the CLIs run the app's command line (electron/bin/fishtank.sh or .cmd, which run electron/cli.ts with the app's
 * own binary, so no Node.js is needed). Claude Code runs commands in Git Bash on Windows, or PowerShell without it.
 */
export interface Launcher { bin: string; shell: 'sh' | 'bash' | 'powershell' }

/** The shell command that runs `fishtank <args>`. Forward slashes work in every one of these shells. */
export function launch(l: Launcher, args: string) {
  const bin = JSON.stringify(l.bin.replaceAll('\\', '/'));
  return l.shell === 'sh' ? `sh ${bin} ${args}` : l.shell === 'powershell' ? `& ${bin} ${args}` : `${bin} ${args}`;
}

// ---------- Claude Code ----------

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

const isOurs = (h: Hook) =>
  (h.type === 'http' && /^http:\/\/127\.0\.0\.1:\d+\/hook\/claude$/.test(h.url ?? '')) ||
  (h.type === 'command' && OUR_COMMAND.test(h.command ?? ''));

/** The hooks with ours taken out; events and groups left empty are dropped. */
export function withoutOurs(hooks: HookMap = {}): HookMap {
  const out: HookMap = {};
  for (const [event, groups] of Object.entries(hooks)) {
    const kept = groups.flatMap(g => {
      if (!g.hooks?.some(isOurs)) return [g];
      const rest = g.hooks.filter(h => !isOurs(h));
      return rest.length ? [{ ...g, hooks: rest }] : [];
    });
    if (kept.length) out[event] = kept;
  }
  return out;
}

/** The hooks with ours (re)added at the end of each event. */
export function withOurs(hooks: HookMap | undefined, port: number, start: Hook): HookMap {
  const out = withoutOurs(hooks);
  const add = (event: string, hook: Hook) => { out[event] = [...(out[event] ?? []), { hooks: [hook] }]; };
  add('SessionStart', start);
  for (const event of HTTP_EVENTS) add(event, { type: 'http', url: `http://127.0.0.1:${port}/hook/claude`, timeout: 2 });
  return out;
}

/** Your own status line: unchanged if it isn't ours, else the one ours wraps (undefined if none). */
export function unwrapStatusLine(current: StatusLine | undefined): StatusLine | undefined {
  const m = current?.type === 'command' ? OUR_STATUS_LINE.exec(current.command ?? '') : null;
  if (!current || !m) return current;
  return m[2] ? { ...current, command: Buffer.from(m[2], 'base64').toString('utf8') } : undefined;
}

/** Our status line (`ours` is the command without your status line), wrapping yours and keeping its other settings. */
export function wrapStatusLine(current: StatusLine | undefined, ours: string): StatusLine {
  const yours = unwrapStatusLine(current);
  const inner = yours?.type === 'command' && yours.command ? ' ' + Buffer.from(yours.command).toString('base64') : '';
  return { ...yours, type: 'command', command: ours + inner };
}

const claudeSettings = (p: Places) => path.join(p.claudeDir, 'settings.json');

function readSettings(file: string): { settings: Settings; original: string } {
  if (!fs.existsSync(file)) return { settings: {}, original: '' };
  const original = fs.readFileSync(file, 'utf8');
  try { return { settings: original.trim() ? JSON.parse(original) : {}, original }; } catch {
    throw new Error(`Could not read ${file}: it isn't valid JSON. Nothing was changed; fix the file and try again.`);
  }
}

function writeSettings(file: string, settings: Settings, original: string) {
  const updated = JSON.stringify(settings, null, 2) + '\n';
  if (updated === original) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // settings can hold secrets (env, API key helpers), so the backup and the new file keep its permissions
  const mode = original ? fs.statSync(file).mode & 0o777 : 0o600;
  if (original) fs.writeFileSync(file + '.fishtank-backup', original, { mode });
  const tmp = file + '.fishtank-tmp';
  fs.writeFileSync(tmp, updated, { mode });
  fs.renameSync(tmp, file);
}

function connectClaude(p: Places, l: Launcher, port: number) {
  const file = claudeSettings(p);
  const { settings, original } = readSettings(file);
  const start: Hook = { type: 'command', command: launch(l, 'start'), timeout: 15, ...(l.shell === 'powershell' && { shell: 'powershell' }) };
  settings.hooks = withOurs(settings.hooks, port, start);
  settings.statusLine = wrapStatusLine(settings.statusLine, launch(l, `statusline ${port}`));
  writeSettings(file, settings, original);
}

function disconnectClaude(p: Places) {
  const file = claudeSettings(p);
  if (!fs.existsSync(file)) return;
  const { settings, original } = readSettings(file);
  settings.hooks = withoutOurs(settings.hooks);
  if (!Object.keys(settings.hooks).length) delete settings.hooks;
  settings.statusLine = unwrapStatusLine(settings.statusLine);
  if (!settings.statusLine) delete settings.statusLine;
  writeSettings(file, settings, original);
}

function claudeConnected(p: Places) {
  try {
    const { settings } = readSettings(claudeSettings(p));
    return JSON.stringify(withoutOurs(settings.hooks)) !== JSON.stringify(settings.hooks ?? {});
  } catch { return false; }
}

// ---------- GitHub Copilot CLI ----------

const copilotHook = (p: Places) => path.join(p.copilotHome, 'hooks', 'fishtank.json');

function connectCopilot(p: Places, l: Launcher) {
  const file = copilotHook(p);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Copilot runs `bash` on macOS/Linux and `powershell` on Windows
  const bash = launch(l.shell === 'powershell' ? { ...l, shell: 'bash' } : l, 'start');
  const powershell = launch({ ...l, shell: 'powershell' }, 'start');
  const hook = { version: 1, hooks: { sessionStart: [{ type: 'command', bash, powershell, timeoutSec: 15 }] } };
  fs.writeFileSync(file, JSON.stringify(hook, null, 2) + '\n');
}

// ---------- both ----------

/** Which CLIs seem to be installed: their configuration folder exists. */
export function installed(p: Places): Record<Cli, boolean> {
  return { claude: fs.existsSync(p.claudeDir), copilot: fs.existsSync(p.copilotHome) };
}

export function connected(p: Places): Record<Cli, boolean> {
  return { claude: claudeConnected(p), copilot: fs.existsSync(copilotHook(p)) };
}

/** Connects (or re-points) a CLI to this app. Throws if its settings can't be read. */
export function connect(cli: Cli, p: Places, l: Launcher, port: number) {
  if (cli === 'claude') connectClaude(p, l, port); else connectCopilot(p, l);
}

export function disconnect(cli: Cli, p: Places) {
  if (cli === 'claude') disconnectClaude(p); else fs.rmSync(copilotHook(p), { force: true });
}
