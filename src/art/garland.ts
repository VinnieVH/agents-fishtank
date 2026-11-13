import type { SeasonId } from '../seasons';
import { drawInto, ellipse } from './sceneryPen';
import type { Point } from './sceneryPen';
import { dot, line, solid, stroke } from './shapes';

interface Garland { kind: 'flag' | 'bulb'; colors: string[] }

/** The string of bunting or lights hung across the top of the tank. */
export const GARLAND_HEIGHT = 56;
const SPAN = 420;
const SAG = 30;
const SPACING = 36;

const GARLANDS: Record<SeasonId, Garland> = {
  lunar: { kind: 'bulb', colors: ['#e8312f', '#ffd23d'] },
  love: { kind: 'flag', colors: ['#ff4d79', '#ffb3c7', '#ffffff'] },
  spring: { kind: 'flag', colors: ['#ffc2e2', '#bfeab5', '#fff3a8', '#c4dcff'] },
  midsummer: { kind: 'flag', colors: ['#ff8a1c', '#ffd23d', '#e8312f'] },
  brewfest: { kind: 'flag', colors: ['#2f6fdb', '#ffffff'] },
  halloween: { kind: 'flag', colors: ['#ff8a1c', '#5b3a82', '#7bd88f'] },
  thanksgiving: { kind: 'flag', colors: ['#c76b1f', '#8a3b12', '#e0a030'] },
  winter: { kind: 'bulb', colors: ['#e8312f', '#3fbf5f', '#ffd23d', '#4cc9f0'] },
};

const hang = ([x, y]: Point, kind: Garland['kind'], color: string) => {
  if (kind === 'flag') { solid(new Path2D(`M${x - 9} ${y} L${x + 9} ${y} L${x} ${y + 22} Z`), color); return; }
  stroke(line([x, y], [x, y + 5]), '#222', 1.2);
  ellipse({ x, y: y + 10, radiusX: 12, radiusY: 12, color, alpha: .22 });
  dot(x, y + 10, 5, color);
};

export const paintGarland = (context: CanvasRenderingContext2D, { width, season }: { width: number; season: SeasonId }) => {
  drawInto(context);
  const { kind, colors } = GARLANDS[season], swags = Math.max(2, Math.round(width / SPAN)), span = width / swags;
  for (let swag = 0; swag < swags; swag++) {
    const at = (share: number): Point => [swag * span + share * span, 3 + 4 * SAG * share * (1 - share)];
    stroke(line(...Array.from({ length: 25 }, (_, step) => at(step / 24))), '#2a2a2a', 1.6);
    const count = Math.floor(span / SPACING);
    for (let index = 0; index < count; index++) hang(at((index + .5) / count), kind, colors[(swag + index) % colors.length]);
  }
};
