import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';

// The settings dialog: opened with the gear in the panel, or from the app's menu (Settings…, which calls
// window.openSettings). Every change is posted to the server right away; the server saves it and sends the new
// settings back with the next snapshot, which is what the tank applies.

const dialog = document.getElementById('settings') as HTMLDialogElement;
const form = dialog.querySelector('form')!;
const field = <T extends HTMLInputElement | HTMLSelectElement>(name: string) => form.elements.namedItem(name) as T;
const FLAGS = ['visitors', 'crabAlways', 'notifyWaiting', 'notifyFinished', 'openOnSession', 'quitWhenIdle', 'openAtLogin'] as const;

let current: Settings = DEFAULT_SETTINGS;

/** Shows the latest settings in the dialog, unless the user is busy changing them. */
export function showSettings(s: Settings, desktop: boolean) {
  current = s;
  for (const el of dialog.querySelectorAll<HTMLElement>('[data-desktop]')) el.hidden = !desktop;
  if (dialog.open && dialog.contains(document.activeElement) && document.activeElement?.matches('input[type=number]')) return;
  field<HTMLSelectElement>('daylight').value = s.daylight;
  field<HTMLSelectElement>('motion').value = s.motion;
  field<HTMLSelectElement>('notifyAfter').value = String(s.notifyAfter);
  for (const k of FLAGS) field<HTMLInputElement>(k).checked = s[k];
  field<HTMLInputElement>('customLocation').checked = !!s.location;
  if (s.location) { field<HTMLInputElement>('lat').value = String(s.location.lat); field<HTMLInputElement>('lon').value = String(s.location.lon); }
  coords();
}

function coords() {
  (dialog.querySelector('.coords') as HTMLElement).hidden = !field<HTMLInputElement>('customLocation').checked;
}

function save(change: Partial<Settings>) {
  current = { ...current, ...change };
  void fetch('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change) }).catch(() => {});
}

form.addEventListener('change', e => {
  const el = e.target as HTMLInputElement;
  if (el.name === 'daylight' || el.name === 'motion') save({ [el.name]: el.value });
  else if (el.name === 'notifyAfter') save({ notifyAfter: Number(el.value) });
  else if ((FLAGS as readonly string[]).includes(el.name)) save({ [el.name]: el.checked });
  else if (el.name === 'customLocation' || el.name === 'lat' || el.name === 'lon') {
    coords();
    const lat = parseFloat(field<HTMLInputElement>('lat').value), lon = parseFloat(field<HTMLInputElement>('lon').value);
    if (!field<HTMLInputElement>('customLocation').checked) save({ location: null });
    else if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) save({ location: { lat, lon } });
  }
});

function open() { if (!dialog.open) dialog.showModal(); }
document.getElementById('gear')!.addEventListener('click', open);
// the app's menu item (electron/main.ts)
(window as unknown as { openSettings: () => void }).openSettings = open;
