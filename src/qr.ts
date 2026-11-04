import { encode } from 'uqr';

const SVG = 'http://www.w3.org/2000/svg';
const QUIET = 2; // light modules around it, which scanners need to find it

/** A QR code of `text` as an SVG, dark on light whatever the theme, with one path for all its dark modules. */
export const qrCode = (text: string, label: string) => {
  const { data, size } = encode(text, { border: 0 });
  const squares = data.flatMap((row, y) => row.flatMap((isDark, x) => isDark ? [`M${x + QUIET} ${y + QUIET}h1v1h-1z`] : []));
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size + 2 * QUIET} ${size + 2 * QUIET}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  svg.setAttribute('shape-rendering', 'crispEdges');
  const background = document.createElementNS(SVG, 'rect');
  background.setAttribute('width', '100%'); background.setAttribute('height', '100%'); background.setAttribute('fill', '#fff');
  const modules = document.createElementNS(SVG, 'path');
  modules.setAttribute('d', squares.join(''));
  modules.setAttribute('fill', '#000');
  svg.append(background, modules);
  return svg;
};
