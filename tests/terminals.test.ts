import { describe, expect, it } from 'vitest';
import { osc52Text } from '../shared/terminals.ts';

const base64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

describe('OSC 52 copy', () => {
  it('decodes the text a CLI copies, in the forms Copilot CLI sends', () => {
    expect(osc52Text(`c;${base64('npm test')}`)).toBe('npm test');
    expect(osc52Text(`p!;${base64('vis 🐟 é')};`)).toBe('vis 🐟 é');
  });

  it('ignores clipboard reads and malformed sequences', () => {
    expect(osc52Text('c;?')).toBeUndefined();
    expect(osc52Text('c;')).toBeUndefined();
    expect(osc52Text('nonsense')).toBeUndefined();
    expect(osc52Text('c;%%%')).toBeUndefined();
  });
});
