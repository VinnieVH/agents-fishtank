import { defineConfig } from 'vite';

// `npm run dev` serves the page with hot reload; live session data comes from the server (npm start) via the proxy.
export default defineConfig({
  build: { target: 'es2022' },
  server: {
    proxy: { '/events': { target: `http://127.0.0.1:${process.env.FISHTANK_PORT || 4321}` } },
  },
});
