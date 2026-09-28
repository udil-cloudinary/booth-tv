// The booth TV backend as one provider-neutral handler: standard Request in, Response out.
// Mount it with a thin adapter per provider (adapters/node.mjs for local dev; Cloudflare, Lambda
// or Vercel later). The only endpoint: GET /api/tv/visitors (spec section 6).

const DEFAULT_LOOKBACK_MIN = 30;
const MAX_LIMIT = 50;

/**
 * @param {object} o
 * @param {{ name: string, visitors(since: string, limit: number): Promise<{ visitors: object[], warming: Promise<unknown> }> }} o.source
 * @param {string} [o.readToken]   if set, requests need `Authorization: Bearer <token>`
 * @param {string} [o.corsOrigin]  Access-Control-Allow-Origin (default "*")
 * @param {(e: object) => void} [o.log]
 */
export function createHandler({ source, readToken = '', corsOrigin = '*', log = () => {} }) {
  const cors = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  const json = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });

  /**
   * @param {Request} request
   * @param {{ waitUntil?: (p: Promise<unknown>) => void }} [ctx]
   */
  return async function handle(request, ctx = {}) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/api/health') return json(200, { ok: true, source: source.name });

    if (url.pathname !== '/api/tv/visitors') return json(404, { error: 'not found' });
    if (request.method !== 'GET') return json(405, { error: 'method not allowed' });

    if (readToken && request.headers.get('authorization') !== `Bearer ${readToken}`) {
      return json(401, { error: 'unauthorized' });
    }

    const now = new Date();
    const sinceParam = url.searchParams.get('since');
    const sinceMs = sinceParam ? Date.parse(sinceParam) : NaN;
    if (sinceParam && Number.isNaN(sinceMs)) return json(400, { error: 'since must be an ISO date' });
    const since = new Date(Number.isNaN(sinceMs) ? now.getTime() - DEFAULT_LOOKBACK_MIN * 60_000 : sinceMs).toISOString();
    const limitParam = Number(url.searchParams.get('limit') ?? 10);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(limitParam) ? Math.floor(limitParam) : 10));

    try {
      const { visitors, warming } = await source.visitors(since, limit);
      // Warm new visitors' renditions without making the TV wait. On providers that stop the
      // function after the response, the adapter must pass waitUntil (Workers, Vercel).
      const done = warming.catch((e) => log({ type: 'warm-error', error: String(e) }));
      if (ctx.waitUntil) ctx.waitUntil(done);
      log({ type: 'visitors', since, limit, returned: visitors.length });
      return json(200, { now: now.toISOString(), visitors });
    } catch (e) {
      log({ type: 'error', error: String(e) });
      // Never leak details to the TV; it falls back to Maya on any non-200.
      return json(502, { error: 'upstream failed' });
    }
  };
}
