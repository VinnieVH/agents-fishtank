// electron-builder afterPack hook (package.json "build.afterPack"). node-pty 1.1.0's macOS prebuilds ship
// spawn-helper without its execute bit, and with "npmRebuild": false it's packed as is: every terminal tab then fails
// with "posix_spawnp failed". Runs before signing, so the signature covers the fixed file.
import { chmodSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export default async ({ appOutDir, electronPlatformName, packager }) => {
  if (electronPlatformName !== 'darwin') return;
  const prebuilds = join(appOutDir, `${packager.appInfo.productFilename}.app`,
    'Contents/Resources/app.asar.unpacked/node_modules/node-pty/prebuilds');
  for (const folder of readdirSync(prebuilds)) {
    const helper = join(prebuilds, folder, 'spawn-helper');
    if (existsSync(helper)) chmodSync(helper, 0o755);
  }
};
