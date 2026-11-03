import { rng, shade, TAU } from '../util';
import type { Coral, HardKind } from './reefLayout';
import { smoothOutline } from './reefRock';
import { ellipse, g, toon } from './sceneryPen';
import type { Point } from './sceneryPen';

type HardCoral = Coral<HardKind>;
interface Branch { x: number; y: number; length: number; angle: number; width: number; depth: number }
/** A staghorn branch as [fromX, fromY, toX, toY, width]. */
type Segment = [number, number, number, number, number];

/** Branching staghorn coral, thick branches with pale, round tips. */
const paintStaghorn = (coral: HardCoral, random: () => number) => {
  const segments: Segment[] = [];
  const grow = ({ x, y, length, angle, width, depth }: Branch): void => {
    if (!depth || length < 5) return;
    const endX = x + Math.cos(angle) * length, endY = y + Math.sin(angle) * length;
    segments.push([x, y, endX, endY, width]);
    grow({ x: endX, y: endY, length: length * .76, angle: angle - .3 - random() * .3, width: width * .78, depth: depth - 1 });
    if (random() < .85) grow({ x: endX, y: endY, length: length * .76, angle: angle + .3 + random() * .3, width: width * .78, depth: depth - 1 });
  };
  for (const spread of [-.45, 0, .45]) grow({ x: coral.x, y: coral.y, length: coral.size * .3, angle: -Math.PI / 2 + spread + (random() - .5) * .2, width: coral.size * .14, depth: 4 });
  g.lineCap = 'round';
  const pass = ({ color, extra, scale = 1, shift = 0 }: { color: string; extra: number; scale?: number; shift?: number }) => {
    g.strokeStyle = color;
    for (const [fromX, fromY, toX, toY, width] of segments) {
      g.lineWidth = width * scale + extra; g.beginPath(); g.moveTo(fromX + shift * width, fromY); g.lineTo(toX + shift * width, toY); g.stroke();
    }
  };
  pass({ color: shade(coral.color, -.65), extra: 3.4 }); pass({ color: coral.color, extra: 0 }); pass({ color: shade(coral.color, .4), extra: 0, scale: .3, shift: -.25 });
  const tips = new Set(segments.map(segment => segment[2] + ',' + segment[3]));
  for (const segment of segments) tips.delete(segment[0] + ',' + segment[1]);
  for (const [, , toX, toY, width] of segments) {
    if (tips.has(toX + ',' + toY)) ellipse({ x: toX, y: toY, radiusX: width * .45 + 1, radiusY: width * .45 + 1, color: shade(coral.color, .7) });
  }
};

/** Table coral: flat, wavy-edged plates stacked on a short stalk, dotted with polyps. */
const paintTable = (coral: HardCoral, random: () => number) => {
  const inkColor = shade(coral.color, -.7), size = coral.size;
  const stalk = new Path2D(); stalk.roundRect(coral.x - size * .06, coral.y - size * .3, size * .12, size * .3 + 2, 3);
  toon(stalk, { fill: shade(coral.color, -.3), inkColor, width: 2 });
  for (let plate = 0; plate < 3; plate++) {
    const centerX = coral.x + (random() - .5) * size * .15, centerY = coral.y - size * (.28 + plate * .16), radiusX = size * (.5 - plate * .12), radiusY = size * .09;
    const points = Array.from({ length: 18 }, (_, corner): Point => {
      const angle = corner / 18 * TAU;
      return [centerX + Math.cos(angle) * radiusX * (1 + Math.sin(angle * 5 + plate) * .05), centerY + Math.sin(angle) * radiusY * (1 + (random() - .5) * .3)];
    });
    toon(smoothOutline(points), { fill: shade(coral.color, plate * .08 - .05), inkColor, width: 2 }, () => {
      ellipse({ x: centerX, y: centerY + radiusY * .6, radiusX, radiusY: radiusY * .7, color: shade(coral.color, -.3) }); // its underside
      ellipse({ x: centerX - radiusX * .2, y: centerY - radiusY * .3, radiusX: radiusX * .6, radiusY: radiusY * .35, color: shade(coral.color, .35) });
      for (let polyp = 0; polyp < radiusX / 4; polyp++) {
        ellipse({ x: centerX + (random() - .5) * radiusX * 1.7, y: centerY - random() * radiusY * .6, radiusX: 1.2, radiusY: .8, color: shade(coral.color, .55) });
      }
    });
  }
};

/** A brain coral: a dome with meandering grooves. */
const paintBrain = (coral: HardCoral, random: () => number) => {
  const { x, y, size: radius } = coral, dome = new Path2D();
  dome.arc(x, y, radius, Math.PI, TAU); dome.closePath();
  toon(dome, { fill: coral.color, inkColor: shade(coral.color, -.7), width: 2.4 }, () => {
    ellipse({ x: x + radius * .7, y, radiusX: radius * .7, radiusY: radius * 1.1, color: shade(coral.color, -.2) });
    g.strokeStyle = shade(coral.color, -.4); g.lineWidth = 2;
    for (let groove = 1; groove < 5; groove++) {
      g.beginPath();
      for (let angle = Math.PI; angle <= TAU; angle += .07) {
        const reach = radius * groove / 5 + Math.sin(angle * 9 + groove + random() * .3) * 2.2;
        g.lineTo(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach);
      }
      g.stroke();
    }
    ellipse({ x: x - radius * .4, y: y - radius * .62, radiusX: radius * .22, radiusY: radius * .1, rotation: -.5, color: shade(coral.color, .5) });
  });
};

/** A toadstool leather coral: a thick pale stalk under a wide, ruffled cap covered in tiny polyps. */
const paintLeather = (coral: HardCoral, random: () => number) => {
  const { x, y, size } = coral, inkColor = shade(coral.color, -.7);
  const stalk = new Path2D(); stalk.moveTo(x - size * .16, y + 2); stalk.quadraticCurveTo(x - size * .1, y - size * .4, x - size * .14, y - size * .6);
  stalk.lineTo(x + size * .14, y - size * .6); stalk.quadraticCurveTo(x + size * .1, y - size * .4, x + size * .16, y + 2); stalk.closePath();
  toon(stalk, { fill: shade(coral.color, .45), inkColor, width: 2 }, () => ellipse({ x: x + size * .1, y: y - size * .3, radiusX: size * .08, radiusY: size * .4, color: shade(coral.color, .2) }));
  const cap = new Path2D(), capHalf = size * .55, top = y - size;
  cap.moveTo(x - capHalf, y - size * .58);
  cap.quadraticCurveTo(x - capHalf * .9, top, x, top - size * .05); cap.quadraticCurveTo(x + capHalf * .9, top, x + capHalf, y - size * .58);
  for (let ruffle = 8; ruffle >= 0; ruffle--) cap.lineTo(x - capHalf + ruffle / 8 * capHalf * 2, y - size * .58 + (ruffle % 2 ? 6 : 0));
  cap.closePath();
  toon(cap, { fill: coral.color, inkColor, width: 2.2 }, () => {
    ellipse({ x: x + capHalf * .45, y: y - size * .7, radiusX: capHalf * .6, radiusY: size * .3, color: shade(coral.color, -.22) });
    ellipse({ x: x - capHalf * .3, y: y - size * .92, radiusX: capHalf * .45, radiusY: size * .1, rotation: -.1, color: shade(coral.color, .35) });
    for (let polyp = 0; polyp < size * .8; polyp++) {
      ellipse({ x: x + (random() - .5) * capHalf * 1.9, y: y - size * (.62 + random() * .4), radiusX: .9, radiusY: .9, color: shade(coral.color, .55), alpha: .8 });
    }
  });
};

/** Green star polyps: a fuzzy mound with tiny bright stars all over it. */
const paintPolyps = (coral: HardCoral, random: () => number) => {
  const { x, y, size: radius } = coral;
  const mound = smoothOutline(Array.from({ length: 10 }, (_, corner): Point => {
    const angle = Math.PI + corner / 9 * Math.PI, wobble = 1 + (random() - .5) * .25;
    return [x + Math.cos(angle) * radius * 1.2 * wobble, y + Math.sin(angle) * radius * wobble];
  }));
  toon(mound, { fill: coral.color, inkColor: shade(coral.color, -.7), width: 2 }, () => {
    ellipse({ x: x + radius * .5, y, radiusX: radius * .8, radiusY: radius, color: shade(coral.color, -.25) });
    for (let polyp = 0; polyp < radius * 3; polyp++) {
      const polypX = x + (random() - .5) * radius * 2.2, polypY = y - random() * radius;
      for (let arm = 0; arm < 5; arm++) {
        ellipse({ x: polypX + Math.cos(arm * TAU / 5) * 1.6, y: polypY + Math.sin(arm * TAU / 5) * 1.6, radiusX: 1, radiusY: .5, rotation: arm * TAU / 5, color: shade(coral.color, .6) });
      }
      ellipse({ x: polypX, y: polypY, radiusX: .9, radiusY: .9, color: shade(coral.color, -.4) });
    }
  });
};

/** A carpet of zoanthids: little round polyps with a bright mouth in the middle. */
const paintZoas = (coral: HardCoral, random: () => number) => {
  for (let polyp = 0, count = 8 + Math.floor(coral.size / 3); polyp < count; polyp++) {
    const angle = random() * TAU, distance = Math.sqrt(random()) * coral.size * .6;
    const polypX = coral.x + Math.cos(angle) * distance, polypY = coral.y - 4 + Math.sin(angle) * distance * .45, size = 3 + random() * 2.4;
    const disc = new Path2D(); disc.ellipse(polypX, polypY, size, size * .8, 0, 0, TAU);
    toon(disc, { fill: coral.color, inkColor: shade(coral.color, -.7), width: 1.2 }, () => {
      ellipse({ x: polypX, y: polypY, radiusX: size * .55, radiusY: size * .45, color: shade(coral.color, -.3) });
      ellipse({ x: polypX, y: polypY, radiusX: size * .25, radiusY: size * .2, color: '#e8ff9a' });
    });
  }
};

const HARD_CORAL_PAINTERS: Record<HardKind, (coral: HardCoral, random: () => number) => void> = {
  staghorn: paintStaghorn, table: paintTable, brain: paintBrain, leather: paintLeather, polyps: paintPolyps, zoas: paintZoas,
};

/** A hard coral, its own dice seeded so it always looks the same. */
export const paintHardCoral = (coral: HardCoral) => HARD_CORAL_PAINTERS[coral.kind](coral, rng(coral.seed));
