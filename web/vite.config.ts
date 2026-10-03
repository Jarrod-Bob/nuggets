import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

/**
 * nuggets has no release version (package.json stays at 0.0.0), so the build
 * identifier is the git commit the frontend was built from — what the
 * "Report a bug" link pre-fills as the version. Builds outside a git checkout
 * fall back to "unknown".
 */
function buildId(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() !== '';
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __NUGGETS_BUILD__: JSON.stringify(buildId()),
  },
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
