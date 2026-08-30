import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // go:embed cannot reach outside its own package directory, so the
    // frontend builds into internal/web/dist rather than in place.
    outDir: '../internal/web/dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Same-origin in dev, so CORS never enters the picture.
    proxy: { '/api': 'http://127.0.0.1:7777' },
  },
});
