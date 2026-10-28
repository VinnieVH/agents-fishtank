import { defineConfig } from 'vite';

// Builds the desktop app's Node side into dist-electron/, one self-contained file per entry (no shared chunks):
//   vite build -c vite.electron.config.mts --mode main   the app (electron/main.ts) -> main.js, inside the app archive
//   vite build -c vite.electron.config.mts --mode cli    its command line (electron/cli.ts) -> cli.mjs, shipped next to
//                                                        the archive so the launcher scripts can run it
export default defineConfig(({ mode }) => ({
  build: {
    ssr: mode === 'cli' ? 'electron/cli.ts' : 'electron/main.ts',
    outDir: 'dist-electron',
    emptyOutDir: false,
    target: 'node22',
    rollupOptions: {
      external: ['electron'],
      output: { format: 'es', entryFileNames: mode === 'cli' ? 'cli.mjs' : 'main.js' },
    },
  },
  ssr: { noExternal: true },
}));
