// The manta is a small 3D model, projected: x runs forward along it, y up and z out towards us.

type Point = [number, number];

// One wing's outline seen flat, from where its leading edge grows out of the body round the tip and back: x, and
// out from the middle. Its base runs along the body's side, where the dark back meets the white belly.
const WING: Point[] = [[17, 8.25], [12, 14], [6, 25], [-2, 40], [-6, 50], [-9, 47], [-12, 33], [-16, 18], [-19, 4.6]];
// three corners of the wing, to tell which way it faces
const WING_CORNERS: Point[] = [[17, 8.5], [-19, 5], [-6, 50]];
// the body's half width and half thickness along it, from the head back to the tail
const BODY: [number, number, number][] = [[24, 4, 2.6], [20, 7.5, 4], [12, 9.5, 4.8], [2, 9.5, 4.6], [-8, 8, 4], [-17, 5.5, 3], [-24, 2.5, 1.6]];
// dark spots under the wing, every manta its own pattern
const SPOTS: Point[] = [[3, 17], [-3, 29], [7, 13.5], [-6, 22], [-1, 36]];
const SIN_ELEVATION = .12, COS_ELEVATION = Math.sqrt(1 - SIN_ELEVATION ** 2); // we look up at it from a little below
const YAW = .35; // and a little from the front, so the far wing sits further forward than the near one
const BEAT = 24; // how far the wingtips rise and fall
const BACK = [0x1d, 0x2a, 0x35], BELLY = [0xe2, 0xe9, 0xed];

/** Where a point lands on screen (y down). */
const view = (x: number, y: number, z: number): Point => [x - z * YAW, -(y * COS_ELEVATION + z * SIN_ELEVATION)];

/**
 * A point on a wing (side 1 near, -1 far), given as x and out from the middle, as both beat together, `beat` from
 * -1 (down) to 1 (up). It bends from just outside the body, the tips most.
 */
const wingAt = ([x, out]: Point, side: number, beat: number) => {
  const reach = out / 50, bend = Math.max(0, (out - 6) / 44);
  return view(x - Math.abs(beat) * reach * reach * 4, beat * BEAT * bend ** 1.6, out * side);
};

const traceSmoothShape = (g: CanvasRenderingContext2D, points: Point[]) => {
  g.beginPath(); g.moveTo((points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2);
  for (let index = 1; index <= points.length; index++) {
    const [x, y] = points[index % points.length], [nextX, nextY] = points[(index + 1) % points.length];
    g.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2);
  }
  g.closePath();
};

/** Twice the wing's signed area on screen: it changes sign as the wing turns past edge-on. */
const wingSpread = (side: number, beat: number) => {
  const [first, second, third] = WING_CORNERS.map(corner => wingAt(corner, side, beat));
  return (second[0] - first[0]) * (third[1] - first[1]) - (second[1] - first[1]) * (third[0] - first[0]);
};

/** Smooth round the tip, and back along the body's side where the wing grows out of it. */
const traceWing = (g: CanvasRenderingContext2D, side: number, beat: number) => {
  const points = WING.map(point => wingAt(point, side, beat));
  g.beginPath(); g.moveTo(...points[0]);
  for (let index = 1; index < points.length - 1; index++) {
    const [x, y] = points[index], [nextX, nextY] = points[index + 1], isLast = index >= points.length - 2;
    g.quadraticCurveTo(x, y, isLast ? nextX : (x + nextX) / 2, isLast ? nextY : (y + nextY) / 2);
  }
  for (const [x, halfWidth] of [...BODY].reverse()) if (x > -19 && x < 17) g.lineTo(...view(x, 0, halfWidth * side));
  g.closePath();
};

/** One wing, showing its white underside (as when level) or, once it has turned past edge-on, its dark back. */
const paintWing = (g: CanvasRenderingContext2D, side: number, beat: number) => {
  const under = Math.min(1, Math.max(0, .5 + .9 * wingSpread(side, beat) / wingSpread(side, 0)));
  g.fillStyle = `rgb(${BACK.map((channel, index) => Math.round(channel + (BELLY[index] - channel) * under)).join(',')})`;
  traceWing(g, side, beat); g.fill();
  g.strokeStyle = 'rgba(30,42,52,.7)'; g.lineWidth = .6; g.stroke();
  g.fillStyle = `rgba(30,42,52,${.7 * under})`;
  for (const spot of SPOTS) { g.beginPath(); g.arc(...wingAt(spot, side, beat), .55, 0, Math.PI * 2); g.fill(); }
};

/** One of the paddle-like fins either side of the mouth, dark outside and pale inside. */
const paintHeadFin = (g: CanvasRenderingContext2D, side: number) => {
  const [baseX, baseY] = view(22, 0, 5 * side);
  g.fillStyle = '#26333e';
  g.beginPath(); g.moveTo(baseX, baseY - 1);
  g.quadraticCurveTo(baseX + 5.5, baseY - 1.2, baseX + 6.5, baseY + 2.2);
  g.quadraticCurveTo(baseX + 4, baseY + 2.8, baseX, baseY + 1.2);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(226,233,237,.8)';
  g.beginPath(); g.ellipse(baseX + 3.6, baseY + .9, 2.2, .7, .25, 0, Math.PI * 2); g.fill();
};

const paintTail = (g: CanvasRenderingContext2D, phase: number) => {
  g.strokeStyle = '#2a3743';
  let previousX = -24, previousY = 0;
  for (let segment = 1; segment <= 12; segment++) {
    const along = segment / 12, x = -24 - along * 35, y = Math.sin(phase * .8 - along * 3) * 2.2 * along;
    g.lineWidth = 1.3 * (1 - along) + .25;
    g.beginPath(); g.moveTo(previousX, previousY); g.lineTo(x, y); g.stroke();
    previousX = x; previousY = y;
  }
};

/** The body's outline seen from a little below, with the white belly under the dark back, and its gill slits. */
const paintBody = (g: CanvasRenderingContext2D) => {
  const edge = BODY.map(([, halfWidth, halfThickness]) => Math.hypot(halfThickness * COS_ELEVATION, halfWidth * SIN_ELEVATION));
  const top = BODY.map(([x], index): Point => [x, -edge[index]]), bottom = BODY.map(([x], index): Point => [x, edge[index]]);
  const belly = g.createLinearGradient(25, 0, -24, 0);
  belly.addColorStop(0, '#eef3f5'); belly.addColorStop(1, '#c4ced5');
  g.fillStyle = belly; traceSmoothShape(g, [[26, 0], ...top, [-25, 0], ...bottom.reverse()]); g.fill();
  const nearSide = BODY.map(([x, halfWidth]) => view(x, 0, halfWidth)); // where the back meets the belly
  g.fillStyle = `rgb(${BACK.join(',')})`; traceSmoothShape(g, [[26, -.5], ...top, [-25, 0], ...nearSide.reverse()]); g.fill();
  g.strokeStyle = 'rgba(60,72,84,.55)'; g.lineWidth = .4;
  for (let slit = 0; slit < 5; slit++) { const x = 9 - slit * 2.2; g.beginPath(); g.moveTo(x, 1); g.lineTo(x - .8, 3.6); g.stroke(); }
  g.strokeStyle = '#2a3540'; g.lineWidth = .8;
  g.beginPath(); g.moveTo(25.2, -.4); g.quadraticCurveTo(26.4, 1.4, 24.6, 3); g.stroke();
};

// Draws a manta ray gliding right in units of length/100 (length is its wingspan), origin mid-body
export const paintManta = (g: CanvasRenderingContext2D, length: number, phase: number) => {
  const beat = Math.sin(phase);
  g.save(); g.scale(length / 100, length / 100);
  g.lineCap = 'round';
  paintTail(g, phase);
  paintWing(g, -1, beat);
  paintHeadFin(g, -1);
  paintBody(g);
  paintWing(g, 1, beat);
  paintHeadFin(g, 1);

  // only the near eye shows, on the side of the head
  const [eyeX, eyeY] = view(18.5, .8, 8);
  g.fillStyle = '#05090c'; g.beginPath(); g.arc(eyeX, eyeY, .85, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(eyeX + .25, eyeY - .25, .25, 0, Math.PI * 2); g.fill();
  g.restore();
};
