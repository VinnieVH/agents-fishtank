import { rng, shade } from '../util';
import { isClear, keepClear } from './chestSpot';
import type { ForegroundArt, Setting, Swayer } from './foregroundTypes';
import { paintArch, paintBust, paintColonnade, paintRubble } from './ruinsProps';
import { block, bury, jagged, MARBLE, moss, paintColumn, rim, slab, snowCap, useGround } from './ruinsStone';
import { ellipse, g, ink, poly, toon } from './sceneryPen';
import type { Point } from './sceneryPen';

const GOLDEN = .6180339887;
const CLAY = ['#b8643c', '#9c4e34', '#c47a48'];
const GROWTH = ['#4aa36a', '#2f8f78', '#7cb04f'];
const CORALS = ['#b0587a', '#7a5ab0', '#c8884a'];

/** Two wide steps the temple stands on, sunk into the sand. */
const paintSteps = (x: number, y: number, span: number) => {
  block(x - span / 2, y + 12, span, 16, shade(MARBLE, -.08));
  block(x - span / 2 + 22, y, span - 44, 14);
  snowCap(x, y - 12, span - 44); bury(x, y + 20, span);
};

/** A temple front on steps: two columns carrying a lintel with a ragged, chipped top. */
const paintTemple = (x: number, y: number, scale: number) => {
  const h = 185 * scale, gap = 150 * scale, w = 42 * scale, left = x - gap / 2 - w * .9;
  paintSteps(x, y, gap + 150 * scale);
  paintColumn({ x: x - gap / 2, y, w, h });
  paintColumn({ x: x + gap / 2, y, w, h });
  const top = y - h - 8, right = x + gap / 2 + w * .9, random = rng(Math.round(x)), edge = jagged([[right, top - 34], [left, top - 34]], random, 8);
  slab(poly([left, top], [right, top], ...edge), [left, top, right - left, 34]); rim(edge, MARBLE);
  snowCap(x - gap * .2, top - 32, gap * .7);
  for (const [at, size] of [[.62, 18], [.86, 12], [1.1, 14]]) { block(x + gap * at, y + 8, size * 1.6 * scale, size * scale); bury(x + gap * at + size * .8 * scale, y - size * .3, size * 1.6 * scale); }
};

/** A column lying on its side, in drums with small gaps where it cracked. */
const paintFallen = (x: number, y: number, scale: number) => {
  const w = 130 * scale, h = 30 * scale, drums = 3;
  for (let drum = 0; drum < drums; drum++) {
    const left = x - w / 2 + drum * (w / drums) + drum * 3, width = w / drums - 2;
    block(left, y, width, h);
    ellipse({ x: left + width, y: y - h / 2, radiusX: 4, radiusY: h / 2, color: shade(MARBLE, -.2) });
  }
  snowCap(x, y - h + 2, w); moss(x, y, w); bury(x, y - h * .4, w);
};

/** A clay amphora half buried in the sand, leaning over. */
const paintAmphora = ([x, y]: Point, color: string, tilt: number) => {
  g.save(); g.translate(x, y); g.rotate(tilt);
  const handles = new Path2D(); handles.ellipse(-15, -46, 7, 11, 0, 0, Math.PI * 2); handles.ellipse(15, -46, 7, 11, 0, 0, Math.PI * 2);
  ink(handles, { color: shade(color, -.6), width: 4 }); ink(handles, { color, width: 2 });
  const body = new Path2D(); body.moveTo(-8, -66); body.bezierCurveTo(-8, -52, -22, -50, -22, -24); body.bezierCurveTo(-22, 0, -8, 4, 0, 4);
  body.bezierCurveTo(8, 4, 22, 0, 22, -24); body.bezierCurveTo(22, -50, 8, -52, 8, -66); body.closePath();
  toon(body, { fill: color, inkColor: shade(color, -.62), width: 2.2 }, () => {
    ellipse({ x: 14, y: -24, radiusX: 12, radiusY: 34, color: shade(color, -.22) });
    ellipse({ x: -9, y: -34, radiusX: 3, radiusY: 14, rotation: .1, color: shade(color, .4) });
    g.fillStyle = shade(color, -.45); g.fillRect(-22, -34, 44, 5);
  });
  ellipse({ x: 0, y: -67, radiusX: 11, radiusY: 4, color: shade(color, -.1) });
  g.restore(); bury(x, y, 46);
};

const spotted = (width: number, [count, offset]: [number, number], [size, clear]: [number, [number, number][]]) =>
  Array.from({ length: count }, (_, index) => (offset + index * GOLDEN) % 1 * width).filter(x => isClear(clear, x - size, x + size));

const templeX = (width: number) => width * .56;

/** What the ruins occupy besides the chest's stretch. */
const keepRuins = (width: number): [number, number][] => [...keepClear(width), [templeX(width) - 190, templeX(width) + 200]];

/** Where each piece of the ruins stands, in a tank `width` wide; they take turns at the stretches nothing else has taken. */
const layout = (width: number) => {
  const clear = keepRuins(width), spots = { bust: [] as number[], arch: [] as number[] };
  for (const [at, kind] of [[.355, 'bust'], [.79, 'arch']] as const) {
    const x = at * width;
    if (isClear(clear, x - 60, x + 60)) { spots[kind].push(x); clear.push([x - 60, x + 60]); }
  }
  const columns = spotted(width, [3, .31], [60, clear]), fallen = spotted(width, [1, .13], [70, clear]);
  const rubble = spotted(width, [8, .21], [14, clear]), amphorae = spotted(width, [Math.max(4, Math.round(width / 260)), .47], [30, clear]);
  return { ...spots, columns, fallen, rubble, amphorae, clear };
};

/** The stretches of sand the ruins stand on, where nothing else is scattered. */
const occupied = (width: number): [number, number][] => {
  const { bust, arch, columns, fallen, rubble, amphorae } = layout(width);
  const around = (xs: number[], reach: number): [number, number][] => xs.map(x => [x - reach, x + reach]);
  return [[templeX(width) - 190, templeX(width) + 200], ...around(bust, 60), ...around(arch, 150), ...around(columns, 40), ...around(fallen, 75), ...around(rubble, 22), ...around(amphorae, 36)];
};

const paintRuins = ({ width, sandLine, ground }: Setting) => {
  useGround(ground);
  const scale = Math.min(1, sandLine / 560), temple = templeX(width), { bust, arch, columns, fallen, rubble, amphorae } = layout(width);
  paintColonnade({ width, scale, ground }, keepRuins(width));
  paintTemple(temple, ground(temple) + 8, scale);
  for (const x of bust) paintBust(x, ground(x) + 10, scale);
  for (const x of arch) paintArch(x, ground(x) + 10, scale);
  for (const x of columns) paintColumn({ x, y: ground(x) + 10, w: 38 * scale, h: (80 + (x % 90)) * scale, broken: true });
  for (const x of fallen) paintFallen(x, ground(x) + 10, scale);
  paintRubble(rubble.map((x, index): [number, number, number] => [x, ground(x) + 14 + (index % 3) * 7, 10 + (index * 7) % 12]));
  amphorae.forEach((x, index) => paintAmphora([x, ground(x) + 18 + (index % 2) * 10], CLAY[index % 3], (index % 2 ? .6 : -.5)));
};
/** Sea grass, sea whips and fans growing between the stones, kept clear of the temple and chest. */
const swayers = (width: number, height: number): Swayer[] => {
  const sandLine = height - 70, clear = layout(width).clear, plants: Swayer[] = [];
  for (let index = 0, count = Math.max(10, Math.round(width / 90)); index < count; index++) {
    const random = rng(4600 + index * 31), x = (.05 + index * GOLDEN) % 1 * width;
    if (!isClear(clear, x - 24, x + 24)) continue;
    const kind = (['grass', 'whip', 'fan'] as const)[index % 3], color = kind === 'grass' ? GROWTH[index % 3] : CORALS[index % 3];
    plants.push({ kind, x, y: sandLine + 4 + random() * 14, size: 80 + random() * 80, color, seed: 4700 + index });
  }
  return plants;
};

/** The sunken ruins: a broken temple front, fallen columns and amphorae, grown over with moss and sea grass. */
export const ruinsForeground: ForegroundArt = { paint: paintRuins, swayers, hasAnemones: false, container: 'coffer', occupied };
