import { describe, expect, it } from 'vitest';
import { badgeText, ICON_SIZE, paintBadge, paintTrayDot, STATE_COLORS, trayTooltip, urgentState, waitingCount } from '../electron/badge';
import type { State } from '../shared/types';

const sessionsIn = (...states: State[]) => states.map(state => ({ state }));

/** The colour and opacity of the icon's pixel at (x, y), as [red, green, blue, alpha]. */
const pixelAt = (bitmap: Buffer, x: number, y: number) => {
  const offset = (y * ICON_SIZE + x) * 4;
  return [bitmap[offset + 2], bitmap[offset + 1], bitmap[offset], bitmap[offset + 3]];
};

const whitePixels = (bitmap: Buffer) => {
  let count = 0;
  for (let index = 0; index < bitmap.length; index += 4) if (bitmap[index] === 255 && bitmap[index + 1] === 255 && bitmap[index + 2] === 255) count++;
  return count;
};

describe('waiting count', () => {
  it('counts the sessions that need you', () => {
    expect(waitingCount(sessionsIn('waiting', 'working', 'waiting', 'idle'))).toBe(2);
    expect(waitingCount([])).toBe(0);
  });

  it('shows nothing for none, then up to 9, then 9+', () => {
    expect([0, 1, 9, 10, 42].map(badgeText)).toEqual(['', '1', '9', '9+', '9+']);
  });
});

describe('most urgent state', () => {
  it('is waiting over working over idle', () => {
    expect(urgentState(sessionsIn('idle', 'working', 'waiting'))).toBe('waiting');
    expect(urgentState(sessionsIn('idle', 'working'))).toBe('working');
    expect(urgentState(sessionsIn('idle'))).toBe('idle');
    expect(urgentState([])).toBeNull();
  });

  it('says it in the tray tooltip', () => {
    expect(trayTooltip([])).toBe('Agent Fishtank: no sessions');
    expect(trayTooltip(sessionsIn('waiting', 'working'))).toBe('Agent Fishtank: 1 session needs you');
    expect(trayTooltip(sessionsIn('waiting', 'waiting'))).toBe('Agent Fishtank: 2 sessions need you');
    expect(trayTooltip(sessionsIn('working', 'idle'))).toBe('Agent Fishtank: 2 sessions, working');
  });
});

describe('icons', () => {
  it('has no badge when nobody waits', () => {
    expect(paintBadge(0)).toBeNull();
  });

  it('paints a red badge with a dark ring, the count in white, and transparent corners', () => {
    const badge = paintBadge(3)!;
    expect(badge.length).toBe(ICON_SIZE * ICON_SIZE * 4);
    expect(pixelAt(badge, 0, 0)[3]).toBe(0);
    expect(pixelAt(badge, 1, ICON_SIZE / 2)).toEqual([0x20, 0x20, 0x20, 255]);
    expect(pixelAt(badge, 4, ICON_SIZE / 2)).toEqual([0xc4, 0x2b, 0x1c, 255]);
    expect(whitePixels(badge)).toBeGreaterThan(0);
    expect(whitePixels(paintBadge(3)!)).not.toBe(whitePixels(paintBadge(8)!));
  });

  it('colours the tray dot by state, grey without sessions', () => {
    const centre = ICON_SIZE / 2;
    expect(pixelAt(paintTrayDot('waiting'), centre, centre)).toEqual([...STATE_COLORS.waiting, 255]);
    expect(pixelAt(paintTrayDot('working'), centre, centre)).toEqual([...STATE_COLORS.working, 255]);
    expect(pixelAt(paintTrayDot(null), centre, centre)).toEqual([...STATE_COLORS.idle, 255]);
    expect(pixelAt(paintTrayDot('waiting'), 0, 0)[3]).toBe(0);
  });
});
