// Renders every creature to site/creatures/<species>.png for the website's creatures page, with the app's own
// drawing code (src/art/fishArt.ts), so the pictures always match the tank.
//
//   node scripts/demo/creatures.mjs
//
// Needs Google Chrome (set CHROME if it isn't in the usual place).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'site/creatures');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 5188, DEBUG_PORT = 9289;

const vite = await createServer({ root, server: { port: PORT, strictPort: true }, logLevel: 'error' });
await vite.listen();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fishtank-creatures-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
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
ws.onmessage = e => { const m = JSON.parse(e.data); pending.get(m.id)?.(m); };
await new Promise(r => { ws.onopen = r; });
const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });

try {
  await send('Page.navigate', { url: `http://localhost:${PORT}/creatures.html` });
  await sleep(3000);
  // each creature in its first colour variant, with a glow of its own
  const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const { paintFish } = await import('/src/art/fishArt.ts');
    const { ALL_SPECIES, NEON } = await import('/src/species.ts');
    const spots = Array.from({ length: 6 }, (_, k) => ({ x: Math.sin(k * 2.1) * .7, y: Math.cos(k * 1.3) * .3, rx: .15, ry: .1, rot: k }));
    return ALL_SPECIES.map((species, i) => {
      const t = paintFish({ species, small: false, body: ['#ff7a3d', '#3dc8ff', '#9b5cff', '#ffcf3d'][i % 4], neon: NEON[(i * 5) % NEON.length], pattern: 0, variant: 0, spots }, 90, 2);
      const c = document.createElement('canvas'); c.width = t.width * 2; c.height = t.height * 2;
      c.getContext('2d').drawImage(t.halo.source.resource, 0, 0); c.getContext('2d').drawImage(t.body.source.resource, 0, 0);
      return { species, png: c.toDataURL('image/png') };
    });
  })()` });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
  fs.mkdirSync(out, { recursive: true });
  for (const { species, png } of r.result.result.value) fs.writeFileSync(path.join(out, species + '.png'), Buffer.from(png.split(',')[1], 'base64'));
  console.log(`${r.result.result.value.length} creatures in ${path.relative(root, out)}/`);
} finally {
  ws.close(); chrome.kill(); await vite.close();
  await sleep(300); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
}
