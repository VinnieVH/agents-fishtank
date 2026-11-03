import { Application, Container, Sprite, Texture } from 'pixi.js';
import './style.css';
import { FLOOR_REACH, paintFloor, paintTerrain, paintWater, sandLineFor } from './art/terrain';
import { connect, renderPanel, renderUsage, setSky, type Session, type Snapshot } from './panel';
import { credits } from './credits';
import { airTanks } from './limits';
import { Fish, type Tank } from './scene/fish';
import { SkyOverlay } from './scene/sky';
import { Water, type WaterFrame } from './scene/water';
import { Passersby, type VisitorFrame } from './scene/passersby';
import { Gauge } from './scene/gauge';
import { AirTanks } from './scene/tanks';
import { Crab, type CrabFrame } from './scene/crab';
import { Food } from './scene/food';
import { lightFor, locationFromParams, makeClock, sunPosition, type Light } from './sky';
import { SpeciesStore } from './species';
import { paintTexture } from './art/canvas';
import { showSettings } from './settings';
import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';

const params = new URLSearchParams(location.search);
const resolution = Math.min(2, devicePixelRatio || 1);

const app = new Application();
const tankEl = document.getElementById('tank')!; // the whole window, or its right side next to the terminals
await app.init({ resizeTo: tankEl, background: '#01101f', antialias: true, resolution, autoDensity: true });
tankEl.append(app.canvas);

// layers, back to front
const sea = new Sprite(); // the open water and the canyon far off, behind the current; the hills and the wreck are in front of it
const terrain = new Sprite();
const floor = new Sprite(); // the reef and the chest: in front of the soft corals
const passersby = new Passersby(performance.now(), params, resolution);
const water = new Water();
const sky = new SkyOverlay();
const fishLayer = new Container({ sortableChildren: true });
const marksLayer = new Container();
const gauge = new Gauge(resolution);
const crab = new Crab(resolution);
const food = new Food(resolution);
const tanks = new AirTanks(resolution);
app.stage.addChild(sea, water.current, terrain, passersby, water.rays, water.shimmer, water.softCorals, floor, water.anemones, water.bubbles, food,
  sky, passersby.glows, water.anemoneTips, water.plankton, fishLayer, marksLayer, tanks, crab, gauge);

let tankWidth = 0, tankHeight = 0, gold = 1, gems = 5;

/** The floor's things: on resize, and when the chest's gold changes. */
const paintFloorLayer = () => {
  const old = floor.texture, top = sandLineFor(tankHeight) - FLOOR_REACH;
  floor.texture = paintTexture({ w: tankWidth, h: tankHeight - top }, resolution, g => paintFloor(g, { width: tankWidth, height: tankHeight }, { gold, gems }));
  floor.y = top;
  if (old !== Texture.EMPTY) old.destroy(true);
};
const paintBackdrop = () => {
  const oldSea = sea.texture;
  sea.texture = paintTexture({ w: tankWidth, h: tankHeight }, resolution, g => paintWater(g, tankWidth, tankHeight));
  if (oldSea !== Texture.EMPTY) oldSea.destroy(true);
  const old = terrain.texture;
  terrain.texture = paintTexture({ w: tankWidth, h: tankHeight }, resolution, g => paintTerrain(g, tankWidth, tankHeight));
  if (old !== Texture.EMPTY) old.destroy(true);
  paintFloorLayer();
};
const resize = () => {
  tankWidth = app.screen.width; tankHeight = app.screen.height;
  paintBackdrop();
  water.build(tankWidth, tankHeight, app.renderer);
  sky.resize(tankWidth, tankHeight);
  gauge.layout(tankWidth, tankHeight);
  tanks.layout(tankWidth, tankHeight);
};
// repainting all of that takes a moment, too long to do for every step of a resize: the tank is covered while it's
// being resized (and while the divider is held) and painted once, when it stops
const cover = document.getElementById('resizing')!;
const COVER_BUBBLES = 36;
for (let index = 0; index < COVER_BUBBLES; index++) { // its bubbles, already on their way up when it shows
  const bubble = document.createElement('i'), rise = 3 + Math.random() * 4;
  bubble.style.cssText = `--x:${(index + Math.random()) / COVER_BUBBLES * 100}%;--s:${5 + Math.random() ** 2 * 28}px;--t:${rise}s;--d:${-Math.random() * rise}s;--w:${(Math.random() - .5) * 28}px`;
  cover.append(bubble);
}
let settle = 0;
const settleResize = () => {
  if (document.querySelector('#split.drag')) { settle = window.setTimeout(settleResize, 150); return; }
  resize();
  // uncovered once the new backdrop has been drawn (and sent to the GPU) a frame later
  requestAnimationFrame(() => requestAnimationFrame(() => cover.classList.remove('on')));
};
const resized = () => {
  cover.style.setProperty('--night', String(light.night));
  cover.classList.add('on');
  clearTimeout(settle);
  settle = window.setTimeout(settleResize, 200);
};
app.renderer.on('resize', resized);
resize();

const allFish = new Map<string, Fish>();
let sessions = new Map<string, Session>();
const species = new SpeciesStore(localStorage);
const fishBottom = () => sandLineFor(tankHeight) - 40;

const addFish = (fish: Fish) => {
  allFish.set(fish.key, fish); fishLayer.addChild(fish.body); marksLayer.addChild(fish.marks);
  crab.scare();
  return fish;
};
const addSessionFish = (sessionId: string) => {
  const bigOnes = [...allFish.values()].filter(fish => !fish.small).map(fish => ({ species: fish.species, neon: fish.neon }));
  return addFish(new Fish({ key: sessionId, sessionId, small: false, look: species.get(sessionId, bigOnes), tankWidth, bottom: fishBottom(), resolution }));
};
const addSubagentFish = (key: string, sessionId: string, parent: Fish) => {
  const look = { species: parent.species, neon: parent.neon };
  return addFish(new Fish({ key, sessionId, small: true, look, tankWidth, bottom: fishBottom(), resolution, near: parent }));
};

/** A session carrying on another one (after a /clear) takes over its fish. */
const handOverFish = (snapshotSessions: Session[]) => {
  for (const session of snapshotSessions) {
    const fish = session.was ? allFish.get(session.was) : undefined;
    if (!fish || allFish.has(session.id)) continue;
    allFish.delete(fish.key); species.move(fish.key, session.id);
    fish.key = fish.sessionId = session.id; allFish.set(session.id, fish);
  }
};

/** Adds and labels a fish for every session and running subagent; returns the keys of all fish still wanted. */
const updateFish = (snapshotSessions: Session[]) => {
  const wanted = new Set<string>();
  for (const session of snapshotSessions) {
    wanted.add(session.id);
    const parent = allFish.get(session.id) ?? addSessionFish(session.id);
    parent.setLabel(session.name.length > 28 ? session.name.slice(0, 27) + '…' : session.name);
    for (const subagent of session.subagents) {
      if (subagent.status !== 'running') continue;
      const key = session.id + ':' + subagent.id; wanted.add(key);
      (allFish.get(key) ?? addSubagentFish(key, session.id, parent)).setLabel(subagent.name);
    }
  }
  return wanted;
};

/** The pressure gauge, and the gold and gems in the treasure chest (repainted only when they change). */
const showCredits = (quota: Snapshot['quota']) => {
  const chest = credits(quota);
  gauge.set(chest);
  const nextGold = chest ? chest.gold : 1, nextGems = chest ? chest.gems : 5;
  if (nextGold !== gold || nextGems !== gems) { gold = nextGold; gems = nextGems; paintFloorLayer(); }
};

// settings (the dialog in settings.ts); options in the URL win, e.g. ?time=21:30 for screenshots
const AMBIENT = { full: 1, calm: .35, minimal: .1 }; // how fast the water and light move
const SWIM = { full: 1, calm: .75, minimal: .5 };    // and the fish, the crab and the visitors (none at minimal)
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let settings: Settings | null = null, desktop = false, motion: keyof typeof AMBIENT = 'full';

// day / night follows the real sun for this PC's clock and timezone.
// Location is estimated from the timezone; override with ?lat=51.05&lon=3.72. Preview with ?time=21:30 or ?timelapse.
let clock = makeClock(params), where = locationFromParams(params);
const timelapse = params.has('timelapse');
let light: Light = lightFor(90, 0), lastSky = -Infinity, ambientT = 0;

/** The sun: a fixed time for always day or night, the location if given. */
const skyParams = (next: Settings) => {
  const sunParams = new URLSearchParams(params);
  if (!sunParams.has('time') && !sunParams.has('timelapse') && next.daylight !== 'sun') sunParams.set('time', next.daylight === 'day' ? '13:00' : '23:30');
  if (next.location && !sunParams.has('lat') && !sunParams.has('lon')) {
    sunParams.set('lat', String(next.location.lat)); sunParams.set('lon', String(next.location.lon));
  }
  return sunParams;
};
const setMotion = () => {
  const chosen = settings?.motion ?? 'auto';
  motion = chosen === 'auto' ? (reducedMotion.matches ? 'calm' : 'full') : chosen;
  document.body.classList.toggle('still', motion === 'minimal');
  passersby.enabled = (settings?.visitors ?? true) && motion !== 'minimal';
};
const applySettings = (next: Settings, isDesktop: boolean) => {
  if (settings && JSON.stringify(next) === JSON.stringify(settings) && isDesktop === desktop) return;
  settings = next; desktop = isDesktop;
  showSettings(next, isDesktop);
  const sunParams = skyParams(next);
  clock = makeClock(sunParams); where = locationFromParams(sunParams); lastSky = -Infinity;
  crab.always = next.crabAlways || params.has('crab');
  setMotion();
};
reducedMotion.addEventListener('change', setMotion);

const sync = (snapshot: Snapshot) => {
  applySettings(snapshot.settings ?? DEFAULT_SETTINGS, !!snapshot.desktop);
  sessions = new Map(snapshot.sessions.map(session => [session.id, session]));
  handOverFish(snapshot.sessions);
  const wanted = updateFish(snapshot.sessions);
  for (const [key, fish] of allFish) if (!wanted.has(key)) { fish.destroy(); allFish.delete(key); }
  species.prune(new Set(snapshot.sessions.map(session => session.id)));
  renderPanel(snapshot, id => allFish.get(id)?.neon ?? '#fff');
  showCredits(snapshot.quota);
  // Claude plan usage: the diver's air tanks, and the numbers in the panel
  const air = airTanks(snapshot.limits, snapshot.time);
  tanks.set(air);
  renderUsage(air);
};
connect(sync);

/** The session whose fish (or subagent fish) is at (x, y) and can be opened; the biggest fish wins, as it's drawn on top. */
const sessionAt = (x: number, y: number) => {
  let best: { size: number; session: Session } | undefined;
  for (const fish of allFish.values()) {
    const session = sessions.get(fish.sessionId);
    if (session && (session.link || session.terminal) && fish.hit(x, y) && (!best || fish.size > best.size)) best = { size: fish.size, session };
  }
  return best?.session;
};

/** Opens a session: in the Claude desktop app, or by bringing its terminal to the front. */
const openSession = (session: Session) => {
  if (session.link) { location.href = session.link; return; } // the desktop app catches the navigation (electron/main.ts)
  void fetch('/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: session.id }) });
};

/** The nearest fish that isn't eating yet, or the nearest one if they all are. */
const hungriestNear = (x: number, y: number) => {
  const all = [...allFish.values()], free = all.filter(fish => !fish.meal);
  const distance = (fish: Fish) => Math.hypot(fish.x - x, fish.y - y);
  return (free.length ? free : all).reduce<Fish | null>((nearest, fish) => !nearest || distance(fish) < distance(nearest) ? fish : nearest, null);
};

// clicking a fish opens its session; clicking the water drops a pinch of food
app.canvas.style.cursor = 'pointer';
app.canvas.addEventListener('pointerdown', event => {
  const bounds = app.canvas.getBoundingClientRect(), x = event.clientX - bounds.left, y = event.clientY - bounds.top;
  const session = sessionAt(x, y);
  if (session) { openSession(session); return; }
  if (y > sandLineFor(tankHeight)) return; // not in the sand
  const pinch = food.drop(x, y);
  const eater = hungriestNear(x, y);
  if (eater) eater.meal = pinch;
});

const updateLight = () => {
  const now = clock(), { elevation, hourAngle } = sunPosition(now, where);
  light = lightFor(elevation, hourAngle);
  setSky(light.phase, now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
};

// what the frame loop hands the scene each frame, refilled rather than made anew so a frame allocates nothing
const visitorFrame: VisitorFrame = { t: 0, deltaFrames: 0, width: 0, height: 0, night: 0 };
const crabFrame: CrabFrame = { t: 0, deltaFrames: 0, width: 0, height: 0, calm: false, night: 0 };
const waterFrame: WaterFrame = { t: 0, deltaFrames: 0, isBusy: false, day: 0, night: 0 };
const tank: Tank = { t: 0, deltaFrames: 0, right: 0, bottom: 0, night: 0 };

app.ticker.add(ticker => {
  const t = performance.now(), dt = Math.min(3, ticker.deltaMS / 16.7);
  // the scenery runs on its own clock, slowed down by the animation setting
  const ambientSpeed = AMBIENT[motion], swimSpeed = SWIM[motion];
  ambientT += ticker.deltaMS * ambientSpeed;
  if (t - lastSky > 1000 || timelapse) { updateLight(); lastSky = t; sky.update(light); }
  const busy = [...sessions.values()].some(session => session.state === 'working');
  const calm = [...sessions.values()].every(session => session.state === 'idle'); // also true with no sessions at all

  visitorFrame.t = t; visitorFrame.deltaFrames = dt * swimSpeed; visitorFrame.width = tankWidth; visitorFrame.height = tankHeight;
  visitorFrame.night = light.night;
  passersby.update(visitorFrame);
  gauge.update(t, dt, light.night);
  tanks.update(t, dt, light.night);
  crabFrame.t = t; crabFrame.deltaFrames = dt * swimSpeed; crabFrame.width = tankWidth; crabFrame.height = tankHeight;
  crabFrame.calm = calm; crabFrame.night = light.night;
  crab.update(crabFrame);
  food.update(t, dt, sandLineFor(tankHeight) + 6);
  waterFrame.t = ambientT; waterFrame.deltaFrames = dt * ambientSpeed; waterFrame.isBusy = busy; waterFrame.day = light.day;
  waterFrame.night = light.night;
  water.update(waterFrame);
  tank.t = t; tank.deltaFrames = dt * swimSpeed; tank.right = tankWidth; tank.bottom = sandLineFor(tankHeight) - 40; tank.night = light.night;
  for (const fish of allFish.values()) fish.update(tank, sessions.get(fish.sessionId)?.state ?? 'idle', fish.small ? allFish.get(fish.sessionId) : undefined);
});

// the built-in terminals, on the left (desktop app only)
if (window.fishtankTerminals) void import('./terminals').then(terminals => terminals.startTerminals(window.fishtankTerminals!));
