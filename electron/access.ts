// A CLI run once as administrator (or with sudo) can leave files in its folder that only an administrator may open:
// the Copilot CLI makes its .mcp-writer.lock admin-only, and every later copilot without admin rights then fails
// ("Shared writer storage I/O failed ... os_error=5") and can't send messages. These find and repair such files.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** The files directly in `dir` that this process isn't allowed to open for writing. */
export function lockedOut(dir: string): string[] {
  let names: string[];
  try { names = fs.readdirSync(dir); } catch { return []; }
  const out: string[] = [];
  for (const name of names) {
    const file = path.join(dir, name);
    try {
      if (!fs.statSync(file).isFile()) continue;
      fs.closeSync(fs.openSync(file, 'r+'));
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'EPERM' || code === 'EACCES') out.push(file);
    }
  }
  return out;
}

/** The command that gives the files back to you, for people to run themselves. */
export function repairCommand(files: string[]): string {
  return process.platform === 'win32'
    ? files.map(f => `icacls "${f}" /reset`).join('; ')
    : `sudo chown "$USER" ${files.map(f => `"${f}"`).join(' ')}`;
}

/**
 * Windows: resets the files' permissions to the folder's (which let you in), after an administrator prompt.
 * Resolves false when the prompt was declined or it didn't work.
 */
export function repair(files: string[]): Promise<boolean> {
  if (process.platform !== 'win32' || !files.length) return Promise.resolve(false);
  const script = files.map(f => `icacls '${f.replace(/'/g, "''")}' /reset`).join('; ');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const elevate = `Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-EncodedCommand','${encoded}'`;
  return new Promise(resolve => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', elevate], { windowsHide: true },
    err => resolve(!err && !lockedOut(path.dirname(files[0])).some(f => files.includes(f)))));
}
