// The only place that talks to the Cloudinary Admin API. Uses plain fetch, so it runs on
// Node, Cloudflare Workers, Lambda and Vercel alike.

/** cloudinary://<api_key>:<api_secret>@<cloud_name> -> { cloud, key, secret } */
export function parseCloudinaryUrl(url) {
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/.exec(url ?? '');
  if (!m) throw new Error('CLOUDINARY_URL must look like cloudinary://<api_key>:<api_secret>@<cloud_name>');
  return { key: decodeURIComponent(m[1]), secret: decodeURIComponent(m[2]), cloud: m[3] };
}

/**
 * The Search API expression. The date window is coarse on purpose (whole days, which the Search
 * API documents as a relative unit); the exact `created_at > since` cut is done in code, as are
 * `tv_status` and `face_detected`, so the query does not depend on how those fields are typed.
 */
export function searchExpression(since, now = Date.now()) {
  const days = Math.max(1, Math.ceil((now - Date.parse(since)) / 86_400_000) + 1);
  return `resource_type:image AND tags=booth-visitor AND created_at>${days}d`;
}

/**
 * Every booth visitor upload since `since`, oldest first. Pages through the results (the TV asks
 * with a cursor that moves forward, so this is usually one page).
 */
export async function searchVisitors({ cloud, key, secret, since, fetchImpl = fetch, maxPages = 5 }) {
  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/resources/search`;
  const auth = `Basic ${btoa(`${key}:${secret}`)}`;
  const resources = [];
  let cursor;
  for (let page = 0; page < maxPages; page++) {
    const body = {
      expression: searchExpression(since),
      sort_by: [{ created_at: 'asc' }],
      max_results: 100,
      with_field: ['metadata', 'context', 'tags'],
      ...(cursor ? { next_cursor: cursor } : {}),
    };
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Cloudinary search failed: HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    resources.push(...(json.resources ?? []));
    cursor = json.next_cursor;
    if (!cursor) break;
  }
  return resources;
}
