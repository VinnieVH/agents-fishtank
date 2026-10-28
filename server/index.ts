// Watches GitHub Copilot CLI and Claude Code sessions and streams their activity to the fishtank page.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ClaudeLimits, Snapshot } from '../shared/types.ts';
import { Copilot } from './copilot.ts';
import { Claude, limitsFrom, parseHook } from './claude.ts';

const PORT = Number(process.env.FISHTANK_PORT) || 4321;
const EXIT_GRACE_MS = 15 * 1000;       // exit after no agent CLI process has been running this long
const KEEP_ALIVE = process.env.FISHTANK_KEEP_ALIVE === '1';
const MAX_HOOK_BYTES = 16 * 1024 * 1024; // hook payloads include tool input, e.g. a whole file being written

const copilot = new Copilot(process.env.COPILOT_SESSION_DIR || path.join(os.homedir(), '.copilot', 'session-state'));
const claude = new Claude(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'));

// Claude plan usage arrives with status line updates (scripts/statusline.ts). The last one is kept in a temp file,
// so the air tanks show right away the next time the fishtank starts.
const LIMITS_FILE = path.join(os.tmpdir(), 'agent-fishtank-claude-limits.json');
let limits: ClaudeLimits | null = null;
try { const l = JSON.parse(fs.readFileSync(LIMITS_FILE, 'utf8')); if (typeof l?.at === 'number') limits = l; } catch { /* none yet */ }
function noteLimits(l: ClaudeLimits) {
  limits = l;
  fs.writeFile(LIMITS_FILE, JSON.stringify(l), () => { /* only a cache */ });
}

function snapshot(): Snapshot {
  const now = Date.now();
  return { sessions: [...copilot.list(now), ...claude.list(now)], time: now, quota: copilot.quota, limits };
}

const clients = new Set<http.ServerResponse>();
setInterval(() => {
  copilot.poll();
  claude.poll();
  const msg = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const res of clients) res.write(msg);
}, 1000);
copilot.poll();
claude.poll();
if (!copilot.quota) copilot.seedQuota();

let lastCliSeen = Date.now();
if (!KEEP_ALIVE) {
  setInterval(async () => {
    if (claude.running() || await copilot.running()) { lastCliSeen = Date.now(); return; }
    if (Date.now() - lastCliSeen < EXIT_GRACE_MS) return;
    console.log('No Copilot CLI or Claude Code running, shutting down fishtank.');
    for (const res of clients) res.write('event: shutdown\ndata: {}\n\n');
    setTimeout(() => process.exit(0), 300);
  }, 5000);
}

// Claude Code hooks (and our status line) POST here. Always answer 204 with no body: a hook's response can steer
// Claude (e.g. allow or deny a tool), and the fishtank only watches. Requiring JSON keeps web pages from posting here,
// since browsers won't send that cross-origin without a CORS preflight we never approve.
function receive(req: http.IncomingMessage, res: http.ServerResponse, onBody: (body: string) => void) {
  const json = (req.headers['content-type'] || '').startsWith('application/json');
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (c: Buffer) => { size += c.length; if (size <= MAX_HOOK_BYTES) chunks.push(c); });
  req.on('end', () => {
    res.writeHead(204); res.end();
    if (json && size <= MAX_HOOK_BYTES) onBody(Buffer.concat(chunks).toString('utf8'));
  });
}

// The page is built by Vite into dist/ (npm run build).
const DIST = path.join(import.meta.dirname, '..', 'dist');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.wasm': 'application/wasm',
};
function serveStatic(url: string, res: http.ServerResponse) {
  let rel: string;
  try { rel = decodeURIComponent(url === '/' ? '/index.html' : url); } catch { res.writeHead(400); res.end(); return; }
  const file = path.join(DIST, path.normalize(rel));
  if (!file.startsWith(DIST + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (rel === '/index.html') {
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('The fishtank page is not built yet. Run: npm install && npm run build');
      } else { res.writeHead(404); res.end(); }
      return;
    }
    const cache = rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': cache });
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (req.method === 'POST' && url === '/hook/claude') {
    return receive(req, res, body => { const ev = parseHook(body); if (ev) claude.handle(ev); });
  }
  if (req.method === 'POST' && url === '/statusline/claude') {
    return receive(req, res, body => { const l = limitsFrom(body, Date.now()); if (l) noteLimits(l); });
  }
  if (url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  serveStatic(url, res);
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') { console.log(`Port ${PORT} is already in use (fishtank already running?).`); process.exit(0); }
  throw err;
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Agent fishtank: http://localhost:${PORT}  (watching ${copilot.root} and ${claude.configDir})`);
});
