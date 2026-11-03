// Shows who's waiting while the window is hidden: the waiting count on the Dock icon (macOS) or as an overlay on the
// taskbar button (Windows), and, when the user turns it on, a tray icon coloured by the most urgent state.
import type { BrowserWindow } from 'electron';
import { app, Menu, nativeImage, Tray } from 'electron';
import type { Snapshot, State } from '../shared/types.ts';
import { ICON_SIZE, paintBadge, paintTrayDot, trayTooltip, urgentState, waitingCount } from './badge.ts';

export interface IndicatorsOptions {
  window: () => BrowserWindow | null;
  show: () => void;
}

const imageOf = (bitmap: Buffer) => nativeImage.createFromBitmap(bitmap, { width: ICON_SIZE, height: ICON_SIZE, scaleFactor: 2 });

export const createIndicators = ({ window, show }: IndicatorsOptions) => {
  let shownCount = -1, overlayWindow: BrowserWindow | null = null, tray: Tray | null = null, trayState: State | null | undefined;

  const showCount = (count: number) => {
    const target = window();
    // a new window (or none) has no overlay yet, whatever the count was
    if (count === shownCount && target === overlayWindow) return;
    shownCount = count; overlayWindow = target;
    if (process.platform !== 'win32') { app.setBadgeCount(count); return; }
    const badge = paintBadge(count);
    target?.setOverlayIcon(badge && imageOf(badge), badge ? `${count} waiting` : '');
  };

  const createTray = () => {
    const created = new Tray(imageOf(paintTrayDot(null)));
    created.setContextMenu(Menu.buildFromTemplate([{ label: 'Show the Fishtank', click: show }, { type: 'separator' }, { role: 'quit' }]));
    created.on('click', show); // Windows; on macOS a click opens the menu
    return created;
  };

  const showTray = (isOn: boolean, sessions: Snapshot['sessions']) => {
    if (!isOn) { tray?.destroy(); tray = null; trayState = undefined; return; }
    tray ??= createTray();
    tray.setToolTip(trayTooltip(sessions));
    const state = urgentState(sessions);
    if (state === trayState) return;
    trayState = state;
    tray.setImage(imageOf(paintTrayDot(state)));
  };

  /** Brings the badge and tray up to date with the latest snapshot (once a second). */
  const update = (sessions: Snapshot['sessions'], isTrayOn: boolean) => {
    showCount(waitingCount(sessions));
    showTray(isTrayOn, sessions);
  };

  return { update };
};
