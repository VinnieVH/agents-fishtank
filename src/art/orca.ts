import { TAU } from '../util';

type Bend = (x: number, y: number) => [number, number];

// One fluke lobe seen flat from above, from its root out to the swept-back tip and in to the middle notch:
// x back along the tail, z out to the side
const FLUKE: [number, number][] = [[2.5, 1.8], [-2.5, 7], [-10.5, 13.5], [-19, 16], [-17.5, 11], [-15, 4], [-14, 0]];
const FLUKE_TILT = .35; // we see the flukes a little from below, so both lobes show

/** The flukes, flat and horizontal, pitched up or down by `a` as the tail beats; origin at their root. */
function flukes(g: CanvasRenderingContext2D, a: number) {
  const c = Math.cos(a), s = Math.sin(a);
  const at = ([x, z]: [number, number]): [number, number] => [x * c, x * s - z * FLUKE_TILT];
  const pts = [...FLUKE.map(([x, z]) => at([x, z])), ...FLUKE.slice(0, -1).reverse().map(([x, z]) => at([x, -z]))];
  g.beginPath(); g.moveTo(...pts[0]);
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[(i + 1) % pts.length];
    g.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  g.closePath(); g.fill();
}

/** Bends everything behind `pivot` up or down as the tail beats, more the further back, up to `angle` at `len` back. */
function bender(pivot: number, len: number, angle: number): Bend {
  return (x, y) => {
    if (x >= pivot) return [x, y];
    const a = angle * Math.min(1, (pivot - x) / len), c = Math.cos(a), s = Math.sin(a), dx = x - pivot;
    return [pivot + dx * c - y * s, dx * s + y * c];
  };
}

/** The whole outline in one piece: head, back rising into the tall dorsal fin, the tail stock, belly and chin. */
function orcaBody(g: CanvasRenderingContext2D, T: Bend) {
  const c = (a: number, b: number, d: number, e: number, x: number, y: number) => g.bezierCurveTo(...T(a, b), ...T(d, e), ...T(x, y));
  g.beginPath(); g.moveTo(...T(50, 1.5));
  c(50, -4, 45, -8.5, 36, -10);
  c(26, -11.8, 16, -12.4, 11, -12.2);
  c(6, -13, 3, -23, -4, -33);        // leading edge up to the fin's tip
  c(-5, -24, -6, -15, -13, -10.8);   // trailing edge, curving back into the back
  c(-19, -8.4, -26, -5.4, -33, -3.2);
  c(-36, -2.2, -38, -1.6, -40, -1.4);
  g.lineTo(...T(-40, 1.4));
  c(-36, 1.8, -30, 3.4, -22, 6.2);
  c(-10, 10.2, 5, 11.6, 20, 11);
  c(36, 10.5, 46, 7.5, 50, 1.5);
  g.closePath();
}

/** A big rounded paddle of a pectoral fin, pointing back from its root. */
function paddle(g: CanvasRenderingContext2D, color: string) {
  g.fillStyle = color; g.beginPath(); g.moveTo(3, -1.8);
  g.bezierCurveTo(-4, -2.5, -12, -1, -13, 2.5);
  g.bezierCurveTo(-13.5, 5.5, -8, 5, 3, 1.8);
  g.quadraticCurveTo(5.5, 0, 3, -1.8); // a rounded root, so no straight edge shows where it meets the body
  g.fill();
}

// Draws an orca facing right in units of L/100, origin mid-body
export function paintOrca(g: CanvasRenderingContext2D, L: number, ph: number) {
  const beat = Math.sin(ph), black = '#111518', angle = beat * .16, T = bender(-24, 16, angle);
  g.save(); g.scale(L / 100, L / 100);

  // far-side pectoral fin
  g.save(); g.translate(22, 7); g.rotate(.45 + Math.sin(ph * .5 + 1) * .08); paddle(g, '#0b0e10'); g.restore();

  // flukes, growing out of the end of the tail stock and pitching a little further with each beat
  g.save(); g.translate(...T(-40, 0));
  g.fillStyle = black; flukes(g, angle + beat * .22);
  g.restore();

  // black body with its white chin, belly and the flank patch sweeping up behind, the eye patch and the grey saddle
  g.fillStyle = black; orcaBody(g, T); g.fill();
  g.save(); orcaBody(g, T); g.clip();
  g.fillStyle = '#eef2f4';
  g.beginPath(); g.moveTo(51, 2.2);
  g.bezierCurveTo(44, 4.2, 36, 4.6, 28, 5.6);
  g.bezierCurveTo(18, 7.2, 8, 7.6, 0, 7);
  g.bezierCurveTo(-8, 6.4, -12, 1, -17, -2.5);
  g.quadraticCurveTo(-21, -4, -21, 0);
  g.quadraticCurveTo(-20, 4, -12, 9);
  g.lineTo(-12, 16); g.lineTo(52, 16); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(26, -5, 6.2, 2.3, -.12, 0, TAU); g.fill();
  g.fillStyle = 'rgba(150,160,168,.75)';
  g.beginPath(); g.ellipse(-15, -9.5, 8, 3, .25, 0, TAU); g.fill();
  g.restore();

  // mouth along the edge of the white jaw, and the eye just in front of its patch
  g.strokeStyle = '#05070a'; g.lineWidth = .55; g.lineCap = 'round';
  g.beginPath(); g.moveTo(50.2, 2.4); g.quadraticCurveTo(44, 3.6, 37, 4.2); g.stroke();
  g.fillStyle = '#000'; g.beginPath(); g.arc(32.5, -2, .7, 0, TAU); g.fill();

  // near-side pectoral fin, its root in the black above the white belly
  g.save(); g.translate(25, 4.6); g.rotate(.35 + Math.sin(ph * .5) * .08); paddle(g, black); g.restore();
  g.restore();
}
