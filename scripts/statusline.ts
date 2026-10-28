// Claude Code status line for the fishtank: passes the plan usage (rate_limits) on to the fishtank's air tanks, then
// runs your own status line with the same input and shows its output, so your status line looks just like before.
// Without one of your own it shows the model and the usage: any status line hides Claude Code's footer hints, so it
// had better show something.
// Only Claude Code gives the status line the usage, which is why this sits here. Set up by scripts/claude-hooks.ts.
//   node scripts/statusline.ts <port> [your status line command, base64-encoded]
import http from 'node:http';
import { spawn } from 'node:child_process';

const [port, encoded] = process.argv.slice(2);

const chunks: Buffer[] = [];
for await (const c of process.stdin) chunks.push(c);
const input = Buffer.concat(chunks);

// Never hold up the status line: a fishtank that isn't running is simply skipped.
const forward = new Promise<void>(resolve => {
  if (!input.includes('"rate_limits"')) return resolve();
  const req = http.request({
    host: '127.0.0.1', port: Number(port), path: '/statusline/claude', method: 'POST',
    headers: { 'Content-Type': 'application/json' }, timeout: 300,
  }, res => { res.resume(); res.on('end', resolve); });
  req.on('timeout', () => req.destroy());
  req.on('error', () => resolve());
  req.end(input);
});

interface Input { model?: { display_name?: string }; rate_limits?: Record<string, { used_percentage?: number } | undefined> }

/** e.g. "Opus · 5h 64% used · week 30% used" */
function defaultLine(raw: string) {
  let d: Input = {};
  try { d = JSON.parse(raw); } catch { /* show nothing */ }
  const used = (name: string, key: string) => {
    const p = d.rate_limits?.[key]?.used_percentage;
    return typeof p === 'number' ? `${name} ${Math.round(p)}% used` : '';
  };
  return [d.model?.display_name ?? '', used('5h', 'five_hour'), used('week', 'seven_day')].filter(Boolean).join(' · ');
}

if (!encoded) process.stdout.write(defaultLine(input.toString('utf8')));
else {
  const yours = spawn(Buffer.from(encoded, 'base64').toString('utf8'), { shell: true, stdio: ['pipe', 'inherit', 'inherit'] });
  yours.stdin.on('error', () => { /* it didn't read its input */ });
  yours.stdin.end(input);
  yours.on('exit', code => { process.exitCode = code ?? 0; });
  yours.on('error', () => { process.exitCode = 1; });
}
await forward;
