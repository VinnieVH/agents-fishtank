import { Application, Container, Sprite, Texture } from 'pixi.js';
import './style.css';
import { paintTerrain, sandY } from './art/terrain';
import { connect, renderPanel, setSkyText, type Session, type Snapshot } from './panel';
import { credits } from './credits';
import { airTanks } from './limits';
import { Fish } from './scene/fish';
import { SkyOverlay } from './scene/sky';
import { Water } from './scene/water';
import { Passersby } from './scene/passersby';
import { Gauge } from './scene/gauge';
import { AirTanks } from './scene/tanks';
import { Crab } from './scene/crab';
import { Food } from './scene/food';
import { lightFor, locationFromParams, makeClock, sunPosition, type Light } from './sky';
import { SpeciesStore } from './species';
import { paintTexture } from './art/canvas';

const params = new URLSearchParams(location.search);
const res = Math.min(2, devicePixelRatio || 1);

const app = new Application();
await app.init({ resizeTo: window, background: '#01101f', antialias: true, resolution: res, autoDensity: true });
document.body.prepend(app.canvas);

// layers, back to front
const terrain = new Sprite();
const passersby = new Passersby(performance.now(), params, res);
const water = new Water();
const sky = new SkyOverlay();
const fishLayer = new Container({ sortableChildren: true });
const marksLayer = new Container();
const gauge = new Gauge(res);
const crab = new Crab(res, params);
const food = new Food(res);
const tanks = new AirTanks(res);
app.stage.addChild(terrain, passersby, water.rays, water.shimmer, water.backWeeds, water.anemones, water.bubbles, food,
  sky, water.anemoneTips, water.plankton, fishLayer, marksLayer, water.frontWeeds, tanks, crab, gauge);

let W = 0, H = 0, gold = 1, gems = 5;
function paintBackdrop() {
  const old = terrain.texture;
  terrain.texture = paintTexture(W, H, res, g => paintTerrain(g, W, H, gold, gems));
  if (old !== Texture.EMPTY) old.destroy(true);
}
function resize() {
  W = app.screen.width; H = app.screen.height;
  paintBackdrop();
  water.build(W, H);
  sky.resize(W, H);
  gauge.layout(W, H);
  tanks.layout(W, H);
}
app.renderer.on('resize', resize);
resize();

// ---------- sessions -> fish ----------
const fish = new Map<string, Fish>();
let sessions = new Map<string, Session>();
const species = new SpeciesStore(localStorage);

function sync(data: Snapshot) {
  sessions = new Map(data.sessions.map(s => [s.id, s]));
  const wanted = new Set<string>();
  const bottom = sandY(H) - 40;
  const add = (key: string, sessionId: string, small: boolean, near?: Fish) => {
    const bigOnes = [...fish.values()].filter(f => !f.small).map(f => f.species);
    const sp = small && fish.get(sessionId) ? fish.get(sessionId)!.species : species.get(sessionId, bigOnes);
    const f = new Fish(key, sessionId, small, sp, W, bottom, res, near);
    fish.set(key, f); fishLayer.addChild(f.body); marksLayer.addChild(f.marks);
    crab.scare();
    return f;
  };
  for (const s of data.sessions) {
    wanted.add(s.id);
    const parent = fish.get(s.id) ?? add(s.id, s.id, false);
    parent.setLabel(s.name.length > 28 ? s.name.slice(0, 27) + '…' : s.name);
    for (const a of s.subagents) {
      if (a.status !== 'running') continue;
      const k = s.id + ':' + a.id; wanted.add(k);
      (fish.get(k) ?? add(k, s.id, true, parent)).setLabel(a.name);
    }
  }
  for (const [k, f] of fish) if (!wanted.has(k)) { f.destroy(); fish.delete(k); }
  species.prune(new Set(data.sessions.map(s => s.id)));
  renderPanel(data, id => fish.get(id)?.neon ?? '#fff');

  // credits: the pressure gauge, and the gold and gems in the treasure chest (repainted only when they change)
  const c = credits(data.quota);
  gauge.set(c);
  const g = c ? c.gold : 1, s = c ? c.gems : 5;
  if (g !== gold || s !== gems) { gold = g; gems = s; paintBackdrop(); }

  // Claude plan usage: the diver's air tanks
  tanks.set(airTanks(data.limits, data.time));
}
connect(sync);

// ---------- feeding: click the water to drop a pinch of food; the nearest fish that isn't eating yet comes for it ----------
app.canvas.style.cursor = 'pointer';
app.canvas.addEventListener('pointerdown', e => {
  const r = app.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (y > sandY(H)) return; // not in the sand
  const pinch = food.drop(x, y);
  const all = [...fish.values()], free = all.filter(f => !f.meal);
  const pick = (free.length ? free : all).reduce<Fish | null>((a, f) => !a || Math.hypot(f.x - x, f.y - y) < Math.hypot(a.x - x, a.y - y) ? f : a, null);
  if (pick) pick.meal = pinch;
});

// ---------- day / night: follows the real sun for this PC's clock and timezone ----------
// Location is estimated from the timezone; override with ?lat=51.05&lon=3.72. Preview with ?time=21:30 or ?timelapse.
const clock = makeClock(params), where = locationFromParams(params), timelapse = params.has('timelapse');
let light: Light = lightFor(90, 0), lastSky = -Infinity;
function updateLight() {
  const d = clock(), { el, ha } = sunPosition(d, where);
  light = lightFor(el, ha);
  setSkyText(`${light.phase} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
}

// ---------- animation ----------
app.ticker.add(ticker => {
  const t = performance.now(), dt = Math.min(3, ticker.deltaMS / 16.7);
  if (t - lastSky > 1000 || timelapse) { updateLight(); lastSky = t; sky.update(light); }
  const busy = [...sessions.values()].some(s => s.state === 'working');
  const calm = [...sessions.values()].every(s => s.state === 'idle'); // also true with no sessions at all

  passersby.update(t, dt, W, H);
  gauge.update(t, dt);
  tanks.update(t, dt);
  crab.update(t, dt, W, H, calm, light.night);
  food.update(t, dt, sandY(H) + 6);
  water.update(t, dt, busy, light.day, light.night);
  const tank = { t, dt, right: W, bottom: sandY(H) - 40, night: light.night };
  for (const f of fish.values()) f.update(tank, sessions.get(f.sessionId)?.state ?? 'idle', f.small ? fish.get(f.sessionId) : undefined);
});
