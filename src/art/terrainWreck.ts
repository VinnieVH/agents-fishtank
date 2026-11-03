import { shade } from '../util';
import { g } from './sceneryPen';
import type { Point, Stroke } from './sceneryPen';

/** The ship lies on the crest of the hill (`top` is its top edge) nearest x = centerX, drawn `scale` big. */
interface Wreck { centerX: number; top: (x: number) => number; scale: number; color: string; rim: string }

/** The ship's own canvas, in its drawing's units around the waterline at (0, 0). */
const SHEET = { left: -300, top: -400, width: 620, height: 520 };

const HULL = `M150 70 L152 -10 L140 -42 L118 -34 L104 -50 L86 -32 L68 -46 L46 -28 L24 -42 L4 -30
    L-50 -44 Q-96 -50 -116 -62 L-122 -82 L-152 -84 Q-170 -62 -162 -30 Q-142 22 -80 52 L60 70 Z`;

const wreckPen = (sheet: CanvasRenderingContext2D, color: string, rim: string) => {
  const dark = shade(color, -.32);
  const fill = (path: string, fillColor: string) => { sheet.fillStyle = fillColor; sheet.fill(new Path2D(path)); };
  const line = (path: string, { color: lineColor, width, alpha = 1 }: Stroke) => {
    sheet.globalAlpha = alpha; sheet.strokeStyle = lineColor; sheet.lineWidth = width; sheet.stroke(new Path2D(path)); sheet.globalAlpha = 1;
  };
  /** A sail in rags hanging from a yard from (x1, y1) to (x2, y2), `depth` deep: long torn strips with gaps between. */
  const rags = ([x1, y1]: Point, [x2, y2]: Point, depth: number) => {
    let path = `M${x1} ${y1}`;
    for (let strip = 0, count = 6; strip < count; strip++) {
      const start = strip / count, middle = (strip + .55) / count, end = (strip + 1) / count, length = depth * (.45 + ((strip * 7) % 5) / 6);
      const startX = x1 + (x2 - x1) * start, startY = y1 + (y2 - y1) * start, middleX = x1 + (x2 - x1) * middle, middleY = y1 + (y2 - y1) * middle;
      const endX = x1 + (x2 - x1) * end, endY = y1 + (y2 - y1) * end;
      path += ` L${startX + 2} ${startY + length * .7} L${(startX + middleX) / 2 + 3} ${startY + length} L${middleX} ${middleY + length * .5} L${(middleX + endX) / 2} ${middleY + 6} L${endX} ${endY}`;
    }
    fill(path + ' Z', dark);
  };
  /** A pole from (x1, y1) to (x2, y2), `width` thick at the foot, with a lit edge. */
  const pole = ([x1, y1]: Point, [x2, y2]: Point, width: number) => {
    line(`M${x1} ${y1} L${x2} ${y2}`, { color, width }); line(`M${x1 - width * .3} ${y1} L${x2 - width * .3} ${y2}`, { color: rim, width: 1.4, alpha: .5 });
  };
  return { color, rim, dark, fill, line, rags, pole };
};
type WreckPen = ReturnType<typeof wreckPen>;

const paintMasts = ({ dark, line, rags, pole }: WreckPen) => {
  // the second mast, leaning over to the right behind the hull, its yards across it and their sails torn
  pole([40, -40], [170, -250], 7);
  for (const [along, yardWidth] of [[.55, 120], [.85, 90]]) {
    const mastX = 40 + 130 * along, mastY = -40 - 210 * along, halfX = Math.cos(-.55) * yardWidth / 2, halfY = Math.sin(-.55) * yardWidth / 2;
    pole([mastX - halfX, mastY - halfY], [mastX + halfX, mastY + halfY], 4); rags([mastX - halfX, mastY - halfY], [mastX + halfX, mastY + halfY], 46);
  }
  // the main mast, standing, with three yards of torn sails and a crossbar at the top
  pole([-20, -40], [-24, -330], 8);
  for (const [y, yardWidth] of [[-300, 70], [-238, 118], [-168, 150]]) {
    pole([-22 - yardWidth / 2, y], [-22 + yardWidth / 2, y + 4], 4.5); rags([-22 - yardWidth / 2, y + 2], [-22 + yardWidth / 2, y + 6], 58);
  }
  line('M-24 -330 L-152 -192 M-24 -330 L100 -168 M-30 -238 Q-60 -150 -48 -96 M30 -236 Q44 -170 32 -120', { color: dark, width: 1.3, alpha: .8 }); // loose rigging
  // the long pole sticking up from the raised bow
  pole([-136, -78], [-236, -250], 7);
  line('M-236 -250 L-24 -330', { color: dark, width: 1.3, alpha: .8 });
};

/** The hull: the bow raised on the left, its deck broken open along the middle, the stern sunk in on the right. */
const paintHull = (sheet: CanvasRenderingContext2D, { color, rim, dark, fill, line }: WreckPen) => {
  const hull = new Path2D(HULL);
  sheet.fillStyle = color; sheet.fill(hull);
  sheet.save(); sheet.clip(hull);
  fill('M140 -42 L118 -34 L104 -50 L86 -32 L68 -46 L46 -28 L24 -42 L4 -30 L-50 -44 L-50 -24 L150 -16 Z', dark); // its open inside
  line('M-156 -40 Q-40 -18 152 -4 M-146 -10 Q-40 8 152 18', { color: dark, width: 3, alpha: .8 });               // planking
  fill('M-70 -10 L-54 -18 L-40 -8 L-46 6 L-64 4 Z', dark);                                                       // a hole in its side
  sheet.restore();
  line('M-116 -62 L-122 -82 L-152 -84 Q-170 -62 -162 -30', { color: rim, width: 2, alpha: .55 });                // a faint lit edge on the bow
  line('M-50 -44 Q-96 -50 -116 -62', { color: rim, width: 2, alpha: .55 });
};

/**
 * An old sailing ship sunk long ago, far off, in three tones of the distance's blue (its body, shadow and a faint lit
 * edge) and a little see-through. It lists steeply into the hill: the bow, facing left, raised out of it with a long
 * pole sticking up, the stern sunk in. Its deck is broken open, its main mast stands with three yards of torn sails,
 * a second mast leans over to the right, and loose rigging hangs down. Its keel is just under the hill's surface.
 */
export const paintShipwreck = ({ centerX, top, scale, color, rim }: Wreck) => {
  let x = centerX;
  for (let along = centerX - 120; along <= centerX + 120; along += 4) if (top(along) < top(x)) x = along;
  // drawn on a canvas of its own first, then laid over the hill faded all at once
  const resolution = g.getTransform().a;
  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = Math.ceil(SHEET.width * scale * resolution); sheetCanvas.height = Math.ceil(SHEET.height * scale * resolution);
  const sheet = sheetCanvas.getContext('2d');
  if (!sheet) return;
  sheet.scale(scale * resolution, scale * resolution); sheet.translate(-SHEET.left, -SHEET.top); sheet.rotate(.34);
  sheet.lineJoin = 'round'; sheet.lineCap = 'round';
  const pen = wreckPen(sheet, color, rim);
  paintMasts(pen);
  paintHull(sheet, pen);

  g.save(); g.translate(x, top(x) + 4 * scale);
  g.globalAlpha = .82; g.drawImage(sheetCanvas, SHEET.left * scale, SHEET.top * scale, SHEET.width * scale, SHEET.height * scale); g.globalAlpha = 1;
  g.restore();
};
