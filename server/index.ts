// Runs the fishtank server on its own, for development: npm start, then open http://localhost:4321 (or npm run dev).
// The desktop app runs the same server itself (electron/main.ts).
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_PORT, startServer } from './server.ts';

const port = Number(process.env.FISHTANK_PORT) || DEFAULT_PORT;
const keepAlive = process.env.FISHTANK_KEEP_ALIVE === '1';

startServer({
  port,
  distDir: path.join(import.meta.dirname, '..', 'dist'),
  copilotSessionDir: process.env.COPILOT_SESSION_DIR,
  claudeConfigDir: process.env.CLAUDE_CONFIG_DIR,
  // apart from the app's own settings, so trying things out here doesn't change them
  settingsFile: process.env.FISHTANK_SETTINGS || path.join(os.tmpdir(), 'agent-fishtank-dev-settings.json'),
  onIdle: keepAlive ? undefined : () => {
    console.log('No Copilot CLI or Claude Code running, shutting down fishtank.');
    setTimeout(() => process.exit(0), 300);
  },
}).then(tank => console.log(`Agent fishtank: ${tank.url}`), (error: NodeJS.ErrnoException) => {
  console.log(error.code === 'EADDRINUSE' ? `Port ${port} is already in use (fishtank already running?).` : String(error));
  process.exit(error.code === 'EADDRINUSE' ? 0 : 1);
});
