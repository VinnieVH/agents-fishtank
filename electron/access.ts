// A CLI run once as administrator (or with sudo) can leave files in its folder that only an administrator may open:
// the Copilot CLI makes its .mcp-writer.lock admin-only, and every later copilot without admin rights then fails
// ("Shared writer storage I/O failed ... os_error=5") and can't send messages. These find and repair such files.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const isLockedOut = (file: string) => {
  try {
    if (!fs.statSync(file).isFile()) return false;
    fs.closeSync(fs.openSync(file, 'r+'));
    return false;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'EPERM' || code === 'EACCES';
  }
};

/** The files directly in `folder` that this process isn't allowed to open for writing. */
export const lockedOut = (folder: string): string[] => {
  let names: string[];
  try { names = fs.readdirSync(folder); } catch { return []; }
  return names.map(name => path.join(folder, name)).filter(isLockedOut);
};

/** The command that gives the files back to you, for people to run themselves. */
export const repairCommand = (files: string[]): string =>
  process.platform === 'win32'
    ? files.map(file => `icacls "${file}" /reset`).join('; ')
    : `sudo chown "$USER" ${files.map(file => `"${file}"`).join(' ')}`;

/**
 * Windows: resets the files' permissions to the folder's (which let you in), after an administrator prompt.
 * Resolves false when the prompt was declined or it didn't work.
 */
export const repair = (files: string[]): Promise<boolean> => {
  if (process.platform !== 'win32' || !files.length) return Promise.resolve(false);
  const script = files.map(file => `icacls '${file.replace(/'/g, "''")}' /reset`).join('; ');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const elevate = `Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-EncodedCommand','${encoded}'`;
  return new Promise(resolve => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', elevate], { windowsHide: true },
    error => resolve(!error && !lockedOut(path.dirname(files[0])).some(file => files.includes(file)))));
};
