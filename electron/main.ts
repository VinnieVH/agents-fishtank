// The Agent Fishtank desktop app: runs the fishtank server and shows the tank in its own window.
// Claude Code and Copilot CLI start it from a session-start hook (electron/cli.ts start); it quits once the last
// session has closed, unless the settings say to keep running. Closing the window while it keeps running only hides
// it: Claude Code's hooks keep posting to it.
import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, dialog, Menu, Notification, shell, type MenuItemConstructorOptions } from 'electron';
import type { Snapshot, State as SessionState } from '../shared/types.ts';
import type { Settings } from '../shared/settings.ts';
import { DEFAULT_PORT, startServer, type Fishtank } from '../server/server.ts';
import { connect, connected, disconnect, installed, places, type Cli, type Launcher } from './connect.ts';
import { repoFrom } from './releases.ts';
import { Updates } from './updates.ts';

const port = Number(process.env.FISHTANK_PORT) || DEFAULT_PORT;
const fromHook = process.argv.includes('--from-hook');
// started with the computer (the "open at login" setting): stays in the background
const atLogin = process.argv.includes('--at-login') || (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin);
const where = places();
const isMac = process.platform === 'darwin';
const NAMES: Record<Cli, string> = { claude: 'Claude Code', copilot: 'GitHub Copilot CLI' };
const CLIS: Cli[] = ['claude', 'copilot'];
// The page's options, given to the app as --whale, --time=22:30, --lat=51.05 ... (see README)
const PAGE_OPTIONS = ['lat', 'lon', 'time', 'timelapse', 'whale', 'shark', 'crab'];

let tank: Fishtank | null = null;
let updates: Updates | null = null;
let win: BrowserWindow | null = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) app.quit(); // the running one shows its window (second-instance)
else {
  app.on('second-instance', show);
  app.on('activate', show); // Dock icon clicked
  app.on('before-quit', () => { quitting = true; tank?.stop(); });
  app.on('window-all-closed', () => { /* closing is handled per window */ });
  if (process.platform === 'win32') app.setAppUserModelId('com.vinnievh.agent-fishtank'); // or notifications don't show
  app.whenReady().then(main);
}

async function main() {
  try {
    tank = await startServer({
      port,
      distDir: path.join(app.getAppPath(), 'dist'),
      copilotSessionDir: process.env.COPILOT_SESSION_DIR || path.join(where.copilotHome, 'session-state'),
      claudeConfigDir: where.claudeDir,
      onIdle: () => app.quit(),
      waitForCli: !fromHook, // opened by hand: stay until a session has come and gone
      keepRunning: () => atLogin,
      settingsFile: path.join(app.getPath('userData'), 'settings.json'),
      desktop: true,
      onSettings: applySettings,
      onSnapshot: watchSessions,
    });
  } catch (e) {
    const inUse = (e as NodeJS.ErrnoException).code === 'EADDRINUSE';
    dialog.showErrorBox('Agent Fishtank', inUse
      ? `Port ${port} is already in use, probably by another fishtank (such as the older browser version started with npm start). Close it and open Agent Fishtank again.`
      : String(e));
    app.exit(1);
    return;
  }
  createWindow();
  repoint();
  buildMenu();
  await firstRun();
  startUpdates();
}

// ---------- settings that concern the app (the page shows the dialog; the server keeps them) ----------

function applySettings(s: Settings) {
  // only the installed app can start with the computer; `npm run app` would register Electron itself
  if (!app.isPackaged || app.getLoginItemSettings().openAtLogin === s.openAtLogin) return;
  app.setLoginItemSettings({ openAtLogin: s.openAtLogin, args: ['--at-login'] });
}

/** Keeps running with no sessions: closing the window then hides it, and only Quit ends the app. */
const staying = () => atLogin || !(tank?.settings().quitWhenIdle ?? true);

/** Each session's state, since when, the one before it, and whether that's been dealt with (told, or not news). */
let watched: Map<string, { state: SessionState; since: number; from?: SessionState; done: boolean }> | null = null;

/**
 * Opens the window when the first session starts, and notifies when a session has been waiting for an answer, or
 * done, for a while (notifyAfter): by then you're clearly not in that session already.
 */
function watchSessions(snap: Snapshot) {
  const s = tank?.settings();
  if (!s) return;
  const first = !watched, before = watched ?? new Map();
  if (s.openOnSession && !first && !before.size && snap.sessions.length && win && !win.isVisible()) show();
  watched = new Map();
  const front = !!win && win.isVisible() && win.isFocused();
  for (const x of snap.sessions) {
    const w = before.get(x.id);
    // the sessions there when the app started aren't news
    const now = w && w.state === x.state ? w : { state: x.state, since: snap.time, from: w?.state, done: first };
    watched.set(x.id, now);
    if (now.done || snap.time - now.since < s.notifyAfter * 1000) continue;
    now.done = true;
    if (front) continue;
    const who = x.source === 'claude' ? 'Claude Code' : 'Copilot CLI';
    if (x.state === 'waiting' && s.notifyWaiting) notify(`${x.name} needs you`, `${who} is waiting for your answer.`);
    else if (x.state === 'idle' && now.from === 'working' && s.notifyFinished) notify(`${x.name} is done`, `${who} finished and waits for your next message.`);
  }
}

function notify(title: string, body: string) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, silent: false });
  n.on('click', show);
  n.show();
}

// ---------- remembered between starts (userData/state.json) ----------

interface State { asked?: boolean; skippedVersion?: string }
const stateFile = () => path.join(app.getPath('userData'), 'state.json');

function loadState(): State {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return {}; }
}

function saveState(change: State) {
  fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
  fs.writeFileSync(stateFile(), JSON.stringify({ ...loadState(), ...change }));
}

// ---------- updates ----------

/** Asks GitHub for new releases, in the installed app only. FISHTANK_NO_UPDATE_CHECK=1 turns it off. */
function startUpdates() {
  if (!app.isPackaged || process.env.FISHTANK_NO_UPDATE_CHECK === '1') return;
  let repo: string | null = null;
  try { repo = repoFrom(JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8')).repository?.url ?? ''); } catch { /* no repository */ }
  if (!repo) return;
  updates = new Updates({ repo, skipped: () => loadState().skippedVersion, skip: v => saveState({ skippedVersion: v }) });
  updates.start();
  buildMenu();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 480, minHeight: 360, title: 'Agent Fishtank', backgroundColor: '#01101f',
    autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  // in the background when started with the computer, or by a session while "open when a session starts" is off
  const hidden = atLogin || (fromHook && !tank!.settings().openOnSession);
  win.once('ready-to-show', () => { if (!hidden) win?.show(); });
  win.on('close', e => {
    if (!quitting && (tank?.cliRunning() || staying())) { e.preventDefault(); win?.hide(); }
  });
  win.on('closed', () => { win = null; if (!quitting) app.quit(); });
  win.webContents.setWindowOpenHandler(({ url }) => { void shell.openExternal(url); return { action: 'deny' }; });
  const url = new URL(process.env.FISHTANK_DEV_URL || tank!.url);
  for (const arg of process.argv) {
    const m = /^--([a-z]+)(?:=(.*))?$/.exec(arg);
    if (m && PAGE_OPTIONS.includes(m[1])) url.searchParams.set(m[1], m[2] ?? '');
  }
  void win.loadURL(url.toString());
}

function openSettings() {
  show();
  void win?.webContents.executeJavaScript('window.openSettings?.()');
}

function show() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// ---------- connecting the CLIs ----------

/** How the CLIs run this app's command line; null when running from source (npm run app), which can't be connected. */
function launcher(): Launcher | null {
  if (!app.isPackaged) return null;
  const bin = path.join(process.resourcesPath, 'bin', process.platform === 'win32' ? 'fishtank.cmd' : 'fishtank.sh');
  if (process.platform !== 'win32') return { bin, shell: 'sh' };
  // Claude Code runs hook commands in Git Bash, or in PowerShell when Git Bash isn't installed
  const gitBash = [process.env.CLAUDE_CODE_GIT_BASH_PATH, ...['ProgramFiles', 'ProgramW6432', 'LOCALAPPDATA']
    .map(v => process.env[v] && path.join(process.env[v]!, v === 'LOCALAPPDATA' ? 'Programs' : '', 'Git', 'bin', 'bash.exe'))];
  return { bin, shell: gitBash.some(p => p && fs.existsSync(p)) ? 'bash' : 'powershell' };
}

/**
 * The hooks point at this app, so it must stay where it is. On macOS an app opened from the disk image or Downloads
 * runs from a temporary place; offer to move it to Applications first (which relaunches it).
 */
async function inStablePlace() {
  if (!isMac || app.isInApplicationsFolder() || process.env.FISHTANK_ANY_PLACE === '1') return true;
  const { response } = await dialog.showMessageBox({
    type: 'question', buttons: ['Move to Applications', 'Cancel'], defaultId: 0, cancelId: 1,
    message: 'Move Agent Fishtank to your Applications folder first?',
    detail: 'Claude Code and Copilot CLI start the fishtank from where it is installed, so it needs to stay in one place.',
  });
  if (response === 0) app.moveToApplicationsFolder();
  return false;
}

/** Keeps connected CLIs pointing at this copy of the app, e.g. after it was moved or updated. */
function repoint() {
  const l = launcher();
  if (!l || (isMac && !app.isInApplicationsFolder() && process.env.FISHTANK_ANY_PLACE !== '1')) return;
  const c = connected(where);
  for (const cli of CLIS) if (c[cli]) { try { connect(cli, where, l, port); } catch { /* shown when they use the menu */ } }
}

async function toggle(cli: Cli) {
  try {
    if (connected(where)[cli]) disconnect(cli, where);
    else if (await inStablePlace()) connect(cli, where, launcher()!, port);
  } catch (e) { dialog.showErrorBox('Agent Fishtank', (e as Error).message); }
  buildMenu();
}

function buildMenu() {
  const l = launcher(), c = connected(where);
  const items: MenuItemConstructorOptions[] = CLIS.map(cli => ({
    label: c[cli] ? `Disconnect from ${NAMES[cli]}` : `Connect to ${NAMES[cli]}`,
    enabled: !!l, click: () => { void toggle(cli); },
  }));
  const update: MenuItemConstructorOptions = { label: 'Check for Updates…', enabled: !!updates, click: () => { void updates?.check(true); } };
  const settings: MenuItemConstructorOptions = { label: isMac ? 'Settings…' : 'Settings', accelerator: 'CmdOrCtrl+,', click: openSettings };
  const template: MenuItemConstructorOptions[] = [
    isMac
      ? { label: app.name, submenu: [{ role: 'about' }, update, { type: 'separator' }, settings, { type: 'separator' }, ...items, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }
      : { label: 'File', submenu: [settings, { type: 'separator' }, ...items, { type: 'separator' }, update, { type: 'separator' }, { role: 'quit' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'togglefullscreen' }, ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' } as const])] },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** On the first start, offer to connect the CLIs found on this computer. */
async function firstRun() {
  const state = loadState();
  const has = installed(where), c = connected(where);
  const offer = CLIS.filter(cli => has[cli] && !c[cli]);
  if (state.asked || !launcher() || !offer.length || !win) return;

  const { response } = await dialog.showMessageBox(win, {
    type: 'question', buttons: ['Connect', 'Not now'], defaultId: 0, cancelId: 1,
    message: `Connect Agent Fishtank to ${offer.map(cli => NAMES[cli]).join(' and ')}?`,
    detail: [
      'The fishtank then opens by itself when you start a session, and closes after the last one.',
      offer.includes('claude') ? 'For Claude Code this adds hooks and wraps your status line in settings.json (a backup is kept). Your own hooks and status line keep working.' : '',
      isMac ? 'Before deleting the app, choose Disconnect in the Agent Fishtank menu.' : 'You can disconnect any time from the File menu (press Alt to show it).',
    ].filter(Boolean).join('\n\n'),
  });
  // moving to Applications relaunches the app, which asks again from there
  if (response === 0 && !(await inStablePlace())) return;
  saveState({ asked: true });
  if (response !== 0) return;
  try { for (const cli of offer) connect(cli, where, launcher()!, port); } catch (e) { dialog.showErrorBox('Agent Fishtank', (e as Error).message); }
  buildMenu();
}
