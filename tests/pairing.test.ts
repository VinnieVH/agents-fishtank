import { describe, expect, it } from 'vitest';
import { CODE_MS, LOCK_MS, MAX_TRIES, createPairing, newPairingCode } from '../server/pairing';

const codes = (...list: string[]) => () => list.shift() ?? '999999';

describe('pairing codes', () => {
  it('are six digits', () => {
    for (let index = 0; index < 50; index++) expect(newPairingCode()).toMatch(/^\d{6}$/);
  });

  it('pair once, then change', () => {
    const pairing = createPairing(codes('123456', '654321'));
    expect(pairing.current(0).code).toBe('123456');
    expect(pairing.tryCode('123456', 10)).toBe('paired');
    expect(pairing.current(20).code).toBe('654321');
    expect(pairing.tryCode('123456', 30)).toBe('wrong');
  });

  it('change after a few minutes', () => {
    const pairing = createPairing(codes('123456', '654321'));
    pairing.current(0);
    expect(pairing.tryCode('123456', CODE_MS)).toBe('wrong');
    expect(pairing.current(CODE_MS).code).toBe('654321');
  });

  it('stop taking tries for a minute after a few wrong ones, with a new code', () => {
    const pairing = createPairing(codes('123456', '654321'));
    for (let index = 1; index < MAX_TRIES; index++) expect(pairing.tryCode('000000', index)).toBe('wrong');
    expect(pairing.tryCode('000000', MAX_TRIES)).toBe('locked');
    expect(pairing.tryCode('654321', MAX_TRIES + 1)).toBe('locked'); // even the right code
    expect(pairing.tryCode('654321', MAX_TRIES + LOCK_MS)).toBe('paired');
  });
});
