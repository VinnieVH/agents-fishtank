// The built-in terminals on the left of the window, in the desktop app only: a tab per shell, a + menu to start
// Claude Code, Copilot CLI or a shell, and a divider to share the window with the tank. The shells run in the app
// (electron/terminals.ts); this draws them with xterm.js.
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import type { Tab, TerminalKind, TerminalsApi } from '../shared/terminals';

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
  const e = Object.assign(document.createElement(tag), props);
  e.append(...children);
  return e;
};
const base = (folder: string) => folder.split(/[\\/]/).filter(Boolean).pop() ?? folder;

interface View { tab: Tab; term: Terminal; fit: FitAddon; el: HTMLElement; button: HTMLElement }

export async function startTerminals(api: TerminalsApi) {
  const setup = await api.setup();
  const names = new Map(setup.kinds.map(k => [k.kind, k.name]));
  let folder = setup.folder, open = false, width = setup.width;
  const views = new Map<number, View>();
  let active: View | null = null;

  const list = make('div', { className: 'list', role: 'tablist' });
  const add = make('button', { className: 'add', type: 'button', title: 'New terminal', ariaLabel: 'New terminal', ariaHasPopup: 'menu' }, '+');
  const area = make('div', { className: 'views' });
  const side = make('section', { id: 'term', hidden: true, ariaLabel: 'Terminals' }, make('nav', { className: 'tabs' }, list, add), area);
  const split = make('div', { id: 'split', hidden: true, title: 'Drag to resize' });
  const menu = make('div', { className: 'term-menu', role: 'menu', hidden: true });
  document.body.append(side, split, menu);

  // ---------- the layout: the terminals take `width` on the left, the tank the rest ----------
  const clamp = (w: number) => Math.round(Math.max(MIN_SIDE, Math.min(innerWidth - Math.max(MIN_TANK, innerWidth * TANK_SHARE), w)));
  function layout() {
    const w = open ? clamp(width || innerWidth * .5) : 0;
    document.documentElement.style.setProperty('--tank-left', w + 'px');
    side.hidden = split.hidden = !open;
    dispatchEvent(new Event('resize')); // the tank sizes itself to what's left on a window resize
  }
  function show(on: boolean) {
    open = on; layout();
    api.layout(open, width);
    if (!open) return;
    if (active) { fitActive(); active.term.focus(); } else start.querySelector('button')?.focus();
  }
  const button = document.getElementById('term-btn');
  if (button) { button.hidden = false; button.title = `Terminal (${isMac ? '⌘' : 'Ctrl+'}\`)`; button.addEventListener('click', () => show(!open)); }
  api.onToggle(() => show(!open));
  addEventListener('resize', e => { if (e.isTrusted && open) { layout(); } });

  split.addEventListener('pointerdown', e => {
    split.setPointerCapture(e.pointerId); split.classList.add('drag');
    let frame = 0;
    const move = (m: PointerEvent) => {
      width = clamp(m.clientX);
      cancelAnimationFrame(frame); frame = requestAnimationFrame(layout);
    };
    const up = () => {
      split.removeEventListener('pointermove', move); split.classList.remove('drag');
      api.layout(open, width);
    };
    split.addEventListener('pointermove', move);
    split.addEventListener('pointerup', up, { once: true });
    split.addEventListener('lostpointercapture', up, { once: true });
  });

  // ---------- the + menu, and the same choices when no terminal is open ----------
  const kindButtons = (then: () => void) => setup.kinds.map(({ kind, name }) =>
    make('button', { type: 'button', role: 'menuitem', onclick: () => { then(); void create(kind); } }, make('i', { className: 'kind ' + kind }), name));
  const folderButton = (then: () => void, label: Node | string) => make('button', {
    type: 'button', role: 'menuitem', title: folder,
    onclick: async () => { then(); folder = await api.pickFolder(); renderStart(); },
  }, label);

  function openMenu() {
    menu.replaceChildren(...kindButtons(closeMenu), make('hr'),
      folderButton(closeMenu, make('span', { className: 'folder' }, `In ${base(folder)} · Change…`)));
    const r = add.getBoundingClientRect();
    menu.hidden = false;
    menu.style.top = r.bottom + 4 + 'px';
    menu.style.left = Math.max(8, Math.min(r.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8)) + 'px';
    (menu.querySelector('button') as HTMLElement | null)?.focus();
  }
  function closeMenu() { menu.hidden = true; }
  add.addEventListener('click', () => menu.hidden ? openMenu() : closeMenu());
  addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target as Node) && e.target !== add) closeMenu(); }, true);
  menu.addEventListener('keydown', e => {
    const items = [...menu.querySelectorAll('button')], i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') { closeMenu(); add.focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); }
  });

  const start = make('div', { className: 'start' });
  function renderStart() {
    start.replaceChildren(
      make('h2', {}, 'Start a terminal'),
      make('div', { className: 'folder' }, 'In ', folderButton(() => {}, folder)),
      make('div', { className: 'kinds' }, ...kindButtons(() => {})),
    );
  }
  renderStart();
  area.append(start);

  // ---------- the tabs ----------
  function select(v: View | null) {
    active = v;
    for (const x of views.values()) {
      x.el.hidden = x !== v;
      x.button.classList.toggle('active', x === v);
      x.button.ariaSelected = String(x === v);
    }
    start.hidden = !!v;
    if (v) { fitActive(); v.term.focus(); v.button.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
  function fitActive() {
    if (!active || !open) return;
    try { active.fit.fit(); } catch { /* not laid out yet */ }
  }
  new ResizeObserver(fitActive).observe(area);

  async function create(kind: TerminalKind) {
    if (!open) show(true);
    // sized like the tabs already open (or a guess) until it's laid out; the shell is told the real size right after
    const size = active ? { cols: active.term.cols, rows: active.term.rows } : { cols: 100, rows: 30 };
    attach(await api.create(kind, size.cols, size.rows));
  }

  function attach(tab: Tab) {
    const term = new Terminal({
      fontFamily: "'Cascadia Mono', 'Cascadia Code', Consolas, Menlo, 'SF Mono', monospace", fontSize: 13, lineHeight: 1.1,
      cursorBlink: true, scrollback: 5000, theme: THEME, allowProposedApi: false,
      ...(/Windows/.test(navigator.userAgent) ? { windowsPty: { backend: 'conpty' as const } } : {}),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon((_e, uri) => window.open(uri))); // the app opens it in your browser
    const el = make('div', { className: 'view', hidden: true });
    area.append(el);
    term.open(el);

    const label = make('span', { className: 'label' }, `${names.get(tab.kind) ?? tab.kind} · ${base(tab.folder)}`);
    const close = make('button', { className: 'x', type: 'button', title: 'Close', ariaLabel: 'Close terminal' }, '✕');
    const button = make('div', { className: 'tab', role: 'tab', title: tab.folder }, make('i', { className: 'kind ' + tab.kind }), label, close);
    list.append(button);
    const v: View = { tab, term, fit, el, button };
    views.set(tab.id, v);

    button.addEventListener('click', () => select(v));
    button.addEventListener('auxclick', e => { if (e.button === 1) remove(v, true); });
    close.addEventListener('click', e => { e.stopPropagation(); remove(v, true); });
    term.onData(data => api.write(tab.id, data));
    term.onResize(({ cols, rows }) => api.resize(tab.id, cols, rows));
    term.onTitleChange(title => { button.title = title ? `${title}\n${tab.folder}` : tab.folder; });

    // copy and paste like other terminals: Ctrl+C copies only with text selected (else it stops what runs),
    // Ctrl+V or Ctrl+Shift+V pastes; ⌘C and ⌘V on a Mac. A right click copies the selection, or pastes.
    const paste = () => { void api.paste().then(text => { if (text) term.paste(text); }); };
    const copy = () => { api.copy(term.getSelection()); term.clearSelection(); };
    term.attachCustomKeyEventHandler(e => {
      if (e.type !== 'keydown') return true;
      const mod = isMac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey, key = e.key.toLowerCase();
      if (mod && key === 'c' && (isMac || e.shiftKey || term.hasSelection())) { e.preventDefault(); if (term.hasSelection()) copy(); return false; }
      if (mod && key === 'v') { e.preventDefault(); paste(); return false; }
      if (e.ctrlKey && e.key === 'Tab') { e.preventDefault(); cycle(e.shiftKey ? -1 : 1); return false; }
      return true;
    });
    el.addEventListener('contextmenu', e => { e.preventDefault(); if (term.hasSelection()) copy(); else paste(); });

    select(v);
    return v;
  }

  function cycle(step: number) {
    const all = [...views.values()];
    if (all.length > 1 && active) select(all[(all.indexOf(active) + step + all.length) % all.length]);
  }

  /** Takes the tab away; `kill` also stops its shell (it isn't when the shell has ended by itself). */
  function remove(v: View, kill: boolean) {
    if (!views.has(v.tab.id)) return;
    if (kill) api.kill(v.tab.id);
    const all = [...views.values()], i = all.indexOf(v);
    views.delete(v.tab.id);
    v.term.dispose(); v.el.remove(); v.button.remove();
    if (active === v) select(all[i + 1] ?? all[i - 1] ?? null);
  }

  api.onData((id, data) => views.get(id)?.term.write(data));
  api.onExit(id => { const v = views.get(id); if (v) remove(v, false); });

  // the tabs still running from before a reload, then the side as it was left
  for (const tab of setup.tabs) attach(tab);
  if (setup.open || setup.tabs.length) show(true);
}
