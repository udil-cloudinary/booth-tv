// Renditions are built on the template images, not eagerly on upload (spec section 6), so the
// first request of each visitor URL makes Cloudinary render it. We make that first request, once
// per visitor, so the TV never waits on a cold rendition.

/** Remembers who has been warmed. In-memory here; a provider KV can implement the same two methods. */
export class MemorySeenStore {
  #seen = new Map(); // id -> time first seen
  #max;
  constructor(max = 5000) {
    this.#max = max;
  }
  async has(id) {
    return this.#seen.has(id);
  }
  async add(id) {
    this.#seen.set(id, Date.now());
    if (this.#seen.size > this.#max) this.#seen.delete(this.#seen.keys().next().value);
  }
}

/** GETs every URL of every visitor not seen before. Never throws: warming is best effort. */
export async function warmVisitors(visitors, { seen, fetchImpl = fetch, log = () => {} }) {
  const fresh = [];
  for (const v of visitors) {
    if (await seen.has(v.id)) continue;
    await seen.add(v.id);
    fresh.push(v);
  }
  await Promise.all(
    fresh.flatMap((v) =>
      Object.entries(v.urls).map(async ([name, url]) => {
        try {
          const res = await fetchImpl(url);
          await res.arrayBuffer().catch(() => {});
          if (!res.ok) log({ type: 'warm-failed', id: v.id, name, status: res.status, error: res.headers.get('x-cld-error') });
        } catch (e) {
          log({ type: 'warm-failed', id: v.id, name, error: String(e) });
        }
      }),
    ),
  );
  return fresh.length;
}
