import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  envDir: '..',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
});
