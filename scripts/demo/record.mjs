// Records the website's demo video (site/demo.mp4) from the real tank, frame by frame.
//
//   npm run build && node scripts/demo/record.mjs                 # writes site/demo.mp4
//   node scripts/demo/record.mjs --stills 3,8,11,17,22 out-dir    # a few PNGs to check the composition
//
// Needs Google Chrome and ffmpeg (set CHROME / FFMPEG if they aren't in the usual place or on PATH).
// stage.html holds the story: the sessions, terminal and mouse over time.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../..'), dist = path.join(root, 'dist');
const FPS = 30, W = 1600, H = 900, PORT = 4388, DEBUG_PORT = 9288;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

const args = process.argv.slice(2);
const stills = args[0] === '--stills' ? args[1].split(',').map(Number) : null;
const out = path.resolve(stills ? args[2] || '.' : args[0] || path.join(root, 'site/demo.mp4'));
if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Run `npm run build` first: the demo films dist/.');

// ---- the pages: the stage, and the built tank with clock.js loaded before its own code ----
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x').pathname;
  let file = url === '/' ? path.join(here, 'stage.html') : url === '/clock.js' ? path.join(here, 'clock.js') : path.join(dist, url);
  if (!file.startsWith(here) && !file.startsWith(dist)) { res.writeHead(403).end(); return; }
  if (url === '/tank.html') {
    const page = fs.readFileSync(path.join(dist, 'index.html'), 'utf8').replace('<head>', '<head><script src="/clock.js"></script>');
    res.writeHead(200, { 'content-type': 'text/html' }).end(page);
    return;
  }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
  });
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

// ---- Chrome, with a fresh profile so nothing (like the fish species) carries over from an earlier run ----
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-demo-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${W},${H}`,
  `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let target;
for (let i = 0; i < 80 && !target; i++) {
  await sleep(250);
  try { target = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: 'PUT' })).json(); } catch {}
}
if (!target) throw new Error(`Chrome didn't start (${CHROME})`);
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); pending.delete(m.id); };
await new Promise(r => { ws.onopen = r; });
const send = (method, params = {}) => new Promise((resolve, reject) => {
  pending.set(++id, m => m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result));
  ws.send(JSON.stringify({ id, method, params }));
});
const run = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
const shot = async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64');

async function finish(code) {
  ws.close(); server.close();
  await new Promise(r => { chrome.once('exit', r); chrome.kill(); });
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  process.exit(code);
}

try {
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${process.env.SEED ? '?seed=' + process.env.SEED : ''}` }); // SEED=3 to try another
  for (let i = 0; !(await run('!!window.__ready && window.__ready()').catch(() => false)); i++) {
    if (i > 120) throw new Error('The tank never loaded');
    await sleep(250);
  }
  await run('__warm()');
  const length = await run('__length');

  if (stills) {
    fs.mkdirSync(out, { recursive: true });
    for (let f = 0, i = 0; i < stills.length; f++) {
      const t = f / FPS;
      await run(`__frame(${t})`);
      if (t >= stills[i]) { fs.writeFileSync(path.join(out, `t${stills[i]}.png`), await shot()); i++; }
    }
    console.log(`Stills in ${out}`);
  } else {
    // H.264 in yuv420p with the index up front: plays everywhere, including Safari, and starts before it's all loaded
    const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '31', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((resolve, reject) => ff.on('close', c => c ? reject(new Error(`ffmpeg exited with ${c}`)) : resolve()));
    const frames = Math.round(length * FPS);
    for (let f = 0; f < frames; f++) {
      await run(`__frame(${f / FPS})`);
      if (!ff.stdin.write(await shot())) await new Promise(r => ff.stdin.once('drain', r));
      if (f % FPS === 0) process.stdout.write(`\r${f / FPS}s / ${length}s`);
    }
    ff.stdin.end();
    await done;
    console.log(`\n${out}: ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
  }
  finish(0);
} catch (err) {
  console.error(err);
  finish(1);
}
