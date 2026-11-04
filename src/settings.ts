import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';
import type { Snapshot } from '../shared/types';
import { qrCode } from './qr';

// The settings dialog: opened with the gear in the panel, or from the app's menu (Settings…, which calls
// window.openSettings). Every change is posted to the server right away; the server saves it and sends the new
// settings back with the next snapshot, which is what the tank applies.

const dialog = document.getElementById('settings') as HTMLDialogElement;
const form = dialog.querySelector('form')!;
const field = <T extends HTMLInputElement | HTMLSelectElement>(name: string) => form.elements.namedItem(name) as T;
const FLAGS = ['visitors', 'crabAlways', 'notifyWaiting', 'notifyFinished', 'openOnSession', 'quitWhenIdle', 'openAtLogin', 'shareOnNetwork', 'trayIcon'] as const;
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

const addressRow = (url: string) => {
  const row = document.createElement('li');
  const text = document.createElement('div');
  const address = document.createElement('code');
  address.textContent = url;
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy';
  copy.addEventListener('click', () => {
    void navigator.clipboard?.writeText(url).then(() => { copy.textContent = 'Copied'; }, () => {});
  });
  text.append(address, copy);
  row.append(text);
  return row;
};

const addressList = (urls: string[]) => {
  const list = document.createElement('ul');
  list.append(...urls.map(addressRow));
  return list;
};

// a computer on more than one network (say Ethernet and Wi-Fi) has an address on each; the first gets the QR code
const otherAddresses = (urls: string[]) => urls.length
  ? [Object.assign(document.createElement('small'), { className: 'hint', textContent: 'Other addresses of this computer, if that one doesn\'t open:' }), addressList(urls)]
  : [];

// the address without the key, short enough to type with a remote; the device pairs with the code instead
const shortAddress = (url: string) => new URL(url).host;

const pairingLine = (url: string, pairingCode = '') => {
  const line = document.createElement('p');
  line.className = 'pair';
  if (!pairingCode) return line;
  const address = Object.assign(document.createElement('code'), { textContent: shortAddress(url) });
  const code = Object.assign(document.createElement('b'), { textContent: `${pairingCode.slice(0, 3)} ${pairingCode.slice(3)}` });
  line.append('On a TV or another device without a camera: open ', address, ' and enter ', code,
    '. The code changes every few minutes and after each use.');
  return line;
};

const shareHint = (share: NonNullable<Snapshot['share']>) => {
  if (share.error) return `Couldn't share the tank: ${share.error}`;
  if (!share.urls.length) return 'This computer isn\'t on a network right now.';
  return 'Scan this code with a phone or tablet on the same network, or open the address there. It has a secret key: only share it with people who may see your sessions.';
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
  const [first, ...others] = share.urls;
  if (!first) { shareEl.replaceChildren(hint); return; }
  const list = addressList([first]);
  list.firstElementChild?.prepend(qrCode(first, 'QR code of this address'));
  shareEl.replaceChildren(hint, list, pairingLine(first, share.pairingCode), ...otherAddresses(others));
};
