import { TAU } from '../util';

/** How the crab is posed this frame. */
export interface CrabPose {
  step: number;    // walk cycle phase
  walking: number; // 0 standing .. 1 walking
  open: number;    // claw opening 0..1
  leftArm: number;    // claw raise, in body units (negative lowers)
  rightArm: number;
  look: number;    // pupils -1 (left) .. 1 (right)
  brows: number;   // -1 worried .. 1 cheerful
  fright: number;  // 0 calm .. 1 terrified
}

/** Canvas size and the feet origin, in units of length/100. */
export const CRAB_BOX = { w: 150, h: 122, originX: 75, originY: 114 };

const RED = '#e2362f', LIGHT = '#ff7c62', DARK = '#a8171f', INK = '#3a0a0d', BELLY = '#ff9a78';
const SWEAT_DROPS = [[-20, -44, 1], [21, -38, .8], [-23, -30, .65]];
// Set by paintCrab for the frame being painted, so the many small helpers below needn't each take it
let g: CanvasRenderingContext2D;

const paintToon = (tracePath: () => void, fill: string | CanvasGradient, lineWidth = 2.2) => {
  tracePath(); g.fillStyle = fill; g.fill();
  g.strokeStyle = INK; g.lineWidth = lineWidth; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
};

// paintDot and paintLimb take positional parameters on purpose: they run dozens of times every frame, where an
// options object would allocate
// oxlint-disable-next-line max-params
const paintDot = (x: number, y: number, radiusX: number, radiusY: number, color: string, rotation = 0) => {
  g.fillStyle = color; g.beginPath(); g.ellipse(x, y, radiusX, radiusY, rotation, 0, TAU); g.fill();
};

/** A thick outlined limb segment from (x0, y0) to (x1, y1) that tapers from width0 to width1. */
// oxlint-disable-next-line max-params
const paintLimb = (x0: number, y0: number, x1: number, y1: number, width0: number, width1: number, color: string) => {
  const angle = Math.atan2(y1 - y0, x1 - x0), normalX = -Math.sin(angle), normalY = Math.cos(angle);
  paintToon(() => {
    g.beginPath();
    g.moveTo(x0 + normalX * width0 / 2, y0 + normalY * width0 / 2); g.lineTo(x1 + normalX * width1 / 2, y1 + normalY * width1 / 2);
    g.arc(x1, y1, width1 / 2, angle + Math.PI / 2, angle - Math.PI / 2, true);
    g.lineTo(x0 - normalX * width0 / 2, y0 - normalY * width0 / 2);
    g.arc(x0, y0, width0 / 2, angle - Math.PI / 2, angle + Math.PI / 2, true);
    g.closePath();
  }, color, 1.8);
};

const traceInnerFinger = () => {
  g.beginPath(); g.moveTo(-12, -4); g.quadraticCurveTo(-15, -22, -4, -31); g.quadraticCurveTo(1, -19, 1, -9); g.closePath();
};

const tracePalm = () => {
  g.beginPath(); g.moveTo(-13, -2);
  g.bezierCurveTo(-15, 12, 12, 15, 14, 0);
  g.quadraticCurveTo(17, -20, 6, -34);
  g.quadraticCurveTo(5, -20, 0, -11);
  g.quadraticCurveTo(-8, -8, -13, -2);
  g.closePath();
};

/** A big pincer for `side` (1 right, -1 left), origin at its wrist, opening by `open`. */
const paintClaw = (side: number, open: number) => {
  g.scale(side, 1); g.rotate(.32);
  g.save(); g.translate(-4, -9); g.rotate(-open * .6); g.translate(4, 9); // the inner finger hinges near the palm
  paintToon(traceInnerFinger, RED);
  g.restore();
  paintToon(tracePalm, RED);
  g.save(); g.beginPath(); g.moveTo(-13, -2); g.bezierCurveTo(-15, 12, 12, 15, 14, 0); g.quadraticCurveTo(17, -20, 6, -34); g.lineTo(-13, -34); g.closePath(); g.clip();
  paintDot(5, 8, 14, 6, DARK);
  g.restore();
  paintDot(-5, -1, 4.5, 2.4, 'rgba(255,255,255,.55)', -.5);
  paintDot(9, -18, 1.4, 4, 'rgba(255,255,255,.45)', .2);
};

/** Six legs, behind the body; pairs step alternately while walking. */
const paintLegs = (bodyY: number, pose: CrabPose) => {
  for (const side of [-1, 1]) for (let pair = 2; pair >= 0; pair--) {
    const stepPhase = pose.step + pair * 2.1 + (side > 0 ? Math.PI : 0), lift = pose.walking * Math.max(0, Math.sin(stepPhase)) * 7;
    const hipX = side * (12 + pair * 7), hipY = bodyY + 10, kneeX = side * (38 + pair * 8), kneeY = bodyY - 8 + pair * 4 - lift * .6;
    const footX = side * (46 + pair * 8) + side * Math.cos(stepPhase) * 3 * pose.walking, footY = -lift;
    paintLimb(hipX, hipY, kneeX, kneeY, 6, 5, DARK);
    paintLimb(kneeX, kneeY, footX, footY, 5, 1.6, RED);
  }
};

const paintArms = (bodyY: number, pose: CrabPose) => {
  const arms: [number, number][] = [[-1, pose.leftArm], [1, pose.rightArm]];
  for (const [side, raise] of arms) {
    const elbowX = side * 41, elbowY = bodyY - 4 - raise * .5, clawX = side * 48, clawY = bodyY - 22 - raise;
    paintLimb(side * 22, bodyY - 2, elbowX, elbowY, 8, 7, DARK);
    paintLimb(elbowX, elbowY, clawX, clawY, 7, 7, RED);
    g.save(); g.translate(clawX, clawY); paintClaw(side, pose.open); g.restore();
  }
};

const paintShell = (bodyY: number) => {
  const traceShell = () => { g.beginPath(); g.ellipse(0, bodyY, 33, 18, 0, 0, TAU); };
  const shading = g.createLinearGradient(0, bodyY - 18, 0, bodyY + 18);
  shading.addColorStop(0, LIGHT); shading.addColorStop(.45, RED); shading.addColorStop(1, DARK);
  paintToon(traceShell, shading, 2.4);
  g.save(); traceShell(); g.clip();
  paintDot(0, bodyY + 10, 18, 9, BELLY);
  g.strokeStyle = 'rgba(58,10,13,.45)'; g.lineWidth = 1;
  for (const fold of [0, 1]) {
    g.beginPath(); g.moveTo(-12 + fold * 3, bodyY + 5 + fold * 4); g.quadraticCurveTo(0, bodyY + 9 + fold * 4, 12 - fold * 3, bodyY + 5 + fold * 4); g.stroke();
  }
  g.restore();
};

/** The head rising out of the shell, and a shine on each. */
const paintHead = (headY: number, bodyY: number) => {
  const traceHead = () => {
    g.beginPath(); g.moveTo(-17, headY);
    g.bezierCurveTo(-21, headY - 26, -12, headY - 38, 0, headY - 38);
    g.bezierCurveTo(12, headY - 38, 21, headY - 26, 17, headY);
    g.quadraticCurveTo(0, headY + 7, -17, headY);
    g.closePath();
  };
  const shading = g.createLinearGradient(-16, headY - 38, 14, headY);
  shading.addColorStop(0, LIGHT); shading.addColorStop(.6, RED); shading.addColorStop(1, '#c4232a');
  paintToon(traceHead, shading, 2.4);
  paintDot(-8, headY - 29, 5, 2.6, 'rgba(255,255,255,.55)', -.5);
  paintDot(-22, bodyY - 4, 5, 2.2, 'rgba(255,255,255,.4)', -.6);
};

const paintEye = (x: number, y: number, pose: CrabPose) => {
  paintToon(() => { g.beginPath(); g.ellipse(x, y, 7 + pose.fright * 1.5, 8.5 + pose.fright * 2.5, 0, 0, TAU); }, '#fff', 1.8);
  const pupilSize = 1 - pose.fright * .55;
  paintDot(x + pose.look * 2.6, y + 1, 3 * pupilSize, 3.6 * pupilSize, '#16110f');
  paintDot(x + pose.look * 2.6 - pupilSize, y + 1 - 1.4 * pupilSize, 1.1 * pupilSize, 1.1 * pupilSize, '#fff');
};

/** Eyes on short stalks, close together, with expressive brows. */
const paintEyes = (headY: number, pose: CrabPose) => {
  for (const side of [-1, 1]) paintLimb(side * 5, headY - 34, side * 7.5, headY - 42, 4, 3.6, RED);
  paintEye(-7.5, headY - 48, pose); paintEye(7.5, headY - 48, pose);
  g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round';
  for (const side of [-1, 1]) {
    const tilt = -pose.brows * 2.2, lift = pose.fright * 3;
    g.beginPath(); g.moveTo(side * 3.5, headY - 58 - pose.brows + tilt - lift); g.quadraticCurveTo(side * 8, headY - 61 - pose.brows * 1.5 - lift, side * 12, headY - 58 - pose.brows - tilt - lift); g.stroke();
  }
};

/** A wide gritted-teeth grimace, with sweat drops flying as the fright grows. */
const paintGrimace = (headY: number, fright: number) => {
  paintToon(() => { g.beginPath(); g.roundRect(-11, headY - 20, 22, 8, 3); }, '#fff', 1.8);
  g.strokeStyle = 'rgba(58,10,13,.7)'; g.lineWidth = 1; g.beginPath();
  g.moveTo(-11, headY - 16); g.lineTo(11, headY - 16);
  for (const x of [-5.5, 0, 5.5]) { g.moveTo(x, headY - 20); g.lineTo(x, headY - 12); }
  g.stroke();
  g.globalAlpha = (fright - .5) * 2;
  for (const [x, dropY, size] of SWEAT_DROPS) {
    const y = headY + dropY;
    paintToon(() => { g.beginPath(); g.moveTo(x, y - 6 * size); g.quadraticCurveTo(x + 4 * size, y, x, y + 2.5 * size); g.quadraticCurveTo(x - 4 * size, y, x, y - 6 * size); }, '#bfe9ff', 1.2);
  }
  g.globalAlpha = 1;
};

/** A big toothy grin, wider when cheerful. */
const paintGrin = (headY: number, brows: number) => {
  const depth = brows < 0 ? 4 : 10;
  const traceMouth = () => {
    g.beginPath(); g.moveTo(-11, headY - 17);
    g.quadraticCurveTo(0, headY - 14, 11, headY - 17);
    g.quadraticCurveTo(8, headY - 17 + depth, 0, headY - 16 + depth);
    g.quadraticCurveTo(-8, headY - 17 + depth, -11, headY - 17);
    g.closePath();
  };
  paintToon(traceMouth, '#6a0e18', 1.8);
  g.save(); traceMouth(); g.clip();
  g.fillStyle = '#fff'; g.fillRect(-12, headY - 19, 24, 5);
  paintDot(0, headY - 15 + depth, 5, 3, '#ff6f86');
  g.restore();
  traceMouth(); g.strokeStyle = INK; g.lineWidth = 1.8; g.stroke();
};

/** Draws the crab facing us with its feet at the origin, in units of length/100. */
export const paintCrab = (context: CanvasRenderingContext2D, length: number, pose: CrabPose) => {
  g = context;
  g.save(); g.scale(length / 100, length / 100);
  const bob = -Math.abs(Math.sin(pose.step * 2)) * 2 * pose.walking, bodyY = -30 + bob, headY = bodyY - 4;
  paintDot(0, 0, 36, 4.5, 'rgba(0,0,0,.25)'); // contact shadow
  paintLegs(bodyY, pose);
  paintArms(bodyY, pose);
  paintShell(bodyY);
  paintHead(headY, bodyY);
  paintEyes(headY, pose);
  paintDot(-13, headY - 13, 3.4, 2, 'rgba(255,170,150,.8)'); paintDot(13, headY - 13, 3.4, 2, 'rgba(255,170,150,.8)');
  if (pose.fright > .5) paintGrimace(headY, pose.fright);
  else paintGrin(headY, pose.brows);
  g.restore();
};
