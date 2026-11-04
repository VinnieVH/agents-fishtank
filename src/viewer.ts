// Watching the tank from another device, over the address shared on the local network (server/share.ts). The key
// comes with the full address, or from pairing with the code shown in the settings on the computer, and the device
// keeps it, so next time the short address is enough.
const KEY_ITEM = 'fishtank.shareKey';
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const CODE = /^\d{6}$/;
const PROBLEMS: Record<number, string> = {
  403: 'That code isn\'t right. Check it in the settings on your computer.',
  429: 'Too many tries. Wait a minute: the computer shows a new code by then.',
};

/** True on the shared address, false on this computer's own page. */
export const isSharedAddress = (hostname = location.hostname) => !LOOPBACK.has(hostname);

// private browsing and some TV browsers have no storage, or refuse it: then the key lasts as long as the page
const keep = (key: string | null) => {
  try { if (key) localStorage.setItem(KEY_ITEM, key); else localStorage.removeItem(KEY_ITEM); } catch { /* not kept */ }
};
const kept = () => {
  try { return localStorage.getItem(KEY_ITEM); } catch { return null; }
};

/** The key from the shared address (kept, and taken out of the address bar so it isn't on screen), or the kept one. */
export const sharedKey = () => {
  const params = new URLSearchParams(location.search), fromAddress = params.get('key');
  if (!fromAddress) return kept();
  keep(fromAddress);
  params.delete('key');
  history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + location.hash);
  return fromAddress;
};

/** The kept key no longer works, e.g. after a new one was made on the computer. */
export const forgetSharedKey = () => keep(null);

const keyFrom = async (response: Response | null) => {
  if (!response?.ok) return '';
  const body: unknown = await response.json().catch(() => null);
  return typeof body === 'object' && body && 'key' in body && typeof body.key === 'string' ? body.key : '';
};

/** Asks for the code shown on the computer, and calls onPaired once the computer has handed over the key. */
export const showPairing = (onPaired: () => void) => {
  const form = document.querySelector<HTMLFormElement>('#pair')!;
  const input = form.querySelector('input')!, problem = form.querySelector<HTMLElement>('.problem')!;
  form.hidden = false;
  input.focus();
  form.onsubmit = async event => {
    event.preventDefault();
    const response = await fetch(`/pair?code=${encodeURIComponent(input.value.trim())}`, { method: 'POST' }).catch(() => null);
    const key = await keyFrom(response);
    if (key) { keep(key); form.hidden = true; onPaired(); return; }
    problem.textContent = PROBLEMS[response?.status ?? 0] ?? 'Couldn\'t reach your computer. Is sharing still on?';
    input.select();
  };
  input.oninput = () => { if (CODE.test(input.value.trim())) form.requestSubmit(); };
};
