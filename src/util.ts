export const TAU = Math.PI * 2;

/** Small deterministic PRNG (mulberry32) so scenery looks the same on every load. */
export const rng = (seed: number): () => number => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

/** FNV-1a string hash. */
export const hash = (text: string): number => {
  let hashed = 2166136261;
  for (const char of text) hashed = Math.imul(hashed ^ char.charCodeAt(0), 16777619);
  return hashed >>> 0;
};

/** Lighten (amount > 0) or darken (amount < 0) a #rrggbb colour, or an rgb(...) one it returned before. */
export const shade = (hex: string, amount: number): string => {
  const rgbMatch = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(hex), packed = parseInt(hex.slice(1), 16);
  const [red, green, blue] = rgbMatch
    ? [+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]]
    : [packed >> 16, packed >> 8 & 255, packed & 255];
  const shadeChannel = (channel: number) =>
    Math.round(amount < 0 ? channel * (1 + amount) : channel + (255 - channel) * amount);
  return `rgb(${shadeChannel(red)},${shadeChannel(green)},${shadeChannel(blue)})`;
};

/** Tint for things drawn in front of the night overlay, so they darken the same way as the scenery behind them. */
export const nightTint = (night: number): number => {
  const darkness = .66 * night;
  const mix = (channel: number) => Math.round(255 * (1 - darkness) + channel * darkness);
  return mix(0x02) << 16 | mix(0x08) << 8 | mix(0x1a);
};

const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (text: unknown): string => String(text).replace(/[&<>"']/g, char => HTML_ENTITIES[char]);

export const formatDuration = (ms: number): string => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return seconds + 's';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + (seconds % 60) + 's';
  return Math.floor(seconds / 3600) + 'h ' + Math.floor(seconds % 3600 / 60) + 'm';
};

export const smooth = (from: number, to: number, x: number): number => {
  const progress = Math.max(0, Math.min(1, (x - from) / (to - from)));
  return progress * progress * (3 - 2 * progress);
};
