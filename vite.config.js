import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'frontend',
  envDir: __dirname,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'frontend/index.html'),
        admin: resolve(__dirname, 'frontend/admin.html')
      }
    }
  }
});