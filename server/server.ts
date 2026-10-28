// Watches GitHub Copilot CLI and Claude Code sessions and streams their activity to the fishtank page.
// Used by the desktop app (electron/main.ts) and, for development, by server/index.ts.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ClaudeLimits, Snapshot } from '../shared/types.ts';
import { DEFAULT_SETTINGS, mergeSettings, type Settings } from '../shared/settings.ts';
import { Copilot } from './copilot.ts';
import { Claude, limitsFrom, parseHook } from './claude.ts';

const IDLE_GRACE_MS = 15 * 1000;         // idle once no agent CLI process has been running this long
const MAX_HOOK_BYTES = 16 * 1024 * 1024; // hook payloads include tool input, e.g. a whole file being written

export const DEFAULT_PORT = 4321;

export interface ServerOptions {
  port: number;
  /** The built page (Vite's dist/). */
  distDir: string;
  copilotSessionDir?: string;
  claudeConfigDir?: string;
  /**
   * Called once when no Copilot CLI or Claude Code has been running for a while. With `waitForCli`, only after one
   * has been seen running, so a fishtank opened by hand doesn't go away by itself.
   */
  onIdle?: () => void;
  waitForCli?: boolean;
  /** Not idle after all, e.g. the app was opened at login and stays in the background. */
  keepRunning?: () => boolean;
  /** Where the settings are kept; without it they last until the server stops. */
  settingsFile?: string;
  /** The desktop app: the page then offers its notification and launch settings. */
  desktop?: boolean;
  /** Called with the settings at the start and after every change. */
  onSettings?: (s: Settings) => void;
  /** Called with every snapshot sent to the page (once a second). */
  onSnapshot?: (s: Snapshot) => void;
}

export interface Fishtank {
  url: string;
  /** Whether a Copilot CLI or Claude Code was running at the last check (every 5 s). */
  cliRunning(): boolean;
  settings(): Settings;
  stop(): void;
}

/** Starts the server; rejects with the listen error, e.g. EADDRINUSE when another fishtank already runs. */
export function startServer(o: ServerOptions): Promise<Fishtank> {
  const copilot = new Copilot(o.copilotSessionDir || path.join(os.homedir(), '.copilot', 'session-state'));
  const claude = new Claude(o.claudeConfigDir || path.join(os.homedir(), '.claude'));

  // Claude plan usage arrives with status line updates (electron/cli.ts statusline). The last one is kept in a temp
  // file, so the air tanks show right away the next time the fishtank starts.
  const LIMITS_FILE = path.join(os.tmpdir(), 'agent-fishtank-claude-limits.json');
  let limits: ClaudeLimits | null = null;
  try { const l = JSON.parse(fs.readFileSync(LIMITS_FILE, 'utf8')); if (typeof l?.at === 'number') limits = l; } catch { /* none yet */ }
  function noteLimits(l: ClaudeLimits) {
    limits = l;
    fs.writeFile(LIMITS_FILE, JSON.stringify(l), () => { /* only a cache */ });
  }

  let settings = DEFAULT_SETTINGS;
  if (o.settingsFile) {
    try { settings = mergeSettings(DEFAULT_SETTINGS, JSON.parse(fs.readFileSync(o.settingsFile, 'utf8'))); } catch { /* defaults */ }
  }
  function changeSettings(change: unknown) {
    settings = mergeSettings(settings, change);
    lastCliSeen = Date.now(); // e.g. turning "quit after the last session" back on doesn't quit right away
    if (o.settingsFile) {
      fs.mkdirSync(path.dirname(o.settingsFile), { recursive: true });
      fs.writeFileSync(o.settingsFile, JSON.stringify(settings, null, 2));
    }
    o.onSettings?.(settings);
    broadcast(snapshot());
  }
  o.onSettings?.(settings);

  function snapshot(): Snapshot {
    const now = Date.now();
    return { sessions: [...copilot.list(now), ...claude.list(now)], time: now, quota: copilot.quota, limits, settings, desktop: !!o.desktop };
  }

  const clients = new Set<http.ServerResponse>();
  function broadcast(snap: Snapshot) {
    const msg = `data: ${JSON.stringify(snap)}\n\n`;
    for (const res of clients) res.write(msg);
  }
  const tick = setInterval(() => {
    copilot.poll();
    claude.poll();
    const snap = snapshot();
    broadcast(snap);
    o.onSnapshot?.(snap);
  }, 1000);
  copilot.poll();
  claude.poll();
  if (!copilot.quota) copilot.seedQuota();

  let lastCliSeen = Date.now(), seenCli = false, running = false, idle = false;
  const checkCli = async () => {
    running = claude.running() || await copilot.running();
    if (running) { lastCliSeen = Date.now(); seenCli = true; return; }
    if (idle || !o.onIdle || !settings.quitWhenIdle || o.keepRunning?.() || Date.now() - lastCliSeen < IDLE_GRACE_MS || (o.waitForCli && !seenCli)) return;
    idle = true;
    for (const res of clients) res.write('event: shutdown\ndata: {}\n\n');
    o.onIdle();
  };
  const cliCheck = setInterval(checkCli, 5000);
  void checkCli();

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

  // The settings dialog posts its changes here. Besides JSON (see above), only the fishtank's own page may: a request
  // from anywhere but a localhost origin is refused.
  function changeSettingsFrom(req: http.IncomingMessage, res: http.ServerResponse) {
    let host = '';
    try { host = new URL(req.headers.origin || '').hostname; } catch { /* no origin */ }
    const json = (req.headers['content-type'] || '').startsWith('application/json');
    if (!json || (host !== '127.0.0.1' && host !== 'localhost')) { res.writeHead(403); res.end(); req.resume(); return; }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => { size += c.length; if (size <= 64 * 1024) chunks.push(c); });
    req.on('end', () => {
      let change: unknown = null;
      try { change = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* ignored below */ }
      if (size > 64 * 1024 || !change) { res.writeHead(400); res.end(); return; }
      try { changeSettings(change); } catch (e) { res.writeHead(500); res.end(String(e)); return; }
      res.writeHead(204); res.end();
    });
  }

  const DIST = path.resolve(o.distDir);
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

  const server = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (req.method === 'POST' && url === '/hook/claude') {
      return receive(req, res, body => { const ev = parseHook(body); if (ev) claude.handle(ev); });
    }
    if (req.method === 'POST' && url === '/statusline/claude') {
      return receive(req, res, body => { const l = limitsFrom(body, Date.now()); if (l) noteLimits(l); });
    }
    if (req.method === 'POST' && url === '/settings') return changeSettingsFrom(req, res);
    if (url === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    serveStatic(url, res);
  });

  return new Promise((resolve, reject) => {
    const stop = () => {
      clearInterval(tick); clearInterval(cliCheck);
      for (const res of clients) res.end();
      server.close();
    };
    server.once('error', err => { stop(); reject(err); });
    server.listen(o.port, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${o.port}/`, cliRunning: () => running, settings: () => settings, stop }));
  });
}
