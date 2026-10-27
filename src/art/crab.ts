import { TAU } from '../util';

/** How the crab is posed this frame. */
export interface CrabPose {
  step: number;    // walk cycle phase
  walking: number; // 0 standing .. 1 walking
  open: number;    // claw opening 0..1
  armL: number;    // claw raise, in body units (negative lowers)
  armR: number;
  look: number;    // pupils -1 (left) .. 1 (right)
  brows: number;   // -1 worried .. 1 cheerful
  fright: number;  // 0 calm .. 1 terrified
}

/** Canvas size and the feet origin, in units of L/100. */
export const CRAB_BOX = { w: 150, h: 122, ox: 75, oy: 114 };

const RED = '#e2362f', LIGHT = '#ff7c62', DARK = '#a8171f', INK = '#3a0a0d', BELLY = '#ff9a78';
let g: CanvasRenderingContext2D;

function toon(path: () => void, fill: string | CanvasGradient, w = 2.2) {
  path(); g.fillStyle = fill; g.fill();
  g.strokeStyle = INK; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
}
function dot(x: number, y: number, rx: number, ry: number, col: string, rot = 0) {
  g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill();
}
/** A thick outlined limb segment that tapers from w0 to w1. */
function limb(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, col: string) {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
  toon(() => {
    g.beginPath();
    g.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); g.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
    g.arc(x1, y1, w1 / 2, a + Math.PI / 2, a - Math.PI / 2, true);
    g.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
    g.arc(x0, y0, w0 / 2, a - Math.PI / 2, a + Math.PI / 2, true);
    g.closePath();
  }, col, 1.8);
}

/** A big pincer for side s (+1 right, -1 left), opening by `open`. */
function claw(x: number, y: number, s: number, open: number) {
  g.save(); g.translate(x, y); g.scale(s, 1); g.rotate(.32);
  // movable inner finger, hinged near the palm
  g.save(); g.translate(-4, -9); g.rotate(-open * .6); g.translate(4, 9);
  toon(() => { g.beginPath(); g.moveTo(-12, -4); g.quadraticCurveTo(-15, -22, -4, -31); g.quadraticCurveTo(1, -19, 1, -9); g.closePath(); }, RED);
  g.restore();
  // palm and the fixed outer finger
  toon(() => {
    g.beginPath(); g.moveTo(-13, -2);
    g.bezierCurveTo(-15, 12, 12, 15, 14, 0);
    g.quadraticCurveTo(17, -20, 6, -34);
    g.quadraticCurveTo(5, -20, 0, -11);
    g.quadraticCurveTo(-8, -8, -13, -2);
    g.closePath();
  }, RED);
  g.save(); g.beginPath(); g.moveTo(-13, -2); g.bezierCurveTo(-15, 12, 12, 15, 14, 0); g.quadraticCurveTo(17, -20, 6, -34); g.lineTo(-13, -34); g.closePath(); g.clip();
  dot(5, 8, 14, 6, DARK);                         // shaded underside
  g.restore();
  dot(-5, -1, 4.5, 2.4, 'rgba(255,255,255,.55)', -.5); // shine
  dot(9, -18, 1.4, 4, 'rgba(255,255,255,.45)', .2);
  g.restore();
}

function eye(x: number, y: number, look: number, fright: number) {
  toon(() => { g.beginPath(); g.ellipse(x, y, 7 + fright * 1.5, 8.5 + fright * 2.5, 0, 0, TAU); }, '#fff', 1.8);
  const r = 1 - fright * .55;
  dot(x + look * 2.6, y + 1, 3 * r, 3.6 * r, '#16110f');
  dot(x + look * 2.6 - r, y + 1 - 1.4 * r, 1.1 * r, 1.1 * r, '#fff');
}

/** Draws the crab facing us with its feet at the origin, in units of L/100. */
export function paintCrab(ctx: CanvasRenderingContext2D, L: number, p: CrabPose) {
  g = ctx;
  g.save(); g.scale(L / 100, L / 100);
  const bob = -Math.abs(Math.sin(p.step * 2)) * 2 * p.walking, by = -30 + bob;

  dot(0, 0, 36, 4.5, 'rgba(0,0,0,.25)'); // contact shadow

  // six legs, behind the body; pairs step alternately while walking
  for (const s of [-1, 1]) for (let i = 2; i >= 0; i--) {
    const ph = p.step + i * 2.1 + (s > 0 ? Math.PI : 0), lift = p.walking * Math.max(0, Math.sin(ph)) * 7;
    const hx = s * (12 + i * 7), hy = by + 10, kx = s * (38 + i * 8), ky = by - 8 + i * 4 - lift * .6;
    const fx = s * (46 + i * 8) + s * Math.cos(ph) * 3 * p.walking, fy = -lift;
    limb(hx, hy, kx, ky, 6, 5, DARK);
    limb(kx, ky, fx, fy, 5, 1.6, RED);
  }

  // arms up to the claws
  const arms: [number, number][] = [[-1, p.armL], [1, p.armR]];
  for (const [s, raise] of arms) {
    const ex = s * 41, ey = by - 4 - raise * .5, cx = s * 48, cy = by - 22 - raise;
    limb(s * 22, by - 2, ex, ey, 8, 7, DARK);
    limb(ex, ey, cx, cy, 7, 7, RED);
    claw(cx, cy, s, p.open);
  }

  // shell
  const body = () => { g.beginPath(); g.ellipse(0, by, 33, 18, 0, 0, TAU); };
  const shell = g.createLinearGradient(0, by - 18, 0, by + 18);
  shell.addColorStop(0, LIGHT); shell.addColorStop(.45, RED); shell.addColorStop(1, DARK);
  toon(body, shell, 2.4);
  g.save(); body(); g.clip();
  dot(0, by + 10, 18, 9, BELLY);
  g.strokeStyle = 'rgba(58,10,13,.45)'; g.lineWidth = 1;
  for (const k of [0, 1]) { g.beginPath(); g.moveTo(-12 + k * 3, by + 5 + k * 4); g.quadraticCurveTo(0, by + 9 + k * 4, 12 - k * 3, by + 5 + k * 4); g.stroke(); }
  g.restore();

  // head rising out of the shell
  const hy = by - 4, head = () => {
    g.beginPath(); g.moveTo(-17, hy);
    g.bezierCurveTo(-21, hy - 26, -12, hy - 38, 0, hy - 38);
    g.bezierCurveTo(12, hy - 38, 21, hy - 26, 17, hy);
    g.quadraticCurveTo(0, hy + 7, -17, hy);
    g.closePath();
  };
  const hg = g.createLinearGradient(-16, hy - 38, 14, hy);
  hg.addColorStop(0, LIGHT); hg.addColorStop(.6, RED); hg.addColorStop(1, '#c4232a');
  toon(head, hg, 2.4);
  dot(-8, hy - 29, 5, 2.6, 'rgba(255,255,255,.55)', -.5);
  dot(-22, by - 4, 5, 2.2, 'rgba(255,255,255,.4)', -.6);

  // eyes on short stalks, close together, with expressive brows
  for (const s of [-1, 1]) limb(s * 5, hy - 34, s * 7.5, hy - 42, 4, 3.6, RED);
  eye(-7.5, hy - 48, p.look, p.fright); eye(7.5, hy - 48, p.look, p.fright);
  g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    const tilt = -p.brows * 2.2, up = p.fright * 3;
    g.beginPath(); g.moveTo(s * 3.5, hy - 58 - p.brows + tilt - up); g.quadraticCurveTo(s * 8, hy - 61 - p.brows * 1.5 - up, s * 12, hy - 58 - p.brows - tilt - up); g.stroke();
  }

  // big toothy grin and cheeks; when frightened, a wide gritted-teeth grimace and flying sweat drops
  dot(-13, hy - 13, 3.4, 2, 'rgba(255,170,150,.8)'); dot(13, hy - 13, 3.4, 2, 'rgba(255,170,150,.8)');
  if (p.fright > .5) {
    const mouth = () => { g.beginPath(); g.roundRect(-11, hy - 20, 22, 8, 3); };
    toon(mouth, '#fff', 1.8);
    g.strokeStyle = 'rgba(58,10,13,.7)'; g.lineWidth = 1; g.beginPath();
    g.moveTo(-11, hy - 16); g.lineTo(11, hy - 16);
    for (const x of [-5.5, 0, 5.5]) { g.moveTo(x, hy - 20); g.lineTo(x, hy - 12); }
    g.stroke();
    g.globalAlpha = (p.fright - .5) * 2;
    for (const [x, y, k] of [[-20, hy - 44, 1], [21, hy - 38, .8], [-23, hy - 30, .65]]) {
      toon(() => { g.beginPath(); g.moveTo(x, y - 6 * k); g.quadraticCurveTo(x + 4 * k, y, x, y + 2.5 * k); g.quadraticCurveTo(x - 4 * k, y, x, y - 6 * k); }, '#bfe9ff', 1.2);
    }
    g.globalAlpha = 1;
  } else {
    const grin = p.brows < 0 ? 4 : 10;
    const mouth = () => {
      g.beginPath(); g.moveTo(-11, hy - 17);
      g.quadraticCurveTo(0, hy - 14, 11, hy - 17);
      g.quadraticCurveTo(8, hy - 17 + grin, 0, hy - 16 + grin);
      g.quadraticCurveTo(-8, hy - 17 + grin, -11, hy - 17);
      g.closePath();
    };
    toon(mouth, '#6a0e18', 1.8);
    g.save(); mouth(); g.clip();
    g.fillStyle = '#fff'; g.fillRect(-12, hy - 19, 24, 5);
    dot(0, hy - 15 + grin, 5, 3, '#ff6f86');
    g.restore();
    mouth(); g.strokeStyle = INK; g.lineWidth = 1.8; g.stroke();
  }

  g.restore();
}
