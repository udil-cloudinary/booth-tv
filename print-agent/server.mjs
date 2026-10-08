#!/usr/bin/env node
// Print agent for the booth magnet printer (Citizen CZ-01, USB, through macOS CUPS), plus its status page.
//
//   npm run mock       # dry run on the 4 mock visitors, one new "upload" every 8 s
//   npm run dry-run    # dry run on the real booth cloud: downloads the magnets, prints nothing
//   npm start          # prints for real (needs PRINTER)
//
// Then open http://localhost:4100. Config: env vars or flags, see README.md.
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { Agent, REPO } from './agent.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const env = process.env;

// The search URL: SEARCH_URL, else the TV's own app/.env (VITE_SEARCH_URL), so both read the same thing.
async function searchUrl() {
  if (env.SEARCH_URL) return env.SEARCH_URL;
  try {
    const dotenv = await readFile(join(REPO, 'app/.env'), 'utf8');
    return dotenv.match(/^VITE_SEARCH_URL=(\S+)/m)?.[1] ?? '';
  } catch {
    return '';
  }
}

const source = flag('mock') ? 'mock' : 'search';
const printer = env.PRINTER || '';
const dryRun = flag('dry-run') || env.DRY_RUN === '1' || source === 'mock' || !printer;
const mode = source === 'mock' ? 'mock' : dryRun ? 'dry-run' : 'live';
const url = source === 'search' ? await searchUrl() : '';
if (source === 'search' && !url) {
  console.error('No search URL: set SEARCH_URL, or VITE_SEARCH_URL in app/.env (node app/scripts/sign-search-url.mjs). Or run with --mock.');
  process.exit(1);
}
if (!flag('dry-run') && env.DRY_RUN !== '1' && source === 'search' && !printer) {
  console.warn('PRINTER is not set: dry run, nothing will print. List printers with: lpstat -p');
}

const cfg = {
  mode,
  source,
  searchUrl: url,
  cloud: url ? new URL(url).pathname.split('/')[1] : 'mock',
  printer,
  dryRun,
  backlog: flag('backlog'),
  lpOptions: (env.LP_OPTIONS ?? '').split(/\s+/).filter(Boolean),
  pollSec: Number(env.POLL_SEC) || 10,
  printSec: Number(env.PRINT_SEC) || 19,
  mockEverySec: Number(env.MOCK_EVERY_SEC) || 8,
  // Each mode keeps its own state: a dry run must never mark a real visitor as printed.
  dataDir: resolve(env.DATA_DIR || join(import.meta.dirname, 'data', mode)),
};

const agent = new Agent(cfg);
await agent.start();

// ---------- HTTP ----------

const PUBLIC = join(import.meta.dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

async function sendFile(res, root, rel) {
  const file = normalize(join(root, decodeURIComponent(rel)));
  if (!file.startsWith(root + '/')) return send(res, 404, { error: 'not found' });
  try {
    const s = await stat(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'content-length': s.size, 'cache-control': 'max-age=60' });
    createReadStream(file).pipe(res);
  } catch {
    send(res, 404, { error: 'not found' });
  }
}

function send(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET') {
      if (pathname === '/api/state') return send(res, 200, agent.snapshot());
      if (pathname.startsWith('/files/')) return sendFile(res, agent.magnetDir, pathname.slice(7));
      if (pathname.startsWith('/mock/')) return sendFile(res, join(REPO, 'assets/mock'), pathname.slice(6));
      return sendFile(res, PUBLIC, pathname === '/' ? 'index.html' : pathname.slice(1));
    }
    if (req.method === 'POST') {
      // JSON only: a plain cross-site form cannot send this content type.
      if (!req.headers['content-type']?.startsWith('application/json')) return send(res, 415, { error: 'JSON only' });
      let m;
      if (pathname === '/api/pause') await agent.setPaused(true);
      else if (pathname === '/api/resume') await agent.setPaused(false);
      else if (pathname === '/api/poll') await agent.poll();
      else if (pathname === '/api/print-one') await agent.printOne();
      else if ((m = pathname.match(/^\/api\/jobs\/(.+)\/(print|skip|top)$/))) await agent.act(decodeURIComponent(m[1]), m[2]);
      else return send(res, 404, { error: 'not found' });
      return send(res, 200, agent.snapshot());
    }
    send(res, 405, { error: 'method not allowed' });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
});

const port = Number(env.PORT) || 4100;
const host = env.HOST || '127.0.0.1';
server.listen(port, host, () => {
  console.log(`Print agent (${mode}${printer ? `, printer ${printer}` : ''}) on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  console.log(`State: ${cfg.dataDir}`);
});
