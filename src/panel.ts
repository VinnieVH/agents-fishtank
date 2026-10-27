import type { State } from './scene/fish';
import { dur, esc } from './util';

export interface Subagent {
  id: string; name: string; type?: string; description?: string; model?: string;
  status: 'running' | 'done' | 'failed' | 'stopped'; start: number; end?: number;
}
export interface Session { id: string; name: string; state: State; lastEvent: number; subagents: Subagent[] }
export interface Snapshot { time: number; sessions: Session[] }

const listEl = document.getElementById('sessions')!, connEl = document.getElementById('conn')!;

/** Renders the session list. colorOf gives the fish's neon colour for the swatch. */
export function renderPanel(data: Snapshot, colorOf: (id: string) => string) {
  const now = data.time;
  const sorted = [...data.sessions].sort((a, b) => b.lastEvent - a.lastEvent);
  if (!sorted.length) { listEl.innerHTML = '<div class="empty">No sessions active in the last hour</div>'; return; }
  listEl.innerHTML = sorted.map(s => {
    const dot = s.state === 'working' ? 'on' : s.state === 'waiting' ? 'wait' : 'off';
    const label = s.state === 'working' ? 'working' : s.state === 'waiting' ? 'waiting for you' : 'idle';
    const color = colorOf(s.id);
    const subs = s.subagents.slice().sort((a, b) => (a.status === 'running' ? 0 : 1) - (b.status === 'running' ? 0 : 1) || b.start - a.start);
    const subHtml = subs.length ? `<ul class="subs">${subs.map(a => {
      const sd = a.status === 'running' ? 'on' : a.status === 'failed' ? 'off' : 'done';
      const icon = a.status === 'done' ? '✓ ' : a.status === 'failed' ? '✗ ' : a.status === 'stopped' ? '■ ' : '';
      const time = a.status === 'running' ? dur(now - a.start) : dur((a.end || now) - a.start);
      return `<li class="${a.status}" title="${esc(a.description || a.name)}${a.model ? ' · ' + esc(a.model) : ''}">
        <i class="dot sm ${sd}"></i><span class="sname">${icon}${esc(a.name)}</span>
        ${a.type ? `<span class="badge">${esc(a.type)}</span>` : ''}<span class="time">${time}</span></li>`;
    }).join('')}</ul>` : '';
    return `<div class="session ${s.state}">
      <div class="row"><i class="dot ${dot}"></i><span class="name" title="${esc(s.name)}">${esc(s.name)}</span>
        <span class="swatch" style="background:${color};box-shadow:0 0 6px ${color}"></span></div>
      <div class="meta">${label}${s.state === 'waiting' ? '<span class="tag waiting">input</span>' : ''} · ${dur(now - s.lastEvent)} ago</div>
      ${subHtml}</div>`;
  }).join('');
}

/** Subscribes to the server's live session feed. */
export function connect(onData: (data: Snapshot) => void) {
  const es = new EventSource('/events');
  es.onmessage = e => { onData(JSON.parse(e.data)); connEl.textContent = 'live · updated ' + new Date().toLocaleTimeString(); };
  es.onerror = () => { connEl.textContent = 'disconnected — is server.js running?'; };
  es.addEventListener('shutdown', () => {
    es.close();
    document.getElementById('closed')!.hidden = false;
    window.close(); // only works if the browser allows it; otherwise the overlay stays
  });
}

const skyEl = document.getElementById('sky')!;
export function setSkyText(text: string) { if (skyEl.textContent !== text) skyEl.textContent = text; }
