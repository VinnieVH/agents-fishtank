// Tails Copilot CLI session logs and streams agent activity to the fishtank page.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const PORT = Number(process.env.FISHTANK_PORT) || 4321;
const ROOT = process.env.COPILOT_SESSION_DIR || path.join(os.homedir(), '.copilot', 'session-state');
const RECENT_MS = 60 * 60 * 1000;      // show sessions active in the last hour
const STALE_MS = 15 * 60 * 1000;       // "working" with no events for this long -> idle
const DONE_SUBAGENT_MS = 10 * 60 * 1000; // keep finished subagents in the list this long
const EXIT_GRACE_MS = 15 * 1000;       // exit after no Copilot CLI process has been running this long
const KEEP_ALIVE = process.env.FISHTANK_KEEP_ALIVE === '1';

// id -> { offset, partial, state, lastEvent, subagents: Map, title, name, nameMtime }
const sessions = new Map();

const WORKING = new Set([
  'user.message', 'assistant.turn_start', 'assistant.message', 'model.turn_started',
  'model.model_call_started', 'model.response', 'tool.execution_complete',
  'permission.completed', 'human_response.recorded', 'session.compaction_start',
  'skill.invoked', 'subagent.started',
]);
const IDLE = new Set(['assistant.turn_end', 'abort', 'session.shutdown', 'session.task_complete']);

function applyEvent(s, ev) {
  const t = ev.type;
  const d = ev.data || {};
  const ts = Date.parse(ev.timestamp) || Date.now();
  s.lastEvent = Math.max(s.lastEvent, ts);
  if (t === 'tool.execution_start') {
    s.state = d.toolName === 'ask_user' ? 'waiting' : 'working';
  } else if (t === 'permission.requested') {
    s.state = 'waiting';
  } else if (WORKING.has(t)) {
    s.state = 'working';
  } else if (IDLE.has(t)) {
    s.state = 'idle';
  }

  const id = d.toolCallId || d.agentId || ev.id;
  if (t === 'subagent.started') {
    s.subagents.set(id, {
      id, name: d.agentDisplayName || d.agentName || 'subagent', type: d.agentType || d.agentName || '',
      description: d.agentDescription || '', model: d.model || '', status: 'running', start: ts, end: 0,
    });
  } else if (t === 'subagent.completed' || t === 'subagent.failed') {
    const a = s.subagents.get(id);
    if (a) { a.status = t === 'subagent.failed' ? 'failed' : 'done'; a.end = ts; }
  } else if (t === 'session.shutdown' || t === 'abort') {
    for (const a of s.subagents.values()) if (a.status === 'running') { a.status = 'stopped'; a.end = ts; }
  }

  if (t === 'user.message' && !s.title && typeof d.content === 'string') {
    s.title = d.content.replace(/\s+/g, ' ').slice(0, 60);
  }
}

function readName(id, s) {
  const file = path.join(ROOT, id, 'workspace.yaml');
  let st;
  try { st = fs.statSync(file); } catch { return; }
  if (st.mtimeMs === s.nameMtime) return;
  s.nameMtime = st.mtimeMs;
  const m = /^name:\s*(.+)$/m.exec(fs.readFileSync(file, 'utf8'));
  if (m) s.name = m[1].trim().replace(/^(['"])(.*)\1$/, '$2').replace(/''/g, "'");
}

function readSession(id) {
  const file = path.join(ROOT, id, 'events.jsonl');
  let st;
  try { st = fs.statSync(file); } catch { return; }
  if (!sessions.has(id)) {
    if (Date.now() - st.mtimeMs > RECENT_MS) return;
    sessions.set(id, { offset: 0, partial: '', state: 'idle', lastEvent: 0, subagents: new Map(), title: '', name: '', nameMtime: 0 });
  }
  const s = sessions.get(id);
  readName(id, s);
  if (st.size < s.offset) { s.offset = 0; s.partial = ''; s.subagents.clear(); }
  if (st.size === s.offset) return;
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(st.size - s.offset);
  fs.readSync(fd, buf, 0, buf.length, s.offset);
  fs.closeSync(fd);
  s.offset = st.size;
  const lines = (s.partial + buf.toString('utf8')).split('\n');
  s.partial = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try { applyEvent(s, JSON.parse(line)); } catch { /* ignore malformed line */ }
  }
}

function snapshot() {
  const now = Date.now();
  const list = [];
  for (const [id, s] of sessions) {
    if (now - s.lastEvent > RECENT_MS) continue;
    const stale = now - s.lastEvent > STALE_MS;
    const subagents = [];
    for (const a of s.subagents.values()) {
      const status = a.status === 'running' && stale ? 'stopped' : a.status;
      if (status !== 'running' && now - (a.end || s.lastEvent) > DONE_SUBAGENT_MS) continue;
      subagents.push({ ...a, status });
    }
    const running = subagents.some(a => a.status === 'running');
    let state = s.state;
    if (state === 'idle' && running) state = 'working'; // background subagents still running
    if (state === 'working' && stale) state = 'idle';
    list.push({ id, state, name: s.name || s.title || id.slice(0, 8), subagents, lastEvent: s.lastEvent });
  }
  return { sessions: list, time: now };
}

function poll() {
  let dirs = [];
  try { dirs = fs.readdirSync(ROOT, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); } catch { /* dir missing */ }
  for (const id of dirs) readSession(id);
}

const clients = new Set();
setInterval(() => {
  poll();
  const msg = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const res of clients) res.write(msg);
}, 1000);
poll();

// Each live CLI session holds an inuse.<pid>.lock file; the PID is the copilot process.
function lockPids() {
  const pids = new Set();
  let dirs = [];
  try { dirs = fs.readdirSync(ROOT, { withFileTypes: true }).filter(d => d.isDirectory()); } catch { return pids; }
  for (const d of dirs) {
    let files = [];
    try { files = fs.readdirSync(path.join(ROOT, d.name)); } catch { continue; }
    for (const f of files) { const m = /^inuse\.(\d+)\.lock$/.exec(f); if (m) pids.add(Number(m[1])); }
  }
  return pids;
}

function copilotRunning(cb) {
  const pids = lockPids();
  if (!pids.size) return cb(false);
  if (process.platform !== 'win32') {
    return cb([...pids].some(p => { try { process.kill(p, 0); return true; } catch { return false; } }));
  }
  // Verify the image name too, so a stale lock whose PID got reused doesn't keep us alive.
  execFile('tasklist', ['/FO', 'CSV', '/NH', '/FI', 'IMAGENAME eq copilot*'], { windowsHide: true }, (err, out) => {
    if (err) return cb(true);
    cb(out.split(/\r?\n/).some(line => { const c = line.split('","'); return c.length > 1 && pids.has(Number(c[1])); }));
  });
}

let lastCopilotSeen = Date.now();
if (!KEEP_ALIVE) {
  setInterval(() => copilotRunning(alive => {
    if (alive) { lastCopilotSeen = Date.now(); return; }
    if (Date.now() - lastCopilotSeen < EXIT_GRACE_MS) return;
    console.log('No Copilot CLI running, shutting down fishtank.');
    for (const res of clients) res.write('event: shutdown\ndata: {}\n\n');
    setTimeout(() => process.exit(0), 300);
  }), 5000);
}

http.createServer((req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
    return;
  }
  res.writeHead(404); res.end();
}).on('error', err => {
  if (err.code === 'EADDRINUSE') { console.log(`Port ${PORT} is already in use (fishtank already running?).`); process.exit(0); }
  throw err;
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Copilot fishtank: http://localhost:${PORT}  (watching ${ROOT})`);
});
