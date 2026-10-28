import { describe, expect, it } from 'vitest';
import { terminalOf } from '../server/terminal.ts';

describe('finding the terminal of a session', () => {
  it('finds iTerm and the tty from the process tree', () => {
    const ps = [
      '    1     0 ??       /sbin/launchd',
      ' 1754     1 ??       /Applications/iTerm.app/Contents/MacOS/iTerm2',
      ' 1819  1754 ??       /Users/me/Library/Application Support/iTerm2/iTermServer-3.6.11',
      ' 1820  1819 ttys000  /usr/bin/login',
      ' 1821  1820 ttys000  -zsh',
      ' 4019  1821 ttys000  claude',
    ].join('\n');
    expect(terminalOf(ps, 4019)).toEqual({ app: '/Applications/iTerm.app', tty: '/dev/ttys000' });
  });

  it('takes the editor, not its helper, for a terminal inside VS Code', () => {
    const ps = [
      '  500     1 ??       /Applications/Visual Studio Code.app/Contents/MacOS/Electron',
      '  510   500 ??       /Applications/Visual Studio Code.app/Contents/Frameworks/Code Helper (Plugin).app/Contents/MacOS/Code Helper (Plugin)',
      '  520   510 ttys004  /bin/zsh',
      '  530   520 ttys004  copilot',
    ].join('\n');
    expect(terminalOf(ps, 530)).toEqual({ app: '/Applications/Visual Studio Code.app', tty: '/dev/ttys004' });
  });

  it('finds no app for a session inside tmux, or one that has gone', () => {
    const ps = ['  700     1 ??       tmux', '  710   700 ttys009  -zsh', '  720   710 ttys009  claude'].join('\n');
    expect(terminalOf(ps, 720)).toEqual({ tty: '/dev/ttys009' });
    expect(terminalOf(ps, 999)).toEqual({});
  });
});
