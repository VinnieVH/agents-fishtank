// The manta is a small 3D model, projected: x runs forward along it, y up and z out towards us.

// One wing's outline seen flat, from where its leading edge grows out of the body round the tip and back: x, and s
// out from the middle. Its base runs along the body's side, where the dark back meets the white belly.
const WING: [number, number][] = [[17, 8.25], [12, 14], [6, 25], [-2, 40], [-6, 50], [-9, 47], [-12, 33], [-16, 18], [-19, 4.6]];
// the body's half width and half thickness along it, from the head back to the tail
const BODY: [number, number, number][] = [[24, 4, 2.6], [20, 7.5, 4], [12, 9.5, 4.8], [2, 9.5, 4.6], [-8, 8, 4], [-17, 5.5, 3], [-24, 2.5, 1.6]];
// dark spots under the wing, every manta its own pattern
const SPOTS: [number, number][] = [[3, 17], [-3, 29], [7, 13.5], [-6, 22], [-1, 36]];
const SIN_E = .12, COS_E = Math.sqrt(1 - SIN_E ** 2); // we look up at it from a little below
const YAW = .35; // and a little from the front, so the far wing sits further forward than the near one
const BEAT = 24; // how far the wingtips rise and fall
const BACK = [0x1d, 0x2a, 0x35], BELLY = [0xe2, 0xe9, 0xed];

/** Where a point lands on screen (y down). */
const view = (x: number, y: number, z: number): [number, number] => [x - z * YAW, -(y * COS_E + z * SIN_E)];

/**
 * A point on a wing (side 1 near, -1 far) as both beat together, f from -1 (down) to 1 (up). It bends from just
 * outside the body, the tips most.
 */
function wingAt(x: number, s: number, side: number, f: number) {
  const k = s / 50, bend = Math.max(0, (s - 6) / 44);
  return view(x - Math.abs(f) * k * k * 4, f * BEAT * bend ** 1.6, s * side);
}

/** A smooth closed shape through the points. */
function smooth(g: CanvasRenderingContext2D, pts: [number, number][]) {
  g.beginPath(); g.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
  for (let i = 1; i <= pts.length; i++) {
    const [x, y] = pts[i % pts.length], [nx, ny] = pts[(i + 1) % pts.length];
    g.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  g.closePath();
}

/** Twice the wing's signed area on screen: it changes sign as the wing turns past edge-on. */
function spread(side: number, f: number) {
  const [a, b, c] = [wingAt(17, 8.5, side, f), wingAt(-19, 5, side, f), wingAt(-6, 50, side, f)];
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** One wing, showing its white underside (as when level) or, once it has turned past edge-on, its dark back. */
function wing(g: CanvasRenderingContext2D, side: number, f: number) {
  const under = Math.min(1, Math.max(0, .5 + .9 * spread(side, f) / spread(side, 0)));
  g.fillStyle = `rgb(${BACK.map((c, i) => Math.round(c + (BELLY[i] - c) * under)).join(',')})`;
  // smooth round the tip, and back along the body's side where it grows out of it
  const pts = WING.map(([x, s]) => wingAt(x, s, side, f));
  g.beginPath(); g.moveTo(...pts[0]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[i + 1];
    g.quadraticCurveTo(x, y, i < pts.length - 2 ? (x + nx) / 2 : nx, i < pts.length - 2 ? (y + ny) / 2 : ny);
  }
  for (const [x, w] of [...BODY].reverse()) if (x > -19 && x < 17) g.lineTo(...view(x, 0, w * side));
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(30,42,52,.7)'; g.lineWidth = .6; g.stroke();
  g.fillStyle = `rgba(30,42,52,${.7 * under})`;
  for (const [x, s] of SPOTS) { g.beginPath(); g.arc(...wingAt(x, s, side, f), .55, 0, Math.PI * 2); g.fill(); }
}

/** One of the paddle-like fins either side of the mouth, dark outside and pale inside. */
function headFin(g: CanvasRenderingContext2D, side: number) {
  const [bx, by] = view(22, 0, 5 * side);
  g.fillStyle = '#26333e';
  g.beginPath(); g.moveTo(bx, by - 1);
  g.quadraticCurveTo(bx + 5.5, by - 1.2, bx + 6.5, by + 2.2);
  g.quadraticCurveTo(bx + 4, by + 2.8, bx, by + 1.2);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(226,233,237,.8)';
  g.beginPath(); g.ellipse(bx + 3.6, by + .9, 2.2, .7, .25, 0, Math.PI * 2); g.fill();
}

// Draws a manta ray gliding right in units of L/100 (L is its wingspan), origin mid-body
export function paintManta(g: CanvasRenderingContext2D, L: number, ph: number) {
  const f = Math.sin(ph);
  g.save(); g.scale(L / 100, L / 100);
  g.lineCap = 'round';

  // whip of a tail
  g.strokeStyle = '#2a3743';
  let px = -24, py = 0;
  for (let s = 1; s <= 12; s++) {
    const d = s / 12, x = -24 - d * 35, y = Math.sin(ph * .8 - d * 3) * 2.2 * d;
    g.lineWidth = 1.3 * (1 - d) + .25;
    g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
    px = x; py = y;
  }

  wing(g, -1, f);
  headFin(g, -1);

  // the body: its outline seen from a little below, with the white belly under the dark back
  const edge = BODY.map(([x, w, t]) => Math.hypot(t * COS_E, w * SIN_E));
  const top = BODY.map(([x], i): [number, number] => [x, -edge[i]]), bottom = BODY.map(([x], i): [number, number] => [x, edge[i]]);
  const belly = g.createLinearGradient(25, 0, -24, 0);
  belly.addColorStop(0, '#eef3f5'); belly.addColorStop(1, '#c4ced5');
  g.fillStyle = belly; smooth(g, [[26, 0], ...top, [-25, 0], ...bottom.reverse()]); g.fill();
  const side = BODY.map(([x, w]) => view(x, 0, w)); // where the back meets the belly along its near side
  g.fillStyle = `rgb(${BACK.join(',')})`; smooth(g, [[26, -.5], ...top, [-25, 0], ...side.reverse()]); g.fill();
  g.strokeStyle = 'rgba(60,72,84,.55)'; g.lineWidth = .4;
  for (let i = 0; i < 5; i++) { const x = 9 - i * 2.2; g.beginPath(); g.moveTo(x, 1); g.lineTo(x - .8, 3.6); g.stroke(); }
  g.strokeStyle = '#2a3540'; g.lineWidth = .8;
  g.beginPath(); g.moveTo(25.2, -.4); g.quadraticCurveTo(26.4, 1.4, 24.6, 3); g.stroke();

  wing(g, 1, f);
  headFin(g, 1);

  // only the near eye shows, on the side of the head
  const [ex, ey] = view(18.5, .8, 8);
  g.fillStyle = '#05090c'; g.beginPath(); g.arc(ex, ey, .85, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(ex + .25, ey - .25, .25, 0, Math.PI * 2); g.fill();
  g.restore();
}
