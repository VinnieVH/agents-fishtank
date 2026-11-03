// The Agent Fishtank desktop app: runs the fishtank server and shows the tank in its own window.
// Claude Code and Copilot CLI start it from a session-start hook (electron/cli.ts start); it quits once the last
// session has closed, unless the settings say to keep running. Closing the window while it keeps running only hides
// it: Claude Code's hooks keep posting to it.
import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, dialog, Menu, Notification, shell, type MenuItemConstructorOptions } from 'electron';
import type { Session, Snapshot, State as SessionState } from '../shared/types.ts';
import type { Settings } from '../shared/settings.ts';
import { DEFAULT_PORT, startServer, type Fishtank } from '../server/server.ts';
import { connect, connected, disconnect, installed, places, type Cli, type Launcher } from './connect.ts';
import { createIndicators } from './indicators.ts';
import { repoFrom } from './releases.ts';
import { Terminals, type Remembered } from './terminals.ts';
import { Updates } from './updates.ts';

const port = Number(process.env.FISHTANK_PORT) || DEFAULT_PORT;
const isFromHook = process.argv.includes('--from-hook');
// started with the computer (the "open at login" setting): stays in the background
const isAtLogin = process.argv.includes('--at-login') || (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin);
const folders = places();
const isMac = process.platform === 'darwin';
const NAMES: Record<Cli, string> = { claude: 'Claude Code', copilot: 'GitHub Copilot CLI' };
const CLIS: Cli[] = ['claude', 'copilot'];
// The page's options, given to the app as --whale, --time=22:30, --lat=51.05 ... (see README)
const PAGE_OPTIONS = ['lat', 'lon', 'time', 'timelapse', 'whale', 'shark', 'orca', 'manta', 'dolphins', 'jellyfish', 'submarine', 'kraken', 'crab'];

let tank: Fishtank | null = null;
let updates: Updates | null = null;
let tankWindow: BrowserWindow | null = null;
let pageUrl = '';
let terminals: Terminals | null = null;
let isQuitting = false;

const applySettings = (settings: Settings) => {
  // only the installed app can start with the computer; `npm run app` would register Electron itself
  if (!app.isPackaged || app.getLoginItemSettings().openAtLogin === settings.openAtLogin) return;
  app.setLoginItemSettings({ openAtLogin: settings.openAtLogin, args: ['--at-login'] });
};

/** Keeps running with no sessions: closing the window then hides it, and only Quit ends the app. */
const isStaying = () => isAtLogin || !(tank?.settings().quitWhenIdle ?? true);

let isRevealed = false;
/** Shows the window, filling the screen the first time: there's room for the terminals next to the tank. */
const reveal = () => {
  if (!tankWindow) return;
  if (!isRevealed) { isRevealed = true; tankWindow.maximize(); }
  tankWindow.show();
};

const show = () => {
  if (!tankWindow) return;
  if (tankWindow.isMinimized()) tankWindow.restore();
  reveal();
  tankWindow.focus();
};

const notify = (title: string, body: string) => {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title, body, silent: false });
  notification.on('click', show);
  notification.show();
};

/** A session's state, since when, the one before it, and whether that's been dealt with (told, or not news). */
interface Watch { state: SessionState; since: number; from?: SessionState; done: boolean }

let watched: Map<string, Watch> | null = null;
const indicators = createIndicators({ window: () => tankWindow, show });

/** The session's watch: the one before while its state stays, else a new one. */
const watchOf = (session: Session, before: Map<string, Watch> | null, time: number): Watch => {
  const previous = before?.get(session.id);
  // the sessions there when the app started aren't news
  return previous && previous.state === session.state ? previous : { state: session.state, since: time, from: previous?.state, done: !before };
};

const notifyAbout = (session: Session, watch: Watch, settings: Settings) => {
  const cli = session.source === 'claude' ? 'Claude Code' : 'Copilot CLI';
  if (session.state === 'waiting' && settings.notifyWaiting) notify(`${session.name} needs you`, `${cli} is waiting for your answer.`);
  else if (session.state === 'idle' && watch.from === 'working' && settings.notifyFinished) notify(`${session.name} is done`, `${cli} finished and waits for your next message.`);
};

const isWindowHidden = () => !!tankWindow && !tankWindow.isVisible();
const isFirstSession = (before: Map<string, Watch> | null, snapshot: Snapshot) => before?.size === 0 && snapshot.sessions.length > 0;
const isDue = (watch: Watch, time: number, settings: Settings) => !watch.done && time - watch.since >= settings.notifyAfter * 1000;
const isWindowInFront = () => !!tankWindow && tankWindow.isVisible() && tankWindow.isFocused();

/**
 * Opens the window when the first session starts, and notifies when a session has been waiting for an answer, or
 * done, for a while (notifyAfter): by then you're clearly not in that session already.
 */
const watchSessions = (snapshot: Snapshot) => {
  const settings = tank?.settings();
  if (!settings) return;
  indicators.update(snapshot.sessions, settings.trayIcon);
  const before = watched;
  if (settings.openOnSession && isFirstSession(before, snapshot) && isWindowHidden()) show();
  const current = new Map<string, Watch>();
  watched = current;
  const isInFront = isWindowInFront();
  for (const session of snapshot.sessions) {
    const watch = watchOf(session, before, snapshot.time);
    current.set(session.id, watch);
    if (!isDue(watch, snapshot.time, settings)) continue;
    watch.done = true;
    if (!isInFront) notifyAbout(session, watch, settings);
  }
};

interface State extends Remembered { asked?: boolean; skippedVersion?: string }
const stateFile = () => path.join(app.getPath('userData'), 'state.json');

const loadState = (): State => {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return {}; }
};

const saveState = (change: State) => {
  fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
  fs.writeFileSync(stateFile(), JSON.stringify({ ...loadState(), ...change }));
};

let areTerminalsClosed = false;
/** Asks before closing the terminal tabs that are open; true to go ahead. */
const closeTerminals = () => {
  const count = terminals?.count ?? 0;
  if (!count || areTerminalsClosed) return true;
  const options = {
    type: 'question' as const, buttons: ['Close', 'Cancel'], defaultId: 1, cancelId: 1,
    message: count === 1 ? 'Close the open terminal?' : `Close the ${count} open terminals?`,
    detail: 'Whatever runs in them is stopped.',
  };
  areTerminalsClosed = (tankWindow ? dialog.showMessageBoxSync(tankWindow, options) : dialog.showMessageBoxSync(options)) === 0;
  return areTerminalsClosed;
};

/** The page's URL with the page options the app was started with. */
const pageUrlFor = (serverUrl: string) => {
  const url = new URL(process.env.FISHTANK_DEV_URL || serverUrl);
  for (const arg of process.argv) {
    const match = /^--([a-z]+)(?:=(.*))?$/.exec(arg);
    if (match && PAGE_OPTIONS.includes(match[1])) url.searchParams.set(match[1], match[2] ?? '');
  }
  return url.toString();
};

const createWindow = (server: Fishtank) => {
  const window = new BrowserWindow({
    width: 1280, height: 800, minWidth: 480, minHeight: 360, title: 'Agent Fishtank', backgroundColor: '#01101f',
    autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, preload: path.join(app.getAppPath(), 'dist-electron', 'preload.cjs') },
  });
  tankWindow = window;
  // in the background when started with the computer, or by a session while "open when a session starts" is off
  const isHidden = isAtLogin || (isFromHook && !server.settings().openOnSession);
  window.once('ready-to-show', () => { if (!isHidden) reveal(); });
  window.on('close', event => {
    if (!isQuitting && (tank?.cliRunning() || isStaying())) { event.preventDefault(); tankWindow?.hide(); }
    else if (!closeTerminals()) event.preventDefault();
  });
  window.on('closed', () => { tankWindow = null; if (!isQuitting) app.quit(); });
  window.webContents.setWindowOpenHandler(({ url }) => { void shell.openExternal(url); return { action: 'deny' }; });
  // a fish's session link (claude://…, see server/desktop.ts) opens in the app it belongs to, not in this window
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('claude:')) return;
    event.preventDefault();
    void shell.openExternal(url);
  });
  pageUrl = pageUrlFor(server.url);
  void window.loadURL(pageUrl);
};

const openSettings = () => {
  show();
  void tankWindow?.webContents.executeJavaScript('window.openSettings?.()');
};

/** How the CLIs run this app's command line; null when running from source (npm run app), which can't be connected. */
const appLauncher = (): Launcher | null => {
  if (!app.isPackaged) return null;
  const bin = path.join(process.resourcesPath, 'bin', process.platform === 'win32' ? 'fishtank.cmd' : 'fishtank.sh');
  if (process.platform !== 'win32') return { bin, shell: 'sh' };
  // Claude Code runs hook commands in Git Bash, or in PowerShell when Git Bash isn't installed
  const gitBash = [process.env.CLAUDE_CODE_GIT_BASH_PATH, ...['ProgramFiles', 'ProgramW6432', 'LOCALAPPDATA'].map(variable => {
    const folder = process.env[variable];
    return folder && path.join(folder, variable === 'LOCALAPPDATA' ? 'Programs' : '', 'Git', 'bin', 'bash.exe');
  })];
  return { bin, shell: gitBash.some(bash => bash && fs.existsSync(bash)) ? 'bash' : 'powershell' };
};

/**
 * The hooks point at this app, so it must stay where it is. On macOS an app opened from the disk image or Downloads
 * runs from a temporary place; offer to move it to Applications first (which relaunches it).
 */
const isInStablePlace = async () => {
  if (!isMac || app.isInApplicationsFolder() || process.env.FISHTANK_ANY_PLACE === '1') return true;
  const { response } = await dialog.showMessageBox({
    type: 'question', buttons: ['Move to Applications', 'Cancel'], defaultId: 0, cancelId: 1,
    message: 'Move Agent Fishtank to your Applications folder first?',
    detail: 'Claude Code and Copilot CLI start the fishtank from where it is installed, so it needs to stay in one place.',
  });
  if (response === 0) app.moveToApplicationsFolder();
  return false;
};

/** Keeps connected CLIs pointing at this copy of the app, e.g. after it was moved or updated. */
const repoint = () => {
  const launcher = appLauncher();
  if (!launcher || (isMac && !app.isInApplicationsFolder() && process.env.FISHTANK_ANY_PLACE !== '1')) return;
  const isConnected = connected(folders);
  for (const cli of CLIS) {
    if (!isConnected[cli]) continue;
    try { connect(cli, folders, { launcher, port }); } catch { /* shown when they use the menu */ }
  }
};

const showError = (error: unknown) => dialog.showErrorBox('Agent Fishtank', (error as Error).message);

const toggle = async (cli: Cli) => {
  try {
    if (connected(folders)[cli]) disconnect(cli, folders);
    else if (await isInStablePlace()) connect(cli, folders, { launcher: appLauncher()!, port });
  } catch (error) { showError(error); }
  buildMenu();
};

const buildMenu = () => {
  const launcher = appLauncher(), isConnected = connected(folders);
  const items: MenuItemConstructorOptions[] = CLIS.map(cli => ({
    label: isConnected[cli] ? `Disconnect from ${NAMES[cli]}` : `Connect to ${NAMES[cli]}`,
    enabled: !!launcher, click: () => { void toggle(cli); },
  }));
  const update: MenuItemConstructorOptions = { label: 'Check for Updates…', enabled: !!updates, click: () => { void updates?.check(true); } };
  const settings: MenuItemConstructorOptions = { label: isMac ? 'Settings…' : 'Settings', accelerator: 'CmdOrCtrl+,', click: openSettings };
  const template: MenuItemConstructorOptions[] = [
    isMac
      ? { label: app.name, submenu: [{ role: 'about' }, update, { type: 'separator' }, settings, { type: 'separator' }, ...items, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }
      : { label: 'File', submenu: [settings, { type: 'separator' }, ...items, { type: 'separator' }, update, { type: 'separator' }, { role: 'quit' }] },
    { label: 'View', submenu: [{ label: 'Terminal', accelerator: 'CmdOrCtrl+`', click: () => { show(); terminals?.toggle(); } }, { type: 'separator' }, { role: 'reload' }, { role: 'togglefullscreen' }, ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' } as const])] },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

/** Asks whether to connect the `offer`ed CLIs; resolves to the button chosen. */
const askToConnect = async (window: BrowserWindow, offer: Cli[]) => {
  const { response } = await dialog.showMessageBox(window, {
    type: 'question', buttons: ['Connect', 'Not now'], defaultId: 0, cancelId: 1,
    message: `Connect Agent Fishtank to ${offer.map(cli => NAMES[cli]).join(' and ')}?`,
    detail: [
      'The fishtank then opens by itself when you start a session, and closes after the last one.',
      offer.includes('claude') ? 'For Claude Code this adds hooks and wraps your status line in settings.json (a backup is kept). Your own hooks and status line keep working.' : '',
      isMac ? 'Before deleting the app, choose Disconnect in the Agent Fishtank menu.' : 'You can disconnect any time from the File menu (press Alt to show it).',
    ].filter(Boolean).join('\n\n'),
  });
  return response;
};

/** On the first start, offer to connect the CLIs found on this computer. */
const firstRun = async () => {
  const state = loadState();
  const isInstalled = installed(folders), isConnected = connected(folders);
  const offer = CLIS.filter(cli => isInstalled[cli] && !isConnected[cli]);
  if (state.asked || !appLauncher() || !offer.length || !tankWindow) return;

  const response = await askToConnect(tankWindow, offer);
  // moving to Applications relaunches the app, which asks again from there
  if (response === 0 && !(await isInStablePlace())) return;
  saveState({ asked: true });
  if (response !== 0) return;
  try { for (const cli of offer) connect(cli, folders, { launcher: appLauncher()!, port }); } catch (error) { showError(error); }
  buildMenu();
};

/** Asks GitHub for new releases, in the installed app only. FISHTANK_NO_UPDATE_CHECK=1 turns it off. */
const startUpdates = () => {
  if (!app.isPackaged || process.env.FISHTANK_NO_UPDATE_CHECK === '1') return;
  let repo: string | null = null;
  try { repo = repoFrom(JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8')).repository?.url ?? ''); } catch { /* no repository */ }
  if (!repo) return;
  updates = new Updates({ repo, skipped: () => loadState().skippedVersion, skip: version => saveState({ skippedVersion: version }) });
  updates.start();
  buildMenu();
};

const startTank = () => startServer({
  port,
  distDir: path.join(app.getAppPath(), 'dist'),
  copilotSessionDir: process.env.COPILOT_SESSION_DIR || path.join(folders.copilotHome, 'session-state'),
  claudeConfigDir: folders.claudeDir,
  onIdle: () => app.quit(),
  waitForCli: !isFromHook, // opened by hand: stay until a session has come and gone
  keepRunning: () => isAtLogin || !!terminals?.count, // a tab's shell isn't closed under you
  settingsFile: path.join(app.getPath('userData'), 'settings.json'),
  desktop: true,
  onSettings: applySettings,
  onSnapshot: watchSessions,
});

const main = async () => {
  let server: Fishtank;
  try {
    server = await startTank();
  } catch (error) {
    const isInUse = (error as NodeJS.ErrnoException).code === 'EADDRINUSE';
    dialog.showErrorBox('Agent Fishtank', isInUse
      ? `Port ${port} is already in use, probably by another fishtank (such as the older browser version started with npm start). Close it and open Agent Fishtank again.`
      : String(error));
    app.exit(1);
    return;
  }
  tank = server;
  terminals = new Terminals({ window: () => tankWindow, origin: () => pageUrl, remembered: loadState, remember: saveState });
  createWindow(server);
  repoint();
  buildMenu();
  await firstRun();
  startUpdates();
};

if (!app.requestSingleInstanceLock()) app.quit(); // the running one shows its window (second-instance)
else {
  app.on('second-instance', show);
  app.on('activate', show); // Dock icon clicked
  app.on('before-quit', event => {
    if (!closeTerminals()) { event.preventDefault(); return; }
    isQuitting = true; terminals?.killAll(); tank?.stop();
  });
  app.on('window-all-closed', () => { /* closing is handled per window */ });
  if (process.platform === 'win32') app.setAppUserModelId('com.vinnievh.agent-fishtank'); // or notifications don't show
  void app.whenReady().then(main);
}
