import { defineConfig } from 'vite';

// Builds the desktop app's Node side into dist-electron/, one self-contained file per entry (no shared chunks):
//   vite build -c vite.electron.config.mts --mode main     the app (electron/main.ts) -> main.js, inside the app archive
//   vite build -c vite.electron.config.mts --mode preload  what the window's page gets (electron/preload.ts) ->
//                                                          preload.cjs (a sandboxed preload can't be a module)
//   vite build -c vite.electron.config.mts --mode cli      its command line (electron/cli.ts) -> cli.mjs, shipped next to
//                                                          the archive so the launcher scripts can run it
// node-pty stays in node_modules: it loads its native binary from beside it.
const ENTRIES: Record<string, { entry: string; file: string }> = {
  main: { entry: 'electron/main.ts', file: 'main.js' },
  preload: { entry: 'electron/preload.ts', file: 'preload.cjs' },
  cli: { entry: 'electron/cli.ts', file: 'cli.mjs' },
};

export default defineConfig(({ mode }) => ({
  build: {
    ssr: ENTRIES[mode].entry,
    outDir: 'dist-electron',
    emptyOutDir: false,
    target: 'node22',
    rollupOptions: {
      external: ['electron', 'node-pty'],
      output: { format: mode === 'preload' ? 'cjs' : 'es', entryFileNames: ENTRIES[mode].file },
    },
  },
  ssr: { noExternal: true },
}));
