// The waiting count and the most urgent state, for when the tank's window is hidden: a badge with the number of
// waiting sessions on the Dock or taskbar icon, and the tray icon's colour. Electron can't draw text into an icon,
// so the badge and the dot are painted here as raw BGRA bitmaps, with a tiny digit font.
import type { Session, State } from '../shared/types.ts';

export const ICON_SIZE = 32; // pixels, shown at 16 points (scale factor 2) so it stays sharp on high-DPI screens

type Rgb = readonly [number, number, number];

const BADGE_RED: Rgb = [0xc4, 0x2b, 0x1c]; // Windows 11's own badge red, so it looks like other apps' badges
const BADGE_RING: Rgb = [0x20, 0x20, 0x20];
const WHITE: Rgb = [0xff, 0xff, 0xff];
/** The tank's own colours (src/style.css): amber for a session that needs you, green for working, grey for idle. */
export const STATE_COLORS: Record<State, Rgb> = { waiting: [0xff, 0xc9, 0x4d], working: [0x39, 0xff, 0x88], idle: [0x5f, 0x7c, 0x99] };

// 3 x 5 pixels per character, a row per string, '#' is on
const GLYPHS: Record<string, string[]> = {
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '.##', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'], '+': ['...', '.#.', '###', '.#.', '...'],
};
const GLYPH_WIDTH = 3, GLYPH_HEIGHT = 5, GLYPH_GAP = 1;

export const waitingCount = (sessions: Pick<Session, 'state'>[]) => sessions.filter(session => session.state === 'waiting').length;

/** Waiting beats working beats idle; null when there are no sessions. */
export const urgentState = (sessions: Pick<Session, 'state'>[]): State | null => {
  const states = new Set(sessions.map(session => session.state));
  return (['waiting', 'working', 'idle'] as const).find(state => states.has(state)) ?? null;
};

/** What the badge says: nothing for none, up to 9, then 9+. */
export const badgeText = (count: number) => count <= 0 ? '' : count > 9 ? '9+' : String(count);

const STATE_LABELS: Record<State, string> = { waiting: 'needs you', working: 'working', idle: 'idle' };

/** The tray icon's tooltip: how many sessions there are, and how many need you. */
export const trayTooltip = (sessions: Pick<Session, 'state'>[]) => {
  const waiting = waitingCount(sessions), state = urgentState(sessions);
  if (!state) return 'Agent Fishtank: no sessions';
  if (waiting) return `Agent Fishtank: ${waiting} session${waiting === 1 ? ' needs' : 's need'} you`;
  return `Agent Fishtank: ${sessions.length} session${sessions.length === 1 ? '' : 's'}, ${STATE_LABELS[state]}`;
};

const newBitmap = () => Buffer.alloc(ICON_SIZE * ICON_SIZE * 4);

// oxlint-disable-next-line max-params -- called for each of the 1024 pixels of an icon
const setPixel = (bitmap: Buffer, x: number, y: number, [red, green, blue]: Rgb, alpha = 1) => {
  const offset = (y * ICON_SIZE + x) * 4;
  const below = bitmap[offset + 3] / 255, total = alpha + below * (1 - alpha);
  const mix = (channel: number, color: number) => Math.round((color * alpha + bitmap[offset + channel] * below * (1 - alpha)) / total);
  bitmap[offset] = mix(0, blue); bitmap[offset + 1] = mix(1, green); bitmap[offset + 2] = mix(2, red);
  bitmap[offset + 3] = Math.round(total * 255);
};

/** A filled circle over the whole icon, with a soft edge. */
const paintDisc = (bitmap: Buffer, color: Rgb, radius: number) => {
  const centre = ICON_SIZE / 2;
  for (let y = 0; y < ICON_SIZE; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      const coverage = Math.min(1, Math.max(0, radius - Math.hypot(x + .5 - centre, y + .5 - centre) + .5));
      if (coverage > 0) setPixel(bitmap, x, y, color, coverage);
    }
  }
};

const paintText = (bitmap: Buffer, text: string, scale: number) => {
  const width = (text.length * (GLYPH_WIDTH + GLYPH_GAP) - GLYPH_GAP) * scale;
  const left = Math.round((ICON_SIZE - width) / 2), top = Math.round((ICON_SIZE - GLYPH_HEIGHT * scale) / 2);
  [...text].forEach((character, index) => {
    const glyphLeft = left + index * (GLYPH_WIDTH + GLYPH_GAP) * scale;
    GLYPHS[character].forEach((row, rowIndex) => [...row].forEach((pixel, column) => {
      if (pixel !== '#') return;
      for (let step = 0; step < scale * scale; step++) {
        setPixel(bitmap, glyphLeft + column * scale + (step % scale), top + rowIndex * scale + Math.floor(step / scale), WHITE);
      }
    }));
  });
};

/** The red badge with the waiting count and a thin dark ring (the Windows taskbar overlay); null when nobody waits. */
export const paintBadge = (count: number) => {
  const text = badgeText(count);
  if (!text) return null;
  const bitmap = newBitmap();
  paintDisc(bitmap, BADGE_RING, ICON_SIZE / 2);
  paintDisc(bitmap, BADGE_RED, ICON_SIZE / 2 - 2);
  paintText(bitmap, text, text.length > 1 ? 3 : 4);
  return bitmap;
};

/** The tray icon: a dot in the colour of the most urgent state, grey without sessions. */
export const paintTrayDot = (state: State | null) => {
  const bitmap = newBitmap();
  paintDisc(bitmap, STATE_COLORS[state ?? 'idle'], ICON_SIZE * .38);
  return bitmap;
};
