import type { Session, Snapshot, Source, State, Subagent } from '../shared/types';
import type { Air, Tanks } from './limits';
import type { Phase } from './sky';
import { escapeHtml, formatDuration } from './util';
import { forgetSharedKey, isSharedAddress, sharedKey, showPairing } from './viewer';

export type { Session, Snapshot } from '../shared/types';

const SOURCE: Record<Source, string> = { copilot: 'Copilot', claude: 'Claude' };
const STATE_DOT: Partial<Record<State, string>> = { working: 'on', waiting: 'wait' };
const STATE_LABEL: Partial<Record<State, string>> = { working: 'working', waiting: 'waiting for you' };
const SUBAGENT_DOT: Partial<Record<Subagent['status'], string>> = { running: 'on', failed: 'off' };
const SUBAGENT_ICON: Partial<Record<Subagent['status'], string>> = { done: '✓ ', failed: '✗ ', stopped: '■ ' };

const listEl = document.getElementById('sessions')!, connEl = document.getElementById('conn')!, countEl = document.getElementById('count')!;

const runningFirst = (subagent: Subagent) => subagent.status === 'running' ? 0 : 1;

const subagentRow = (subagent: Subagent, now: number) => {
  const dot = SUBAGENT_DOT[subagent.status] ?? 'done';
  const icon = SUBAGENT_ICON[subagent.status] ?? '';
  const time = subagent.status === 'running' ? formatDuration(now - subagent.start) : formatDuration((subagent.end || now) - subagent.start);
  return `<li class="${subagent.status}" title="${escapeHtml(subagent.description || subagent.name)}${subagent.model ? ' · ' + escapeHtml(subagent.model) : ''}">
        <i class="dot sm ${dot}"></i><span class="sname">${icon}${escapeHtml(subagent.name)}</span>
        ${subagent.type ? `<span class="badge">${escapeHtml(subagent.type)}</span>` : ''}<span class="time">${time}</span></li>`;
};

const subagentList = (subagents: Subagent[], now: number) => {
  const sorted = subagents.slice().sort((first, second) => runningFirst(first) - runningFirst(second) || second.start - first.start);
  return sorted.length ? `<ul class="subs">${sorted.map(subagent => subagentRow(subagent, now)).join('')}</ul>` : '';
};

const sessionCard = (session: Session, color: string, now: number) => `<div class="session ${session.state}">
      <div class="row"><i class="dot ${STATE_DOT[session.state] ?? 'off'}"></i><span class="name" title="${escapeHtml(session.name)}">${escapeHtml(session.name)}</span>
        <span class="src ${session.source}">${SOURCE[session.source]}</span>
        <span class="swatch" style="background:${color};box-shadow:0 0 6px ${color}"></span></div>
      <div class="meta">${STATE_LABEL[session.state] ?? 'idle'}${session.state === 'waiting' ? '<span class="tag waiting">input</span>' : ''} · ${formatDuration(now - session.lastEvent)} ago</div>
      ${subagentList(session.subagents, now)}</div>`;

/** Renders the session list. colorOf gives the fish's neon colour for the swatch. */
export const renderPanel = (snapshot: Snapshot, colorOf: (id: string) => string) => {
  const now = snapshot.time;
  // the ones that need you on top, so they're never scrolled out of sight; then the most recently active
  const waits = (session: Session) => session.state === 'waiting' ? 0 : 1;
  const sorted = [...snapshot.sessions].sort((first, second) => waits(first) - waits(second) || second.lastEvent - first.lastEvent);
  const waiting = sorted.filter(session => session.state === 'waiting').length;
  countEl.hidden = !sorted.length;
  countEl.innerHTML = `${sorted.length} session${sorted.length === 1 ? '' : 's'}${waiting ? ` · <b>${waiting} need${waiting === 1 ? 's' : ''} you</b>` : ''}`;
  if (!sorted.length) { listEl.innerHTML = '<div class="empty">No sessions active in the last hour</div>'; return; }
  listEl.innerHTML = sorted.map(session => sessionCard(session, colorOf(session.id), now)).join('');
};

/**
 * Subscribes to the server's live session feed; on another device with the shared key (server/share.ts), and without
 * one, after pairing with the code shown on the computer.
 */
export const connect = (onData: (snapshot: Snapshot) => void) => {
  const key = isSharedAddress() ? sharedKey() : null;
  if (isSharedAddress() && !key) { showPairing(() => connect(onData)); return; }
  const events = new EventSource(key ? `/events?key=${encodeURIComponent(key)}` : '/events');
  events.onmessage = message => { onData(JSON.parse(message.data)); connEl.textContent = 'live · updated ' + new Date().toLocaleTimeString(); };
  events.onerror = () => {
    connEl.textContent = 'disconnected — reconnecting…';
    // a refused key closes the feed for good (a lost connection retries instead): pair again
    if (key && events.readyState === EventSource.CLOSED) { forgetSharedKey(); showPairing(() => connect(onData)); }
  };
  events.addEventListener('shutdown', () => {
    events.close();
    document.getElementById('closed')!.hidden = false;
    window.close(); // the app closes its window; a browser may refuse, then the overlay stays
  });
};

const usageEl = document.getElementById('usage')!;
let usageHtml = '';

const usageRow = (name: string, air: Air | null) => {
  if (!air) return '';
  const level = air.low ? 'low' : air.warn ? 'warn' : 'ok', left = Math.floor(air.left);
  return `<div class="limit"><span class="lname">${name}</span><span class="air"><i class="${level}" style="width:${left}%"></i></span>
      <span class="lval">${left}% left${air.refill ? ` · refills ${escapeHtml(air.refill)}` : ''}</span></div>`;
};

/** Claude plan usage under the sessions: air left in the 5-hour and weekly tanks, and when they refill. */
export const renderUsage = (tanks: Tanks | null) => {
  const html = tanks ? `<div class="usage-title">Claude usage</div>${usageRow('5h', tanks.fiveHour)}${usageRow('Week', tanks.week)}` : '';
  if (html === usageHtml) return;
  usageHtml = html;
  usageEl.innerHTML = html;
  usageEl.hidden = !tanks;
};

const skyEl = document.getElementById('sky')!;
/** The badge in the panel's top-right corner with the time of day in the tank; the clock time shows on hover. */
export const setSky = (phase: Phase, time: string) => {
  if (skyEl.textContent !== phase) { skyEl.textContent = phase; skyEl.className = phase.toLowerCase(); skyEl.hidden = false; }
  skyEl.title = `${phase} in the tank · ${time}`;
};
