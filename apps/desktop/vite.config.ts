import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';
import path from 'path';
import fs from 'fs';

// Plugin to copy the CJS preload after the main process build
function copyPreloadPlugin() {
  return {
    name: 'copy-preload',
    closeBundle() {
      const src = path.resolve(__dirname, 'preload.cjs');
      const dest = path.resolve(__dirname, 'dist/main/preload.cjs');
      if (fs.existsSync(src)) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['electron', 'better-sqlite3', 'chokidar', 'ws', 'fastify'],
            },
          },
          plugins: [copyPreloadPlugin()],
        },
      },
    ]),
    electronRenderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  build: {
    outDir: 'dist/renderer',
  },
});
