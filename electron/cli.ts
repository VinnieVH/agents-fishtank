// The app's command line, for the CLIs' hooks and status line and the Windows uninstaller. The launcher scripts in
// electron/bin run it with the app's own binary in Node mode (ELECTRON_RUN_AS_NODE), so no Node.js is needed.
//   fishtank start                       start the app unless it's running (SessionStart hook). Prints nothing:
//                                        Claude Code adds a SessionStart hook's output to the conversation.
//   fishtank statusline <port> [yours]   Claude Code status line: pass the plan usage (rate_limits) to the app's air
//                                        tanks, then run your own status line (base64-encoded) with the same input.
//   fishtank disconnect                  remove the fishtank from Claude Code and Copilot CLI (uninstaller)
import http from 'node:http';
import { spawn } from 'node:child_process';
import { DEFAULT_PORT } from '../server/server.ts';
import { disconnect, places } from './connect.ts';

const [command, ...args] = process.argv.slice(2);
const port = Number(process.env.FISHTANK_PORT) || DEFAULT_PORT;

function request(method: string, path: string, body?: Buffer): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.request({
      host: '127.0.0.1', port: Number(args[0]) || port, path, method, timeout: 500,
      headers: body ? { 'Content-Type': 'application/json' } : {},
    }, res => { res.resume(); res.on('end', () => resolve(true)); });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(false));
    req.end(body);
  });
}

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks);
}

async function start() {
  if (await request('HEAD', '/')) return;
  // the app itself, as a normal app this time, detached so the hook can finish (and isn't killed with it)
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  spawn(process.execPath, ['--from-hook'], { detached: true, stdio: 'ignore', env, windowsHide: false }).unref();
}

interface StatusInput { model?: { display_name?: string }; rate_limits?: Record<string, { used_percentage?: number } | undefined> }

/** Without a status line of your own: e.g. "Opus · 5h 64% used · week 30% used". (Any status line hides Claude Code's
 *  footer hints, so it had better show something.) */
function defaultLine(raw: string) {
  let d: StatusInput = {};
  try { d = JSON.parse(raw); } catch { /* show nothing */ }
  const used = (name: string, key: string) => {
    const p = d.rate_limits?.[key]?.used_percentage;
    return typeof p === 'number' ? `${name} ${Math.round(p)}% used` : '';
  };
  return [d.model?.display_name ?? '', used('5h', 'five_hour'), used('week', 'seven_day')].filter(Boolean).join(' · ');
}

async function statusLine(encoded: string | undefined) {
  const input = await readStdin();
  // never hold up the status line: a fishtank that isn't running is simply skipped
  const forward = input.includes('"rate_limits"') ? request('POST', '/statusline/claude', input) : Promise.resolve(true);
  if (!encoded) process.stdout.write(defaultLine(input.toString('utf8')));
  else {
    const yours = spawn(Buffer.from(encoded, 'base64').toString('utf8'), { shell: true, stdio: ['pipe', 'inherit', 'inherit'] });
    yours.stdin.on('error', () => { /* it didn't read its input */ });
    yours.stdin.end(input);
    yours.on('exit', code => { process.exitCode = code ?? 0; });
    yours.on('error', () => { process.exitCode = 1; });
  }
  await forward;
}

if (command === 'start') await start();
else if (command === 'statusline') await statusLine(args[1]);
else if (command === 'disconnect') { const p = places(); disconnect('claude', p); disconnect('copilot', p); }
else { console.error('Usage: fishtank start | statusline <port> [your status line, base64] | disconnect'); process.exitCode = 2; }
