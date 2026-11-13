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

export const candyCane = () => {
  shadow(8); const hook = new Path2D(); hook.moveTo(0, 0); hook.lineTo(0, -30); hook.arc(-6, -30, 6, 0, -Math.PI, true);
  g.lineCap = 'round'; g.strokeStyle = '#6b1018'; g.lineWidth = 7.6; g.stroke(hook);
  g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke(hook);
  g.strokeStyle = '#e8283f'; g.lineWidth = 5; g.setLineDash([3.2, 5.2]); g.stroke(hook); g.setLineDash([]);
};
