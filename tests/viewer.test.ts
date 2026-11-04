import { describe, expect, it } from 'vitest';
import { isSharedAddress } from '../src/viewer';

describe('watching from another device', () => {
  it('pairs only on the shared address, never on this computer\'s own page', () => {
    for (const own of ['127.0.0.1', 'localhost', '[::1]']) expect(isSharedAddress(own)).toBe(false);
    expect(isSharedAddress('192.168.1.20')).toBe(true);
  });
});
