// The built-in terminals on the left of the window, in the desktop app only: a tab per shell, a + menu to start
// Claude Code, Copilot CLI or a shell, and a divider to share the window with the tank. The shells run in the app
// (electron/terminals.ts); this draws them with xterm.js.
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { osc52Text, type Tab, type TerminalKind, type TerminalsApi, type TerminalSetup } from '../shared/terminals';

declare global {
  interface Window { fishtankTerminals?: TerminalsApi }
}

const MIN_SIDE = 320, MIN_TANK = 360; // px; the tank also keeps at least TANK_SHARE of the window
const TANK_SHARE = .3;
const isMac = /Mac/.test(navigator.platform);
const THEME = {
  background: '#020c18', foreground: '#d8ecff', cursor: '#6fe3ff', cursorAccent: '#020c18', selectionBackground: 'rgba(111,227,255,.3)',
  black: '#0b1a2b', red: '#ff5a6b', green: '#39ff88', yellow: '#ffc94d', blue: '#5aa9ff', magenta: '#c9a6ff', cyan: '#6fe3ff', white: '#d8ecff',
  brightBlack: '#5f7c99', brightRed: '#ff8a9c', brightGreen: '#8affb8', brightYellow: '#ffe59a', brightBlue: '#9fd3ff',
  brightMagenta: '#e0ccff', brightCyan: '#b5f2ff', brightWhite: '#ffffff',
};

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]) => {
  const element = Object.assign(document.createElement(tag), props);
  element.append(...children);
  return element;
};
const base = (folder: string) => folder.split(/[\\/]/).filter(Boolean).pop() ?? folder;

interface View { tab: Tab; terminal: Terminal; fit: FitAddon; element: HTMLElement; button: HTMLElement }

interface TerminalsUi {
  api: TerminalsApi;
  kinds: TerminalSetup['kinds'];
  names: Map<TerminalKind, string>;
  folder: string;
  isOpen: boolean;
  width: number;
  views: Map<number, View>;
  active: View | null;
  list: HTMLElement;
  add: HTMLButtonElement;
  area: HTMLElement;
  side: HTMLElement;
  split: HTMLElement;
  menu: HTMLElement;
  start: HTMLElement;
}

const buildUi = (api: TerminalsApi, setup: TerminalSetup): TerminalsUi => {
  const list = make('div', { className: 'list', role: 'tablist' });
  const add = make('button', { className: 'add', type: 'button', title: 'New terminal', ariaLabel: 'New terminal', ariaHasPopup: 'menu' }, '+');
  const area = make('div', { className: 'views' });
  return {
    api, kinds: setup.kinds, names: new Map(setup.kinds.map(({ kind, name }) => [kind, name])),
    folder: setup.folder, isOpen: false, width: setup.width, views: new Map(), active: null,
    list, add, area,
    side: make('section', { id: 'term', hidden: true, ariaLabel: 'Terminals' }, make('nav', { className: 'tabs' }, list, add), area),
    split: make('div', { id: 'split', hidden: true, title: 'Drag to resize' }),
    menu: make('div', { className: 'term-menu', role: 'menu', hidden: true }),
    start: make('div', { className: 'start' }),
  };
};

const clampWidth = (width: number) => Math.round(Math.max(MIN_SIDE, Math.min(innerWidth - Math.max(MIN_TANK, innerWidth * TANK_SHARE), width)));

/** The terminals take `width` on the left, the tank the rest. */
const layout = (ui: TerminalsUi) => {
  const width = ui.isOpen ? clampWidth(ui.width || innerWidth * .5) : 0;
  document.documentElement.style.setProperty('--tank-left', width + 'px');
  ui.side.hidden = ui.split.hidden = !ui.isOpen;
  dispatchEvent(new Event('resize')); // the tank sizes itself to what's left on a window resize
};

const fitActive = (ui: TerminalsUi) => {
  if (!ui.active || !ui.isOpen) return;
  try { ui.active.fit.fit(); } catch { /* not laid out yet */ }
};

const show = (ui: TerminalsUi, isOpen: boolean) => {
  ui.isOpen = isOpen; layout(ui);
  ui.api.layout(ui.isOpen, ui.width);
  if (!ui.isOpen) return;
  if (ui.active) { fitActive(ui); ui.active.terminal.focus(); } else ui.start.querySelector('button')?.focus();
};

const select = (ui: TerminalsUi, selected: View | null) => {
  ui.active = selected;
  for (const view of ui.views.values()) {
    view.element.hidden = view !== selected;
    view.button.classList.toggle('active', view === selected);
    view.button.ariaSelected = String(view === selected);
  }
  ui.start.hidden = !!selected;
  if (selected) { fitActive(ui); selected.terminal.focus(); selected.button.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
};

const wireToggle = (ui: TerminalsUi) => {
  const button = document.getElementById('term-btn');
  if (button) { button.hidden = false; button.title = `Terminal (${isMac ? '⌘' : 'Ctrl+'}\`)`; button.addEventListener('click', () => show(ui, !ui.isOpen)); }
  ui.api.onToggle(() => show(ui, !ui.isOpen));
  addEventListener('resize', event => { if (event.isTrusted && ui.isOpen) { layout(ui); } });
};

const wireDivider = (ui: TerminalsUi) => {
  const { split } = ui;
  split.addEventListener('pointerdown', event => {
    split.setPointerCapture(event.pointerId); split.classList.add('drag');
    let frame = 0;
    const move = (moveEvent: PointerEvent) => {
      ui.width = clampWidth(moveEvent.clientX);
      cancelAnimationFrame(frame); frame = requestAnimationFrame(() => layout(ui));
    };
    const up = () => {
      split.removeEventListener('pointermove', move); split.classList.remove('drag');
      ui.api.layout(ui.isOpen, ui.width);
    };
    split.addEventListener('pointermove', move);
    split.addEventListener('pointerup', up, { once: true });
    split.addEventListener('lostpointercapture', up, { once: true });
  });
};

/** The + menu's choices, also shown when no terminal is open. */
const kindButtons = (ui: TerminalsUi, then: () => void) => ui.kinds.map(({ kind, name }) =>
  make('button', { type: 'button', role: 'menuitem', onclick: () => { then(); void create(ui, kind); } }, make('i', { className: 'kind ' + kind }), name));

const folderButton = (ui: TerminalsUi, then: () => void, label: Node | string) => make('button', {
  type: 'button', role: 'menuitem', title: ui.folder,
  onclick: async () => { then(); ui.folder = await ui.api.pickFolder(); renderStart(ui); },
}, label);

const renderStart = (ui: TerminalsUi) => {
  ui.start.replaceChildren(
    make('h2', {}, 'Start a terminal'),
    make('div', { className: 'folder' }, 'In ', folderButton(ui, () => {}, ui.folder)),
    make('div', { className: 'kinds' }, ...kindButtons(ui, () => {})),
  );
};

const closeMenu = (ui: TerminalsUi) => { ui.menu.hidden = true; };

const openMenu = (ui: TerminalsUi) => {
  const { menu } = ui, close = () => closeMenu(ui);
  menu.replaceChildren(...kindButtons(ui, close), make('hr'),
    folderButton(ui, close, make('span', { className: 'folder' }, `In ${base(ui.folder)} · Change…`)));
  const bounds = ui.add.getBoundingClientRect();
  menu.hidden = false;
  menu.style.top = bounds.bottom + 4 + 'px';
  menu.style.left = Math.max(8, Math.min(bounds.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8)) + 'px';
  (menu.querySelector('button') as HTMLElement | null)?.focus();
};

const wireMenu = (ui: TerminalsUi) => {
  const { menu, add } = ui;
  add.addEventListener('click', () => menu.hidden ? openMenu(ui) : closeMenu(ui));
  addEventListener('pointerdown', event => { if (!menu.hidden && !menu.contains(event.target as Node) && event.target !== add) closeMenu(ui); }, true);
  menu.addEventListener('keydown', event => {
    const items = [...menu.querySelectorAll('button')], index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') { closeMenu(ui); add.focus(); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    }
  });
};

const create = async (ui: TerminalsUi, kind: TerminalKind) => {
  if (!ui.isOpen) show(ui, true);
  // sized like the tabs already open (or a guess) until it's laid out; the shell is told the real size right after
  const size = ui.active ? { cols: ui.active.terminal.cols, rows: ui.active.terminal.rows } : { cols: 100, rows: 30 };
  attach(ui, await ui.api.create(kind, size.cols, size.rows));
};

const cycle = (ui: TerminalsUi, step: number) => {
  const all = [...ui.views.values()];
  if (all.length > 1 && ui.active) select(ui, all[(all.indexOf(ui.active) + step + all.length) % all.length]);
};

/** Takes the tab away; `kill` also stops its shell (it isn't when the shell has ended by itself). */
const remove = (ui: TerminalsUi, view: View, kill: boolean) => {
  if (!ui.views.has(view.tab.id)) return;
  if (kill) ui.api.kill(view.tab.id);
  const all = [...ui.views.values()], index = all.indexOf(view);
  ui.views.delete(view.tab.id);
  view.terminal.dispose(); view.element.remove(); view.button.remove();
  if (ui.active === view) select(ui, all[index + 1] ?? all[index - 1] ?? null);
};

const openXterm = (area: HTMLElement) => {
  const terminal = new Terminal({
    fontFamily: "'Cascadia Mono', 'Cascadia Code', Consolas, Menlo, 'SF Mono', monospace", fontSize: 13, lineHeight: 1.1,
    cursorBlink: true, scrollback: 5000, theme: THEME, allowProposedApi: false,
    // while a CLI has the mouse, Shift-drag (Option-drag on a Mac) still selects text the terminal's own way
    macOptionClickForcesSelection: true,
    ...(/Windows/.test(navigator.userAgent) ? { windowsPty: { backend: 'conpty' as const } } : {}),
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.loadAddon(new WebLinksAddon((_event, uri) => window.open(uri))); // the app opens it in your browser
  const element = make('div', { className: 'view', hidden: true });
  area.append(element);
  terminal.open(element);
  return { terminal, fit, element };
};

const isShortcut = (event: KeyboardEvent) => isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
const isCopyKey = (event: KeyboardEvent, terminal: Terminal) =>
  isShortcut(event) && event.key.toLowerCase() === 'c' && (isMac || event.shiftKey || terminal.hasSelection());

// copy and paste like other terminals: Ctrl+C copies only with text selected (else it stops what runs),
// Ctrl+V or Ctrl+Shift+V pastes; ⌘C and ⌘V on a Mac. A right click copies the selection, or pastes.
const wireClipboard = (ui: TerminalsUi, { terminal, element }: View) => {
  const paste = () => { void ui.api.paste().then(text => { if (text) terminal.paste(text); }); };
  const copy = () => { ui.api.copy(terminal.getSelection()); terminal.clearSelection(); };
  terminal.attachCustomKeyEventHandler(event => {
    if (event.type !== 'keydown') return true;
    if (isCopyKey(event, terminal)) { event.preventDefault(); if (terminal.hasSelection()) copy(); return false; }
    if (isShortcut(event) && event.key.toLowerCase() === 'v') { event.preventDefault(); paste(); return false; }
    if (event.ctrlKey && event.key === 'Tab') { event.preventDefault(); cycle(ui, event.shiftKey ? -1 : 1); return false; }
    return true;
  });
  terminal.parser.registerOscHandler(52, data => {
    const text = osc52Text(data);
    if (text) ui.api.copy(text);
    return true;
  });
  element.addEventListener('contextmenu', event => { event.preventDefault(); if (terminal.hasSelection()) copy(); else paste(); });
};

const attach = (ui: TerminalsUi, tab: Tab) => {
  const { terminal, fit, element } = openXterm(ui.area);
  const label = make('span', { className: 'label' }, `${ui.names.get(tab.kind) ?? tab.kind} · ${base(tab.folder)}`);
  const close = make('button', { className: 'x', type: 'button', title: 'Close', ariaLabel: 'Close terminal' }, '✕');
  const button = make('div', { className: 'tab', role: 'tab', title: tab.folder }, make('i', { className: 'kind ' + tab.kind }), label, close);
  ui.list.append(button);
  const view: View = { tab, terminal, fit, element, button };
  ui.views.set(tab.id, view);

  button.addEventListener('click', () => select(ui, view));
  button.addEventListener('auxclick', event => { if (event.button === 1) remove(ui, view, true); });
  close.addEventListener('click', event => { event.stopPropagation(); remove(ui, view, true); });
  terminal.onData(data => ui.api.write(tab.id, data));
  terminal.onResize(({ cols, rows }) => ui.api.resize(tab.id, cols, rows));
  terminal.onTitleChange(title => { button.title = title ? `${title}\n${tab.folder}` : tab.folder; });
  wireClipboard(ui, view);

  select(ui, view);
  return view;
};

export const startTerminals = async (api: TerminalsApi) => {
  const setup = await api.setup();
  const ui = buildUi(api, setup);
  document.body.append(ui.side, ui.split, ui.menu);
  wireToggle(ui);
  wireDivider(ui);
  wireMenu(ui);
  renderStart(ui);
  ui.area.append(ui.start);
  new ResizeObserver(() => fitActive(ui)).observe(ui.area);

  api.onData((id, data) => ui.views.get(id)?.terminal.write(data));
  api.onExit(id => { const view = ui.views.get(id); if (view) remove(ui, view, false); });

  // the tabs still running from before a reload, then the side as it was left
  for (const tab of setup.tabs) attach(ui, tab);
  if (setup.open || setup.tabs.length) show(ui, true);
};
