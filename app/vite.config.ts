import { defineConfig, type Plugin } from 'vite';
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

// The offline set lives in ../assets (shared with the docs and mock data), so it is
// served at ./assets in dev and copied into dist/assets on build, never duplicated in app/.
const ASSETS = resolve(__dirname, '../assets');
const TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp',
};

function boothAssets(): Plugin {
  return {
    name: 'booth-assets',
    configureServer(server) {
      server.middlewares.use('/assets', (req, res, next) => {
        const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]));
        const file = join(ASSETS, path);
        if (!file.startsWith(ASSETS) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      cpSync(ASSETS, resolve(__dirname, 'dist/assets'), {
        recursive: true,
        filter: (src) => !src.endsWith('.md') && !src.endsWith('.DS_Store'),
      });
    },
  };
}

// Relative base so dist/ runs from any host or sub-path (e.g. /tv), or from a local static server.
// Vite's own bundles go to dist/build so they never collide with dist/assets.
export default defineConfig({
  base: './',
  plugins: [boothAssets()],
  // In dev, /api goes to the local backend (products/booth-tv/api, `npm run mock` or `npm run dev`).
  server: { host: true, proxy: { '/api': process.env.API_PROXY || 'http://localhost:8787' } },
  preview: { host: true },
  build: { target: 'es2020', assetsDir: 'build', assetsInlineLimit: 0 },
});
