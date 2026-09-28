import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectVisitors, toVisitor } from '../src/visitors.mjs';
import { createHandler } from '../src/handler.mjs';
import { cloudinarySource, mockSource } from '../src/sources.mjs';
import { parseCloudinaryUrl, searchExpression } from '../src/cloudinary.mjs';
import { MemorySeenStore } from '../src/warm.mjs';

const CLOUD = 'booth-test';
const res = (id, created_at, meta = {}, extra = {}) => ({
  public_id: id,
  created_at,
  metadata: {
    visitor_name: 'Maya Sol', first_name: 'Maya', email: 'maya.sol@cloudinary.com',
    product_type: 'pizza', variant: 'artichoke', favorite: 'Artichoke', face_detected: 'true', tv_status: 'auto',
    ...meta,
  },
  ...extra,
});

test('maps a resource to the spec section 6 shape with recipe URLs', () => {
  const { visitor } = toVisitor(res('maya-sol-a1b2', '2026-10-12T10:29:40Z'), CLOUD);
  assert.equal(visitor.id, 'maya-sol-a1b2');
  assert.equal(visitor.first_name, 'Maya');
  assert.equal(visitor.email, 'maya.sol@cloudinary.com');
  assert.equal(visitor.created_at, '2026-10-12T10:29:40.000Z');
  assert.deepEqual(Object.keys(visitor.urls).sort(), ['email', 'hero', 'label', 'magnet', 'pdp', 'selfie']);
  assert.match(visitor.urls.pdp, /^https:\/\/res\.cloudinary\.com\/booth-test\/image\/upload\/.*\$nm_!MAYA!.*t_tv_label\/t_tv_pdp\/booth\/templates\/product-base-pizza-artichoke\.png$/);
  assert.match(visitor.urls.selfie, /\/maya-sol-a1b2$/);
});

test('never exposes a surname: first_name, or the first word of visitor_name', () => {
  const { visitor } = toVisitor(res('x', '2026-10-12T10:00:00Z', { first_name: '', visitor_name: 'Giulia Bianchi' }), CLOUD);
  assert.equal(visitor.first_name, 'Giulia');
  assert.ok(!JSON.stringify({ ...visitor, email: '' }).includes('Bianchi'));
});

test('reads context when metadata is missing (VITE_META_MODE=context)', () => {
  const r = { public_id: 'noa-levi-m3', created_at: '2026-10-12T10:00:00Z',
    context: { custom: { first_name: 'Noa', email: 'Noa.Levi@cloudinary.com', product_type: 'pizza', variant: 'burrata', favorite: 'Burrata', face_detected: 'true' } } };
  const { visitor } = toVisitor(r, CLOUD);
  assert.equal(visitor.first_name, 'Noa');
  assert.equal(visitor.email, 'noa.levi@cloudinary.com');
});

test('leaves out hidden, faceless and incomplete uploads', () => {
  assert.equal(toVisitor(res('a', '2026-10-12T10:00:00Z', { tv_status: 'hidden' }), CLOUD).skip, 'hidden');
  assert.equal(toVisitor(res('b', '2026-10-12T10:00:00Z', { face_detected: 'false' }), CLOUD).skip, 'no face');
  assert.match(toVisitor(res('c', '2026-10-12T10:00:00Z', { product_type: 'sushi' }), CLOUD).skip, /product_type/);
});

test('newer than since, latest per email wins, oldest first, limit', () => {
  const rs = [
    res('old', '2026-10-12T09:00:00Z', { email: 'old@cloudinary.com' }),
    res('maya-1', '2026-10-12T10:05:00Z'),
    res('luca', '2026-10-12T10:06:00Z', { first_name: 'Luca', email: 'luca@cloudinary.com' }),
    res('maya-2', '2026-10-12T10:07:00Z'), // retake: replaces maya-1
    res('noa', '2026-10-12T10:08:00Z', { first_name: 'Noa', email: 'noa@cloudinary.com' }),
  ];
  const { visitors } = selectVisitors(rs, { cloud: CLOUD, since: '2026-10-12T10:00:00Z', limit: 10 });
  assert.deepEqual(visitors.map((v) => v.id), ['luca', 'maya-2', 'noa']);
  const { visitors: two } = selectVisitors(rs, { cloud: CLOUD, since: '2026-10-12T10:00:00Z', limit: 2 });
  assert.deepEqual(two.map((v) => v.id), ['luca', 'maya-2']);
});

test('search window is whole days and at least 1', () => {
  const now = Date.parse('2026-10-12T10:30:00Z');
  assert.equal(searchExpression('2026-10-12T10:00:00Z', now), 'resource_type:image AND tags=booth-visitor AND created_at>2d');
  assert.match(searchExpression('2026-10-09T10:00:00Z', now), /created_at>5d$/);
});

test('parses CLOUDINARY_URL', () => {
  assert.deepEqual(parseCloudinaryUrl('cloudinary://123:abc%2Fdef@booth-cloud'), { key: '123', secret: 'abc/def', cloud: 'booth-cloud' });
  assert.throws(() => parseCloudinaryUrl('nope'));
});

// A fake Cloudinary: records calls, returns one page of search results, 200 for every image GET.
function fakeFetch(resources) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/resources/search')) return new Response(JSON.stringify({ resources }), { status: 200 });
    return new Response('img', { status: 200 });
  };
  return { fn, calls };
}

test('handler: end to end with a fake Cloudinary, warms each new visitor once', async () => {
  const recent = new Date(Date.now() - 60_000).toISOString();
  const { fn, calls } = fakeFetch([res('maya-sol-a1b2', recent)]);
  const source = cloudinarySource({ cloud: CLOUD, key: 'k', secret: 's', seen: new MemorySeenStore(), fetchImpl: fn });
  const handle = createHandler({ source });
  const pending = [];
  const r1 = await handle(new Request('http://x/api/tv/visitors?limit=10'), { waitUntil: (p) => pending.push(p) });
  assert.equal(r1.status, 200);
  const body = await r1.json();
  assert.equal(body.visitors.length, 1);
  assert.ok(body.now);
  await Promise.all(pending);
  const search = calls.find((c) => c.url.endsWith('/resources/search'));
  assert.equal(search.init.headers.Authorization, `Basic ${btoa('k:s')}`);
  assert.deepEqual(JSON.parse(search.init.body).sort_by, [{ created_at: 'asc' }]);
  assert.equal(calls.filter((c) => c.url.startsWith('https://res.cloudinary.com/')).length, 6);
  await handle(new Request('http://x/api/tv/visitors'), { waitUntil: (p) => pending.push(p) });
  await Promise.all(pending);
  assert.equal(calls.filter((c) => c.url.startsWith('https://res.cloudinary.com/')).length, 6, 'no second warm-up');
});

test('handler: token, bad since, upstream failure, CORS preflight, 404', async () => {
  const failing = { name: 'x', visitors: async () => { throw new Error('boom secret=abc'); } };
  const handle = createHandler({ source: failing, readToken: 't0k' });
  assert.equal((await handle(new Request('http://x/api/tv/visitors'))).status, 401);
  const ok = { headers: { Authorization: 'Bearer t0k' } };
  assert.equal((await handle(new Request('http://x/api/tv/visitors?since=yesterday', ok))).status, 400);
  const r = await handle(new Request('http://x/api/tv/visitors', ok));
  assert.equal(r.status, 502);
  assert.ok(!(await r.text()).includes('secret'));
  const pre = await handle(new Request('http://x/api/tv/visitors', { method: 'OPTIONS' }));
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-headers'), 'Authorization');
  assert.equal((await handle(new Request('http://x/api/nope', ok))).status, 404);
});

test('mock source: arrivals over time and a rush', async () => {
  const data = { visitors: [
    { id: 'a', email: 'a@x', urls: {} }, { id: 'b', email: 'b@x', urls: {} },
    { id: 'c', email: 'c@x', urls: {} }, { id: 'd', email: 'd@x', urls: {} },
  ] };
  const start = Date.now();
  const src = mockSource({ data, rush: 3, startedAt: start - 30_000 }); // 30 s after start
  const since = new Date(start - 3_600_000).toISOString();
  const { visitors } = await src.visitors(since, 50);
  assert.deepEqual(visitors.map((v) => v.id), ['a', 'b', 'a-rush1', 'b-rush2', 'c-rush3']);
});
