import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const serverTarget = process.env.ARENA_SERVER ?? 'http://localhost:2567';

const proxy = {
  '/api': serverTarget,
  '/health': serverTarget,
  // Colyseus matchmaking + WebSocket, so the browser only needs to reach the Vite port.
  '/colyseus': {
    target: serverTarget,
    ws: true,
    rewrite: (path: string) => path.replace(/^\/colyseus/, '')
  }
};

export default defineConfig({
  resolve: {
    // Use shared sources directly so engine changes hot-reload without a rebuild.
    alias: {
      '@arena-kingdom/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy
  },
  preview: {
    proxy
  },
  build: {
    chunkSizeWarningLimit: 1600
  }
});
