// Adds or removes the fishtank's hooks and status line in Claude Code's user settings (~/.claude/settings.json),
// leaving everything else in that file alone. Used by install.sh / install.ps1 and the uninstallers.
//   node scripts/claude-hooks.ts install <settings.json> <port> <start command>
//   node scripts/claude-hooks.ts uninstall <settings.json>
import fs from 'node:fs';
import path from 'node:path';

interface Hook { type: string; command?: string; url?: string; timeout?: number }
interface MatcherGroup { matcher?: string; hooks?: Hook[] }
type HookMap = Record<string, MatcherGroup[]>;
interface StatusLine { type: string; command?: string; [key: string]: unknown }
interface Settings { hooks?: HookMap; statusLine?: StatusLine; [key: string]: unknown }

// Every hook event the server turns into fish behaviour (see server/claude.ts). SessionStart runs the start script instead.
export const HTTP_EVENTS = [
  'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PermissionDenied', 'PostToolUse', 'PostToolUseFailure',
  'Notification', 'Stop', 'StopFailure', 'SubagentStart', 'SubagentStop', 'SessionEnd',
];

const isOurs = (h: Hook) =>
  (h.type === 'http' && /^http:\/\/127\.0\.0\.1:\d+\/hook\/claude$/.test(h.url ?? '')) ||
  (h.type === 'command' && /start-fishtank\.(sh|ps1)/.test(h.command ?? ''));

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
export function withOurs(hooks: HookMap | undefined, port: number, startCommand: string): HookMap {
  const out = withoutOurs(hooks);
  const add = (event: string, hook: Hook) => { out[event] = [...(out[event] ?? []), { hooks: [hook] }]; };
  add('SessionStart', { type: 'command', command: startCommand, timeout: 15 });
  for (const event of HTTP_EVENTS) add(event, { type: 'http', url: `http://127.0.0.1:${port}/hook/claude`, timeout: 2 });
  return out;
}

// Our status line passes the plan usage to the fishtank and then runs yours, which it carries base64-encoded
// (shell-safe on every platform) as its last argument: node "<fishtank>/scripts/statusline.ts" <port> [yours]
const OUR_STATUS_LINE = /scripts[\\/]statusline\.ts"? (\d+)(?: ([A-Za-z0-9+/=]+))?$/;

/** Your own status line: unchanged if it isn't ours, else the one ours wraps (undefined if none). */
export function unwrapStatusLine(current: StatusLine | undefined): StatusLine | undefined {
  const m = current?.type === 'command' ? OUR_STATUS_LINE.exec(current.command ?? '') : null;
  if (!current || !m) return current;
  return m[2] ? { ...current, command: Buffer.from(m[2], 'base64').toString('utf8') } : undefined;
}

/** Our status line, wrapping yours (and keeping its other settings, like padding). */
export function wrapStatusLine(current: StatusLine | undefined, script: string, port: number): StatusLine {
  const yours = unwrapStatusLine(current);
  const inner = yours?.type === 'command' && yours.command ? ' ' + Buffer.from(yours.command).toString('base64') : '';
  return { ...yours, type: 'command', command: `node ${JSON.stringify(script)} ${port}${inner}` };
}

function main([action, file, port, startCommand]: string[]) {
  let settings: Settings = {};
  let original = '';
  if (fs.existsSync(file)) {
    original = fs.readFileSync(file, 'utf8');
    try { settings = original.trim() ? JSON.parse(original) : {}; } catch {
      console.error(`Could not parse ${file}; not changing it. Fix the JSON and run this again.`);
      process.exit(1);
    }
  } else if (action === 'uninstall') return;

  if (action === 'install') {
    settings.hooks = withOurs(settings.hooks, Number(port), startCommand);
    // forward slashes work in every shell Claude Code may run the status line in, also on Windows
    const script = path.join(import.meta.dirname, 'statusline.ts').replaceAll('\\', '/');
    settings.statusLine = wrapStatusLine(settings.statusLine, script, Number(port));
  } else if (action === 'uninstall') {
    settings.hooks = withoutOurs(settings.hooks);
    if (!Object.keys(settings.hooks).length) delete settings.hooks;
    settings.statusLine = unwrapStatusLine(settings.statusLine);
    if (!settings.statusLine) delete settings.statusLine;
  } else {
    console.error('Usage: node scripts/claude-hooks.ts install <settings.json> <port> <start command> | uninstall <settings.json>');
    process.exit(2);
  }

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

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) main(process.argv.slice(2));
