import type { Snapshot, Source } from '../shared/types';
import type { Air, Tanks } from './limits';
import { dur, esc } from './util';

export type { Session, Snapshot } from '../shared/types';

const SOURCE: Record<Source, string> = { copilot: 'Copilot', claude: 'Claude' };

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
        <span class="src ${s.source}">${SOURCE[s.source]}</span>
        <span class="swatch" style="background:${color};box-shadow:0 0 6px ${color}"></span></div>
      <div class="meta">${label}${s.state === 'waiting' ? '<span class="tag waiting">input</span>' : ''} · ${dur(now - s.lastEvent)} ago</div>
      ${subHtml}</div>`;
  }).join('');
}

/** Subscribes to the server's live session feed. */
export function connect(onData: (data: Snapshot) => void) {
  const es = new EventSource('/events');
  es.onmessage = e => { onData(JSON.parse(e.data)); connEl.textContent = 'live · updated ' + new Date().toLocaleTimeString(); };
  es.onerror = () => { connEl.textContent = 'disconnected — reconnecting…'; };
  es.addEventListener('shutdown', () => {
    es.close();
    document.getElementById('closed')!.hidden = false;
    window.close(); // the app closes its window; a browser may refuse, then the overlay stays
  });
}

const usageEl = document.getElementById('usage')!;
let usageHtml = '';

/** Claude plan usage under the sessions: air left in the 5-hour and weekly tanks, and when they refill. */
export function renderUsage(t: Tanks | null) {
  const row = (name: string, air: Air | null) => {
    if (!air) return '';
    const level = air.low ? 'low' : air.warn ? 'warn' : 'ok', left = Math.floor(air.left);
    return `<div class="limit"><span class="lname">${name}</span><span class="air"><i class="${level}" style="width:${left}%"></i></span>
      <span class="lval">${left}% left${air.refill ? ` · refills ${esc(air.refill)}` : ''}</span></div>`;
  };
  const html = t ? `<div class="usage-title">Claude usage</div>${row('5h', t.fiveHour)}${row('Week', t.week)}` : '';
  if (html === usageHtml) return;
  usageHtml = html;
  usageEl.innerHTML = html;
  usageEl.hidden = !t;
}

const skyEl = document.getElementById('sky')!;
export function setSkyText(text: string) { if (skyEl.textContent !== text) skyEl.textContent = text; }
