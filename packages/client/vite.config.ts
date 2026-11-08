import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'node:fs';

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? (process.env.PAGES_BASE_PATH || '/Snakegame/') : '/',
  define: {
    __GAME_TUNING__: readFileSync(resolve(__dirname, '../server/config/tuning.json'), 'utf8'),
  },
  server: {
    port: 5173,
    // Expose on LAN so phones can reach the dev server via QR code.
    host: true,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...(mode === 'pages' ? {} : { phone: resolve(__dirname, 'phone.html') }),
      },
    },
  },
}));
