// Gives the tank page the built-in terminals (see shared/terminals.ts), over IPC to electron/terminals.ts.
// Only through here, never through the local web server: any web page can send requests to localhost.
import { contextBridge, ipcRenderer } from 'electron';
import type { TerminalsApi } from '../shared/terminals.ts';

const api: TerminalsApi = {
  setup: () => ipcRenderer.invoke('term:setup'),
  create: (kind, cols, rows) => ipcRenderer.invoke('term:create', kind, cols, rows),
  write: (id, data) => ipcRenderer.send('term:write', id, data),
  resize: (id, cols, rows) => ipcRenderer.send('term:resize', id, cols, rows),
  kill: id => ipcRenderer.send('term:kill', id),
  pickFolder: () => ipcRenderer.invoke('term:pick-folder'),
  layout: (open, width) => ipcRenderer.send('term:layout', open, width),
  copy: text => ipcRenderer.send('term:copy', text),
  paste: () => ipcRenderer.invoke('term:paste'),
  onData: listener => { ipcRenderer.on('term:data', (_e, id, data) => listener(id, data)); },
  onExit: listener => { ipcRenderer.on('term:exit', (_e, id) => listener(id)); },
  onToggle: listener => { ipcRenderer.on('term:toggle', () => listener()); },
};

contextBridge.exposeInMainWorld('fishtankTerminals', api);
