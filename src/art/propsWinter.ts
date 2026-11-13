import { shade } from '../util';
import { ellipse, g, toon } from './sceneryPen';
import { dot, oval, shadow } from './shapes';

// Props for the winter sea floor, drawn standing on the sand at (0, 0), up being negative y.

const WRAPS = [['#d8232a', '#ffd23d'], ['#3d6bff', '#fff'], ['#2f9a4a', '#ff5c8a'], ['#8a3ffc', '#ffd23d'], ['#ff8a1c', '#fff'], ['#12b5b0', '#ff5c8a'], ['#ff5c9a', '#fff'], ['#f2c230', '#d8232a']];
/** Half the width and the height of a gift: square, long, tall and small. */
const SHAPES: [number, number][] = [[13, 20], [21, 12], [10, 28], [9, 14]];

/** A gift: its index picks the wrapping (index % 8) and the shape (every 8 further on). Shaded like the corals: a dark side, a light rim, a shine. */
export const gift = (index = 0) => {
  const [wrap, ribbon] = WRAPS[index % WRAPS.length], [w, h] = SHAPES[Math.floor(index / WRAPS.length) % SHAPES.length];
  const box = new Path2D(); box.roundRect(-w, -h, w * 2, h, 3);
  shadow(w + 3);
  toon(box, { fill: wrap, inkColor: shade(wrap, -.7), width: 2 }, () => {
    g.fillStyle = shade(wrap, -.28); g.fillRect(w * .4, -h, w, h);
    g.fillStyle = shade(wrap, .35); g.fillRect(-w, -h, w * .28, h);
    g.fillStyle = shade(ribbon, -.2); g.fillRect(-2.8, -h, 5.6, h);
    g.fillStyle = ribbon; g.fillRect(-2.2, -h, 4.4, h);
    g.fillStyle = ribbon; g.fillRect(-w, -h * .55, w * 2, 3.6);
    ellipse({ x: -w * .55, y: -h * .8, radiusX: 1.8, radiusY: 1, rotation: -.6, color: '#fff', alpha: .8 });
  });
  const loop = (side: number) => toon(oval(side * 5.4, -h - 3.4, 5, 3.2, side * .5), { fill: ribbon, inkColor: shade(ribbon, -.7), width: 1.6 });
  loop(-1); loop(1); dot(0, -h - 1.4, 2, ribbon);
};

const CANE_HOOK_RADIUS = 6, CANE_STRAIGHT = 30, CANE_WIDTH = 5;

/** The cane's centre line (a straight pole and the hook over the top): the point `along` it, and the direction it runs in. */
const caneAt = (along: number) => {
  if (along <= CANE_STRAIGHT) return { x: 0, y: -along, tx: 0, ty: -1 };
  const turn = (along - CANE_STRAIGHT) / CANE_HOOK_RADIUS;
  return {
    x: -CANE_HOOK_RADIUS + CANE_HOOK_RADIUS * Math.cos(turn), y: -CANE_STRAIGHT - CANE_HOOK_RADIUS * Math.sin(turn),
    tx: -Math.sin(turn), ty: -Math.cos(turn),
  };
};

/** The white band of the cane (without its round ends), to keep the stripes inside it. */
const caneBand = () => {
  const band = new Path2D(), half = CANE_WIDTH / 2, hook = CANE_HOOK_RADIUS;
  band.moveTo(half, 0); band.lineTo(half, -CANE_STRAIGHT);
  band.arc(-hook, -CANE_STRAIGHT, hook + half, 0, -Math.PI, true);
  band.lineTo(-hook - (hook - half), -CANE_STRAIGHT);
  band.arc(-hook, -CANE_STRAIGHT, hook - half, -Math.PI, 0, false);
  band.lineTo(-half, 0); band.closePath();
  return band;
};

/** A candy cane: a white cane with red stripes that wind round it, slanting across its width. */
export const candyCane = () => {
  shadow(8); const hook = new Path2D(); hook.moveTo(0, 0); hook.lineTo(0, -CANE_STRAIGHT); hook.arc(-CANE_HOOK_RADIUS, -CANE_STRAIGHT, CANE_HOOK_RADIUS, 0, -Math.PI, true);
  g.lineCap = 'round'; g.strokeStyle = '#6b1018'; g.lineWidth = CANE_WIDTH + 2.6; g.stroke(hook);
  g.strokeStyle = '#fff'; g.lineWidth = CANE_WIDTH; g.stroke(hook);
  g.save(); g.clip(caneBand());
  g.strokeStyle = '#e8283f'; g.lineWidth = 1.8; g.lineCap = 'butt';
  const half = CANE_WIDTH / 2 + 1, lean = 2.4;
  for (let along = 1; along < CANE_STRAIGHT + Math.PI * CANE_HOOK_RADIUS + 2; along += 4.6) {
    const { x, y, tx, ty } = caneAt(along);
    g.beginPath();
    g.moveTo(x - ty * half - tx * lean, y + tx * half - ty * lean);
    g.lineTo(x + ty * half + tx * lean, y - tx * half + ty * lean);
    g.stroke();
  }
  g.restore();
};
