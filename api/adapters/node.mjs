#!/usr/bin/env node
// Local Node adapter: mounts the provider-neutral handler on node:http, for development and for
// running the backend on the booth laptop if needed.
//
//   node adapters/node.mjs            # real booth cloud (needs CLOUDINARY_URL)
//   node adapters/node.mjs --mock     # serves assets/mock, no cloud, no secret
//
// Config from env (see ../.env.example). Loads ../.env if present.
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCloudinaryUrl } from '../src/cloudinary.mjs';
import { createHandler } from '../src/handler.mjs';
import { cloudinarySource, mockSource } from '../src/sources.mjs';
import { MemorySeenStore } from '../src/warm.mjs';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env;
const mock = process.argv.includes('--mock') || env.MOCK === '1';
const port = Number(env.PORT || 8787);
const log = (e) => console.log(JSON.stringify({ t: new Date().toISOString(), ...e }));

let source;
if (mock) {
  const data = JSON.parse(readFileSync(new URL('../../assets/mock/visitors.json', import.meta.url), 'utf8'));
  source = mockSource({ data, rush: Number(env.MOCK_RUSH || 0) });
} else {
  let creds;
  try {
    creds = parseCloudinaryUrl(env.CLOUDINARY_URL);
  } catch (e) {
    console.error(`${e.message}\nSet it in api/.env (never commit it), or run with --mock.`);
    process.exit(1);
  }
  source = cloudinarySource({ ...creds, seen: new MemorySeenStore(), log });
}

const handle = createHandler({ source, readToken: env.TV_READ_TOKEN || '', corsOrigin: env.CORS_ORIGIN || '*', log });

createServer(async (req, res) => {
  try {
    const request = new Request(new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`), {
      method: req.method,
      headers: req.headers,
    });
    const pending = [];
    const response = await handle(request, { waitUntil: (p) => pending.push(p) });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    await Promise.all(pending); // warm-ups finish after the response is sent
  } catch (e) {
    log({ type: 'adapter-error', error: String(e) });
    if (!res.headersSent) res.writeHead(500).end();
  }
}).listen(port, () => log({ type: 'listening', port, source: source.name }));
