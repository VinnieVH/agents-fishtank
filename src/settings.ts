import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';
import type { Snapshot } from '../shared/types';

// The settings dialog: opened with the gear in the panel, or from the app's menu (Settings…, which calls
// window.openSettings). Every change is posted to the server right away; the server saves it and sends the new
// settings back with the next snapshot, which is what the tank applies.

const dialog = document.getElementById('settings') as HTMLDialogElement;
const form = dialog.querySelector('form')!;
const field = <T extends HTMLInputElement | HTMLSelectElement>(name: string) => form.elements.namedItem(name) as T;
const FLAGS = ['visitors', 'crabAlways', 'notifyWaiting', 'notifyFinished', 'openOnSession', 'quitWhenIdle', 'openAtLogin', 'shareOnNetwork'] as const;
const LOCATION_FIELDS = ['customLocation', 'lat', 'lon'];

let current: Settings = DEFAULT_SETTINGS;

const showCoordinates = () => {
  (dialog.querySelector('.coords') as HTMLElement).hidden = !field<HTMLInputElement>('customLocation').checked;
};

/** Shows the latest settings in the dialog, unless the user is busy changing them. */
export const showSettings = (settings: Settings, desktop: boolean) => {
  current = settings;
  for (const element of dialog.querySelectorAll<HTMLElement>('[data-desktop]')) element.hidden = !desktop;
  if (dialog.open && dialog.contains(document.activeElement) && document.activeElement?.matches('input[type=number]')) return;
  field<HTMLSelectElement>('daylight').value = settings.daylight;
  field<HTMLSelectElement>('motion').value = settings.motion;
  field<HTMLSelectElement>('notifyAfter').value = String(settings.notifyAfter);
  for (const flag of FLAGS) field<HTMLInputElement>(flag).checked = settings[flag];
  field<HTMLInputElement>('customLocation').checked = !!settings.location;
  if (settings.location) {
    field<HTMLInputElement>('lat').value = String(settings.location.lat);
    field<HTMLInputElement>('lon').value = String(settings.location.lon);
  }
  showCoordinates();
};

const save = (change: Partial<Settings>) => {
  current = { ...current, ...change };
  void fetch('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change) }).catch(() => {});
};

const saveLocation = () => {
  showCoordinates();
  const lat = parseFloat(field<HTMLInputElement>('lat').value), lon = parseFloat(field<HTMLInputElement>('lon').value);
  if (!field<HTMLInputElement>('customLocation').checked) save({ location: null });
  else if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) save({ location: { lat, lon } });
};

form.addEventListener('change', event => {
  const control = event.target as HTMLInputElement;
  const { name } = control;
  if (name === 'daylight' || name === 'motion') save({ [name]: control.value });
  else if (name === 'notifyAfter') save({ notifyAfter: Number(control.value) });
  else if ((FLAGS as readonly string[]).includes(name)) save({ [name]: control.checked });
  else if (LOCATION_FIELDS.includes(name)) saveLocation();
});

const openSettings = () => { if (!dialog.open) dialog.showModal(); };
const gear = document.getElementById('gear')!;
gear.addEventListener('click', openSettings);
// the app's menu item (electron/main.ts)
(window as unknown as { openSettings: () => void }).openSettings = openSettings;

const shareEl = dialog.querySelector<HTMLElement>('.share')!;
let shareShown = '';

const shareRow = (url: string) => {
  const row = document.createElement('li');
  const address = document.createElement('code');
  address.textContent = url;
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy';
  copy.addEventListener('click', () => {
    void navigator.clipboard?.writeText(url).then(() => { copy.textContent = 'Copied'; }, () => {});
  });
  row.append(address, copy);
  return row;
};

const shareHint = (share: NonNullable<Snapshot['share']>) => {
  if (share.error) return `Couldn't share the tank: ${share.error}`;
  if (!share.urls.length) return 'This computer isn\'t on a network right now.';
  const which = share.urls.length > 1 ? 'one of these addresses (whichever is your Wi-Fi)' : 'this address';
  return `Open ${which} in a browser on a phone or tablet on the same network. It has a secret key: only share it with people who may see your sessions.`;
};

/** The shared addresses while sharing is on; on another device (a viewer), the gear goes, as it can only look. */
export const showShare = ({ share, viewer }: Pick<Snapshot, 'share' | 'viewer'>) => {
  gear.hidden = !!viewer;
  const shown = JSON.stringify(share ?? null);
  if (shown === shareShown) return;
  shareShown = shown;
  shareEl.hidden = !share;
  if (!share) return;
  const hint = document.createElement('small');
  hint.className = 'hint';
  hint.textContent = shareHint(share);
  const list = document.createElement('ul');
  list.append(...share.urls.map(shareRow));
  shareEl.replaceChildren(hint, list);
};
