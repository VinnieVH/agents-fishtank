// Pairing a device that can't scan the QR code, like a TV: it opens the short shared address and types the code from
// the settings on this computer, and gets the shared key back. Six digits could be guessed, so a code only lasts a
// few minutes and changes after every use, and after a few wrong tries pairing waits a minute and the code changes.
import crypto from 'node:crypto';

export const CODE_MS = 5 * 60_000, LOCK_MS = 60_000, MAX_TRIES = 5;

export type PairingOutcome = 'paired' | 'wrong' | 'locked';

export const newPairingCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

const isSameCode = (given: string, code: string) =>
  given.length === code.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(code));

export const createPairing = (newCode = newPairingCode) => {
  let code = '', expires = 0, misses = 0, lockedUntil = 0;
  const renew = (now: number) => { code = newCode(); expires = now + CODE_MS; };
  const current = (now = Date.now()) => {
    if (now >= expires) renew(now);
    return { code, expires };
  };
  const tryCode = (given: string, now = Date.now()): PairingOutcome => {
    if (now < lockedUntil) return 'locked';
    current(now);
    if (isSameCode(given, code)) { renew(now); misses = 0; return 'paired'; }
    misses++;
    if (misses < MAX_TRIES) return 'wrong';
    misses = 0; lockedUntil = now + LOCK_MS; renew(now);
    return 'locked';
  };
  return { current, tryCode };
};
