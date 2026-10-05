#!/usr/bin/env node
// One-time: signs a Cloudinary cacheable search URL for the TV, so the TV can read the latest
// visitors (with their metadata) straight from the CDN, with no backend and no secret on the TV.
// https://cloudinary.com/documentation/cacheable_search_urls
//
//   node scripts/sign-search-url.mjs            # prints the URL and test-fetches it
//   node scripts/sign-search-url.mjs --no-test  # prints the URL only
//
// Fill in the vars below, or pass them as env vars. Do not commit the secret: clear it after running.
// Signing matches the Cloudinary SDKs (Search.to_url): sha256(ttl + base64(sorted JSON) + secret).
import { createHash } from 'node:crypto';

const CLOUD_NAME = 'cld-everywhere-demo' || process.env.CLOUDINARY_CLOUD_NAME;
const API_SECRET = '' || process.env.CLOUDINARY_API_SECRET;
// The API key is not part of a search URL signature, so it is not needed here.

// Visitors uploaded by the wizard, newest first so a busy day never pushes the latest visitors past
// max_results. A relative date counts whole days (created_at>1d returned nothing the morning after a
// day's uploads), so 2d always covers the last 24 h; the TV does the exact 24 h cut and the order itself.
const TTL = 10; // seconds Cloudinary caches the result before running the search again (the TV polls every 10 s)
const QUERY = {
  expression: 'resource_type:image AND tags=booth-visitor AND created_at>2d',
  sort_by: [{ created_at: 'desc' }],
  max_results: 500, // the Search API maximum
  with_field: ['metadata', 'context', 'tags'],
};

if (!CLOUD_NAME || !API_SECRET) {
  console.error('Set CLOUD_NAME and API_SECRET at the top of this file (or CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_SECRET).');
  process.exit(1);
}

const sorted = Object.fromEntries(Object.keys(QUERY).sort().map((k) => [k, QUERY[k]]));
const encoded = Buffer.from(JSON.stringify(sorted)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
const signature = createHash('sha256').update(`${TTL}${encoded}${API_SECRET}`).digest('hex');
const url = `https://res.cloudinary.com/${CLOUD_NAME}/search/${signature}/${TTL}/${encoded}`;

console.log(`\nSigned search URL (TTL ${TTL} s):\n\n${url}\n`);

if (process.argv.includes('--no-test')) process.exit(0);

// Test-fetch: checks the signature works and that metadata and context come back in a search URL.
const res = await fetch(url);
console.log(`Test fetch: HTTP ${res.status}, CORS ${res.headers.get('access-control-allow-origin') ?? '(no header)'}`);
if (!res.ok) {
  console.log(await res.text());
  process.exit(1);
}
const body = await res.json();
const resources = body.resources ?? [];
console.log(`total_count ${body.total_count}, returned ${resources.length}${body.next_cursor ? ', has next_cursor' : ''}`);
const first = resources[0];
if (first) {
  console.log(`Newest: ${first.public_id}, created_at ${first.created_at}`);
  console.log(`  metadata fields: ${first.metadata ? Object.keys(first.metadata).join(', ') || '(empty)' : 'MISSING'}`);
  const ctx = first.context?.custom ?? first.context;
  console.log(`  context fields:  ${ctx ? Object.keys(ctx).join(', ') || '(empty)' : 'MISSING'}`);
  console.log(`  tags:            ${(first.tags ?? []).join(', ') || 'MISSING'}`);
}
