import { defineConfig, type Plugin } from 'vite';
import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

// The offline set lives in ../assets (shared with the docs and mock data), so it is
// served at ./assets in dev and copied into dist/assets on build, never duplicated in app/.
const ASSETS = resolve(__dirname, '../assets');
// The factory flow (?new-flow) cycles through the product variant art, served at ./templates (bases only).
const TEMPLATES = resolve(__dirname, '../templates/cloudinary');
const TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.html': 'text/html; charset=utf-8',
};

function boothAssets(): Plugin {
  return {
    name: 'booth-assets',
    configureServer(server) {
      server.middlewares.use('/templates', (req, res, next) => {
        const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]));
        const file = join(TEMPLATES, path);
        if (!file.startsWith(TEMPLATES) || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
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
      cpSync(TEMPLATES, resolve(__dirname, 'dist/templates'), {
        recursive: true,
        filter: (src) => !src.endsWith('.png') || src.includes('product-base-'),
      });
    },
  };
}

// Relative base so dist/ runs from any host or sub-path (e.g. /tv), or from a local static server.
// Vite's own bundles go to dist/build so they never collide with dist/assets.
export default defineConfig({
  base: './',
  plugins: [boothAssets()],
  server: { host: true },
  preview: { host: true },
  build: { target: 'es2020', assetsDir: 'build', assetsInlineLimit: 0 },
});
