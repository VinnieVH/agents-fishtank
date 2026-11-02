// Loaded after clock.js in the demo recording (see record.mjs), when the stage asks for it: stands in for the desktop
// app's terminals (window.fishtankTerminals, shared/terminals.ts), so the recording shows the tank's real terminal
// side, tabs and + menu. There are no shells: the stage prints what they would with __term(id, text), and hears
// about every tab the page starts through __created(tab).
(() => {
  const setup = JSON.parse(localStorage.getItem('demo.terminals') || 'null');
  if (!setup) return;
  let print = () => {}, next = 1;
  window.fishtankTerminals = {
    setup: async () => setup,
    create: async kind => { const tab = { id: next++, kind, folder: setup.folder }; window.__created?.(tab); return tab; },
    write() {}, resize() {}, kill() {}, layout() {}, copy() {},
    pickFolder: async () => setup.folder,
    paste: async () => '',
    onData: l => { print = l; },
    onExit() {},
    onToggle: l => { window.__toggleTerminals = l; },
  };
  window.__term = (id, text) => print(id, text);
})();
