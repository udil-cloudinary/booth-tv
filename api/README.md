# Booth TV backend

One endpoint, `GET /api/tv/visitors?since=<ISO>&limit=10` (spec section 6), as a provider-neutral handler: standard `Request` in, `Response` out. It is the only server code for the TV and the only place that holds the Cloudinary API secret.

## Run it locally

```
cd api
cp .env.example .env          # then fill in CLOUDINARY_URL (never commit .env)
npm run dev                   # real booth cloud, http://localhost:8787
npm run mock                  # no cloud, no secret: serves assets/mock (MOCK_RUSH=10 for a rush)
npm test                      # unit + handler tests with a fake Cloudinary
```

With the TV dev server running (`app/`, `npm run dev`), open the TV with `?mock=0`: Vite proxies `/api` to `localhost:8787`.

## What it does

1. **Search API** on the booth cloud: `resource_type:image AND tags=booth-visitor AND created_at>Nd`, oldest first, with metadata, context and tags. The day window is deliberately coarse. The exact cut is done in code (`src/visitors.mjs`), so the query does not depend on how the fields are typed:
   - `created_at > since`
   - `tv_status` not `hidden`
   - `face_detected` true
   - `product_type` one of pizza, gelato or caffe
2. **Reads the wizard's fields** from structured metadata, or from context if the booth cloud refused metadata on unsigned upload (the wizard's `VITE_META_MODE=context` fallback).
3. **Latest upload per email wins**, oldest first, at most `limit` (max 50).
4. **URLs** come from `visitorUrls()` in `templates/cloudinary-setup/recipes.mjs`, imported, not copied.
5. **Warm-up:** the first time the API sees a visitor, it GETs each of their 6 URLs once, so Cloudinary renders them before the TV asks. This happens after the response is sent (`waitUntil`), so the TV never waits. Who has been warmed lives in a `SeenStore` (in memory here; two methods, `has` and `add`, to map to a KV later). Warming twice is harmless.
6. **Response:** `{ now, visitors: [{ id, created_at, first_name, email, product_type, variant, favorite, urls: { selfie, label, hero, pdp, email, magnet } }] }`, `Cache-Control: no-store`. `first_name` never carries a surname; if it is empty, the first word of `visitor_name` is used.
7. **Errors:** Cloudinary failures return 502 with no details (the TV falls back to Maya); the details are logged. Bad `since` returns 400.

Also `GET /api/health` returns `{ ok, source }`.

## Config (`.env`, see `.env.example`)

| Var | Meaning |
|---|---|
| `CLOUDINARY_URL` | `cloudinary://<api_key>:<api_secret>@<booth_cloud>`. The only secret. |
| `TV_READ_TOKEN` | Optional. If set, requests need `Authorization: Bearer <token>`; the TV sends `VITE_API_TOKEN`. Recommended on a public URL, since the response includes emails. |
| `CORS_ORIGIN` | `Access-Control-Allow-Origin`, default `*`. Set to the TV's origin if you do not use a token. |
| `PORT`, `MOCK`, `MOCK_RUSH` | Local Node adapter only. |

## Deploying (for Hezzy)

Everything under `src/` is plain ES modules with `fetch`, `Request`, `Response` and `btoa`, and no dependencies. It runs unchanged on Cloudflare Workers, AWS Lambda (Node 22) and Vercel Functions. Write one thin adapter per provider next to `adapters/node.mjs`:

```js
import { createHandler } from '../src/handler.mjs';
import { cloudinarySource } from '../src/sources.mjs';
import { parseCloudinaryUrl } from '../src/cloudinary.mjs';
import { MemorySeenStore } from '../src/warm.mjs';
// build `handle` once per instance from the provider's env, then:
//   Workers:  export default { fetch: (req, env, ctx) => handle(req, ctx) }   (ctx.waitUntil)
//   Vercel:   export default (req, ctx) => handle(req, ctx)                   (waitUntil from @vercel/functions)
//   Lambda:   use a Function URL + response streaming, or convert the event to a Request
```

The adapter must pass `waitUntil` where the platform stops the function after the response; otherwise warm-ups may be cut short (harmless, the TV still preloads).

The handler imports `templates/cloudinary-setup/recipes.mjs` from this repo (`../../templates/...`), so deploy the repo as is, or bundle from its root.

## First run on the booth cloud

- [ ] `npm run dev`, then `curl localhost:8787/api/tv/visitors?since=2026-01-01T00:00:00Z` returns the test uploads.
- [ ] The Search API accepts the expression (in particular `created_at>Nd`). If not, see `searchExpression()` in `src/cloudinary.mjs`.
- [ ] `product_type`, `variant`, `face_detected` and `tv_status` come back as the values the wizard wrote (`pizza`, `artichoke`, `true`, `auto`). For single-select fields, that means the datasource external IDs are those slugs.
- [ ] Setting `tv_status` to `hidden` in the Cloudinary console removes the visitor from the next response.
- [ ] Every URL in the response returns 200 (the warm-up logs `warm-failed` with Cloudinary's `x-cld-error` if not).
