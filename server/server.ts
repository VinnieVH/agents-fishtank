// Watches GitHub Copilot CLI and Claude Code sessions and streams their activity to the fishtank page.
// Used by the desktop app (electron/main.ts) and, for development, by server/index.ts.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { ClaudeLimits, Snapshot } from '../shared/types.ts';
import { DEFAULT_SETTINGS, mergeSettings, type Settings } from '../shared/settings.ts';
import { Claude, parseHook } from './claude.ts';
import { limitsFrom } from './claudeStatus.ts';
import { Copilot } from './copilot.ts';
import { DesktopSessions } from './desktop.ts';
import { isRecord } from './session.ts';
import { createSharing } from './share.ts';
import { focusTerminal, resumeInTerminal } from './terminal.ts';

const IDLE_GRACE_MS = 15 * 1000;         // idle once no agent CLI process has been running this long
const MAX_HOOK_BYTES = 16 * 1024 * 1024; // hook payloads include tool input, e.g. a whole file being written
const MAX_PAGE_BYTES = 64 * 1024;
const SESSION_ID = /^[A-Za-z0-9-]{1,64}$/;
// Claude plan usage arrives with status line updates (electron/cli.ts statusline). The last one is kept in a temp
// file, so the air tanks show right away the next time the fishtank starts.
const LIMITS_FILE = path.join(os.tmpdir(), 'agent-fishtank-claude-limits.json');
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.wasm': 'application/wasm',
};

export const DEFAULT_PORT = 4321;

export interface ServerOptions {
  port: number;
  /** Where the tank is shared on the local network when that's turned on; the port after `port` by default. */
  sharePort?: number;
  /** The built page (Vite's dist/). */
  distDir: string;
  copilotSessionDir?: string;
  claudeConfigDir?: string;
  /** The Claude desktop app's sessions folder (server/desktop.ts), for testing. */
  claudeDesktopSessionsDir?: string;
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
  onSettings?: (settings: Settings) => void;
  /** Called with every snapshot sent to the page (once a second). */
  onSnapshot?: (snapshot: Snapshot) => void;
}

export interface Fishtank {
  url: string;
  /** Whether a Copilot CLI or Claude Code was running at the last check (every 5 s). */
  cliRunning(): boolean;
  settings(): Settings;
  stop(): void;
}

type Request = http.IncomingMessage;
type Response = http.ServerResponse;

// Our own cache file: a time is enough to tell it's what saveLimits wrote.
const isCachedLimits = (candidate: unknown): candidate is ClaudeLimits => isRecord(candidate) && typeof candidate.at === 'number';

const readCachedLimits = (): ClaudeLimits | null => {
  try {
    const limits: unknown = JSON.parse(fs.readFileSync(LIMITS_FILE, 'utf8'));
    if (isCachedLimits(limits)) return limits;
  } catch { /* none yet */ }
  return null;
};

const saveLimits = (limits: ClaudeLimits) => fs.writeFile(LIMITS_FILE, JSON.stringify(limits), () => { /* only a cache */ });

const readSettings = (settingsFile?: string) => {
  if (!settingsFile) return DEFAULT_SETTINGS;
  try { return mergeSettings(DEFAULT_SETTINGS, JSON.parse(fs.readFileSync(settingsFile, 'utf8'))); } catch { return DEFAULT_SETTINGS; }
};

const saveSettings = (settingsFile: string, settings: Settings) => {
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
};

const isJson = (request: Request) => (request.headers['content-type'] || '').startsWith('application/json');

const end = (response: Response, status: number) => { response.writeHead(status); response.end(); };

/** Collects a request's body; null if it's over `maxBytes`. */
const readBody = (request: Request, maxBytes: number, onEnd: (body: string | null) => void) => {
  const chunks: Buffer[] = [];
  let size = 0;
  request.on('data', (chunk: Buffer) => { size += chunk.length; if (size <= maxBytes) chunks.push(chunk); });
  request.on('end', () => onEnd(size <= maxBytes ? Buffer.concat(chunks).toString('utf8') : null));
};

// Claude Code hooks (and our status line) POST here. Always answer 204 with no body: a hook's response can steer
// Claude (e.g. allow or deny a tool), and the fishtank only watches. Requiring JSON keeps web pages from posting here,
// since browsers won't send that cross-origin without a CORS preflight we never approve.
const receive = (request: Request, response: Response, onBody: (body: string) => void) => {
  const hasJson = isJson(request);
  readBody(request, MAX_HOOK_BYTES, body => {
    end(response, 204);
    if (hasJson && body !== null) onBody(body);
  });
};

const isFromPage = (request: Request) => {
  let host = '';
  try { host = new URL(request.headers.origin || '').hostname; } catch { /* no origin */ }
  return isJson(request) && (host === '127.0.0.1' || host === 'localhost');
};

const parseBody = (body: string | null): unknown => {
  try { return body === null ? null : JSON.parse(body); } catch { return null; }
};

// The page posts settings changes and fish clicks here. Besides JSON (see above), only the fishtank's own page may:
// a request from anywhere but a localhost origin is refused.
const fromPage = (request: Request, response: Response, act: (body: unknown) => void | Promise<void>) => {
  if (!isFromPage(request)) { end(response, 403); request.resume(); return; }
  readBody(request, MAX_PAGE_BYTES, async text => {
    const body = parseBody(text);
    if (!body) { end(response, 400); return; }
    try { await act(body); } catch (error) { response.writeHead(500); response.end(String(error)); return; }
    end(response, 204);
  });
};

// Another device only watches: no settings, and no links or terminals to open from its fish.
const forViewers = (snapshot: Snapshot): Snapshot => ({
  ...snapshot, desktop: false, share: undefined, viewer: true,
  sessions: snapshot.sessions.map(({ link: _link, terminal: _terminal, ...session }) => session),
});

const messageOf = (snapshot: Snapshot, isViewer: boolean) => `data: ${JSON.stringify(isViewer ? forViewers(snapshot) : snapshot)}\n\n`;

const idFrom = (body: unknown) => isRecord(body) && typeof body.id === 'string' ? body.id : '';

const resumeCopilot = (copilot: Copilot, id: string) =>
  copilot.has(id) && SESSION_ID.test(id) ? resumeInTerminal(['copilot', '--resume', id], copilot.cwdOf(id)) : Promise.resolve(false);

/** Brings the terminal of the session { id } to the front; a Copilot session that has ended is resumed in a new one. */
const openSession = async ({ claude, copilot }: { claude: Claude; copilot: Copilot }, body: unknown) => {
  const id = idFrom(body);
  const pid = claude.pidOf(id) ?? copilot.pidOf(id);
  const isOpened = pid ? await focusTerminal(pid) : await resumeCopilot(copilot, id);
  if (!isOpened) throw new Error('No terminal found for this session');
};

const sendMissing = (relativePath: string, response: Response) => {
  if (relativePath !== '/index.html') { end(response, 404); return; }
  response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('The fishtank page is not built yet. Run: npm install && npm run build');
};

const serveStatic = (distFolder: string, url: string, response: Response) => {
  let relativePath: string;
  try { relativePath = decodeURIComponent(url === '/' ? '/index.html' : url); } catch { end(response, 400); return; }
  const file = path.join(distFolder, path.normalize(relativePath));
  if (!file.startsWith(distFolder + path.sep)) { end(response, 403); return; }
  fs.stat(file, (error, stats) => {
    if (error || !stats.isFile()) { sendMissing(relativePath, response); return; }
    const cache = relativePath.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    response.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': cache });
    fs.createReadStream(file).pipe(response);
  });
};

interface IdleWatchOptions extends Pick<ServerOptions, 'onIdle' | 'waitForCli' | 'keepRunning'> {
  claude: Claude;
  copilot: Copilot;
  settings: () => Settings;
  onShutdown: () => void;
}

/** Checks every 5 s whether a CLI runs, and calls onIdle once none has for a while. */
const watchIdle = ({ claude, copilot, settings, onShutdown, onIdle, waitForCli, keepRunning }: IdleWatchOptions) => {
  let lastCliSeen = Date.now(), hasSeenCli = false, isRunning = false, isIdle = false;
  const shouldQuit = () => !isIdle && !!onIdle && settings().quitWhenIdle && !keepRunning?.()
    && Date.now() - lastCliSeen >= IDLE_GRACE_MS && !(waitForCli && !hasSeenCli);
  const check = async () => {
    isRunning = claude.running() || await copilot.running();
    if (isRunning) { lastCliSeen = Date.now(); hasSeenCli = true; return; }
    if (!shouldQuit()) return;
    isIdle = true;
    onShutdown();
    onIdle?.();
  };
  const timer = setInterval(check, 5000);
  void check();
  return { isRunning: () => isRunning, resetGrace: () => { lastCliSeen = Date.now(); }, stop: () => clearInterval(timer) };
};

/** Starts the server; rejects with the listen error, e.g. EADDRINUSE when another fishtank already runs. */
export const startServer = (options: ServerOptions): Promise<Fishtank> => {
  const copilot = new Copilot(options.copilotSessionDir || path.join(os.homedir(), '.copilot', 'session-state'));
  const claude = new Claude(options.claudeConfigDir || path.join(os.homedir(), '.claude'), new DesktopSessions(options.claudeDesktopSessionsDir));
  let limits = readCachedLimits();
  let settings = readSettings(options.settingsFile);
  options.onSettings?.(settings);

  const distFolder = path.resolve(options.distDir);
  const clients = new Map<Response, boolean>(); // each page and whether it's a viewer on another device
  const takeSnapshot = (): Snapshot => {
    const now = Date.now();
    return {
      sessions: [...copilot.list(now), ...claude.list(now)], time: now, quota: copilot.quota, limits, settings,
      desktop: !!options.desktop, share: sharing.share(),
    };
  };
  const broadcast = (snapshot: Snapshot) => {
    const messages = [false, true].map(isViewer => messageOf(snapshot, isViewer));
    for (const [client, isViewer] of clients) client.write(messages[Number(isViewer)]);
  };
  const changeSettings = (change: unknown) => {
    settings = mergeSettings(settings, change);
    idleWatch.resetGrace(); // e.g. turning "quit after the last session" back on doesn't quit right away
    if (options.settingsFile) saveSettings(options.settingsFile, settings);
    sharing.update(settings.shareOnNetwork);
    options.onSettings?.(settings);
    broadcast(takeSnapshot());
  };
  const subscribe = (request: Request, response: Response, isViewer = false) => {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    response.write(messageOf(takeSnapshot(), isViewer));
    clients.set(response, isViewer);
    request.on('close', () => clients.delete(response));
  };
  const sharing = createSharing({
    port: options.sharePort ?? options.port + 1,
    keyFile: options.settingsFile && path.join(path.dirname(options.settingsFile), 'agent-fishtank-share-key'),
    subscribe: (request, response) => subscribe(request, response, true),
    serveFile: (url, response) => serveStatic(distFolder, url, response),
    onChange: () => broadcast(takeSnapshot()),
  });
  sharing.update(settings.shareOnNetwork);

  const tick = setInterval(() => {
    copilot.poll();
    claude.poll();
    const snapshot = takeSnapshot();
    broadcast(snapshot);
    options.onSnapshot?.(snapshot);
  }, 1000);
  copilot.poll();
  claude.poll();
  if (!copilot.quota) copilot.seedQuota();

  const idleWatch = watchIdle({
    ...options, claude, copilot, settings: () => settings,
    onShutdown: () => { for (const client of clients.keys()) client.write('event: shutdown\ndata: {}\n\n'); },
  });

  const postRoutes: Record<string, (request: Request, response: Response) => void> = {
    '/hook/claude': (request, response) => receive(request, response, body => { const event = parseHook(body); if (event) claude.handle(event); }),
    '/statusline/claude': (request, response) => receive(request, response, body => {
      const update = limitsFrom(body, Date.now());
      if (update) { limits = update; saveLimits(update); }
    }),
    '/settings': (request, response) => fromPage(request, response, changeSettings),
    '/open': (request, response) => fromPage(request, response, body => openSession({ claude, copilot }, body)),
  };
  const server = http.createServer((request, response) => {
    const url = (request.url || '/').split('?')[0];
    if (request.method === 'POST' && Object.hasOwn(postRoutes, url)) return postRoutes[url](request, response);
    if (url === '/events') return subscribe(request, response);
    serveStatic(distFolder, url, response);
  });

  return new Promise((resolve, reject) => {
    const stop = () => {
      clearInterval(tick); idleWatch.stop(); sharing.stop();
      for (const client of clients.keys()) client.end();
      server.close();
    };
    server.once('error', error => { stop(); reject(error); });
    server.listen(options.port, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${options.port}/`, cliRunning: idleWatch.isRunning, settings: () => settings, stop }));
  });
};
