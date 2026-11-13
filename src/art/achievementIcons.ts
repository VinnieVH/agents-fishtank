import { KINDS } from '../scene/passersby';
import { ALL_SPECIES, type Species } from '../species';
import { Season } from '../seasons';
import { CRAB_BOX, paintCrab, type CrabPose } from './crab';
import { makeCanvas } from './canvas';
import { paintFish, stillCanvas } from './fishArt';
import { paintHat } from './hats';

type Context = CanvasRenderingContext2D;
/** Paints one achievement's picture into a square of `size` by `size`. */
type IconPainter = (g: Context, size: number) => void;

/** A drawing's canvas size and the point it is drawn from, in its own units. */
interface Box { w: number; h: number; originX: number; originY: number }

const FILL = .86;

/** Draws a picture that fits in `box` as large as fits the square, in the middle of it. */
const fit = (g: Context, box: Box & { size: number }, paint: () => void) => {
  const { size } = box, scale = Math.min(size / box.w, size / box.h) * FILL;
  g.save();
  g.translate((size - box.w * scale) / 2 + box.originX * scale, (size - box.h * scale) / 2 + box.originY * scale);
  g.scale(scale, scale);
  paint();
  g.restore();
};

const SPOTS = Array.from({ length: 6 }, (_, index) => ({ x: Math.sin(index * 2.1) * .7, y: Math.cos(index * 1.3) * .3, rx: .15, ry: .1, rot: index }));
const FISH_COLORS = ['#ff7a3d', '#3dc8ff', '#9b5cff', '#ffcf3d'];
const GLOW = '#00f0ff';
const FISH_SIZE = 40, FISH_RESOLUTION = 2;

/** A fish as the tank paints it, with its glow. */
const fishIcon = (species: Species, isSmall = false): IconPainter => (g, size) => {
  const textures = paintFish({ species, small: isSmall, body: FISH_COLORS[ALL_SPECIES.indexOf(species) % FISH_COLORS.length], neon: GLOW, pattern: 0, variant: 0, spots: SPOTS },
    FISH_SIZE, FISH_RESOLUTION);
  const picture = stillCanvas(textures, FISH_RESOLUTION);
  const { width, height } = textures;
  textures.body.destroy(true); textures.halo.destroy(true); textures.fin?.texture.destroy(true);
  fit(g, { size, w: width, h: height, originX: 0, originY: 0 }, () => g.drawImage(picture, 0, 0, width, height));
};

const visitorIcon = (name: string): IconPainter => (g, size) => {
  const kind = KINDS.find(candidate => candidate.name === name);
  if (!kind) return;
  const { box } = kind, length = 100;
  fit(g, { size, w: length * box.w, h: length * box.h, originX: length * box.ox, originY: length * box.oy }, () => kind.paint(g, length, 0));
};

const hatIcon = (season: (typeof Season)[keyof typeof Season]): IconPainter => (g, size) => {
  const box = { size, w: 44, h: 40, originX: 22, originY: 34 };
  fit(g, box, () => paintHat(g, season));
};

const CALM_CRAB: CrabPose = { step: 0, walking: 0, open: .2, leftArm: 0, rightArm: 0, look: 0, brows: .5, fright: 0 };

const crabIcon = (pose: Partial<CrabPose> = {}): IconPainter => (g, size) =>
  fit(g, { size, w: CRAB_BOX.w, h: CRAB_BOX.h, originX: CRAB_BOX.originX, originY: CRAB_BOX.originY }, () => paintCrab(g, 100, { ...CALM_CRAB, ...pose }));

const moonIcon: IconPainter = (g, size) => {
  g.fillStyle = '#cfe0ff'; g.shadowColor = '#aac8ff'; g.shadowBlur = size * .15;
  g.beginPath(); g.arc(size * .45, size * .5, size * .3, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0; g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(size * .58, size * .42, size * .27, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff';
  for (const [x, y, radius] of [[.78, .22, .035], [.86, .5, .025], [.68, .8, .03]]) { g.beginPath(); g.arc(size * x, size * y, size * radius, 0, Math.PI * 2); g.fill(); }
};

const dawnIcon: IconPainter = (g, size) => {
  const centerX = size / 2, horizon = size * .62;
  g.save();
  g.beginPath(); g.rect(0, 0, size, horizon); g.clip();
  g.strokeStyle = '#ffbe78'; g.lineWidth = size * .04; g.lineCap = 'round';
  for (let ray = 1; ray < 6; ray++) {
    const angle = Math.PI * ray / 6;
    g.beginPath(); g.moveTo(centerX - Math.cos(angle) * size * .34, horizon - Math.sin(angle) * size * .34);
    g.lineTo(centerX - Math.cos(angle) * size * .46, horizon - Math.sin(angle) * size * .46); g.stroke();
  }
  g.fillStyle = '#ffd27a'; g.shadowColor = '#ffbe78'; g.shadowBlur = size * .15;
  g.beginPath(); g.arc(centerX, horizon, size * .26, 0, Math.PI * 2); g.fill();
  g.restore();
  g.fillStyle = '#3d9fd6'; g.fillRect(size * .1, horizon, size * .8, size * .06);
};

const FLAKES: [x: number, y: number, rotation: number, color: string][] = [
  [.3, .35, .4, '#e8a24a'], [.62, .28, -.6, '#d96a3a'], [.5, .55, 1.1, '#7fbf5a'], [.25, .72, -.3, '#d96a3a'], [.72, .66, .8, '#e8a24a'],
];

const foodIcon: IconPainter = (g, size) => {
  for (const [x, y, rotation, color] of FLAKES) {
    g.save(); g.translate(size * x, size * y); g.rotate(rotation);
    g.fillStyle = color; g.strokeStyle = 'rgba(40,20,10,.7)'; g.lineWidth = size * .02;
    g.beginPath(); g.ellipse(0, 0, size * .13, size * .08, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.restore();
  }
};

const ICONS: Record<string, IconPainter> = {
  'fish-1': fishIcon('tropical'), 'fish-5': fishIcon('koi'), 'fish-10': fishIcon('angelfish'), 'fish-15': fishIcon('puffer'),
  'fish-20': fishIcon('lionfish'), 'fish-25': fishIcon('seahorse'),
  'subagent-1': fishIcon('tropical', true), 'subagent-5': fishIcon('shrimp', true), 'subagent-10': fishIcon('squid', true),
  'crab-1': crabIcon(), 'crab-10': crabIcon({ look: 1 }), 'crab-25': crabIcon({ open: .8, leftArm: 5, rightArm: 5, brows: 1 }),
  'crab-dance': crabIcon({ leftArm: 12, rightArm: 3, open: 1, brows: 1 }), 'crab-scare': crabIcon({ fright: 1, brows: -1, leftArm: 8, rightArm: 8 }),
  'feed-1': foodIcon, 'feed-25': foodIcon, 'feed-100': foodIcon,
  'tank-night': moonIcon, 'tank-dawn': dawnIcon, 'tank-busy': fishIcon('angler'), 'tank-opened': fishIcon('octopus'),
  ...Object.fromEntries(Object.values(Season).map(season => [`season-${season}`, hatIcon(season)])),
  ...Object.fromEntries(KINDS.map(kind => [`visitor-${kind.name}`, visitorIcon(kind.name)])),
};

const cache = new Map<string, HTMLCanvasElement>();

/** The achievement's picture, painted with the tank's own art (once, then kept), `size` CSS pixels square. Every call gives a canvas of its own. */
export const achievementIcon = (id: string, size: number): HTMLCanvasElement => {
  const resolution = Math.max(2, devicePixelRatio || 1), key = `${id}:${size}:${resolution}`;
  let painted = cache.get(key);
  if (!painted) {
    const { canvas, g } = makeCanvas(size, size, resolution);
    ICONS[id]?.(g, size);
    painted = canvas;
    cache.set(key, painted);
  }
  const { canvas, g } = makeCanvas(size, size, resolution);
  g.drawImage(painted, 0, 0, size, size);
  canvas.style.width = canvas.style.height = `${size}px`;
  return canvas;
};