// Where visitors come from. The handler only needs `visitors(since, limit)`.
import { searchVisitors } from './cloudinary.mjs';
import { selectVisitors } from './visitors.mjs';
import { warmVisitors } from './warm.mjs';

/** The booth cloud: Search API, then the response rules, then warm new visitors. */
export function cloudinarySource({ cloud, key, secret, seen, fetchImpl = fetch, log = () => {} }) {
  return {
    name: 'cloudinary',
    async visitors(since, limit) {
      const resources = await searchVisitors({ cloud, key, secret, since, fetchImpl });
      const { visitors, skipped } = selectVisitors(resources, { cloud, since, limit });
      if (skipped.length) log({ type: 'skipped', count: skipped.length, sample: skipped.slice(0, 3) });
      // Returned for the caller to wait on (Node) or hand to waitUntil (Workers, Vercel).
      const warming = warmVisitors(visitors, { seen, fetchImpl, log });
      return { visitors, warming };
    },
  };
}

/**
 * --mock: assets/mock/visitors.json as if people were doing the wizard now (same schedule as the
 * TV's own mock): two waiting at start, two arriving over the next minutes, plus `rush` extra
 * about 20 s after start. Image URLs stay relative (assets/mock/...), so they load from the TV's origin.
 */
export function mockSource({ data, rush = 0, startedAt = Date.now() }) {
  const at = (sec) => new Date(startedAt + sec * 1000).toISOString();
  const base = data.visitors;
  const schedule = [-240, -120, 70, 150];
  const all = base.map((v, i) => ({ ...v, created_at: at(schedule[i] ?? 200 + i * 60) }));
  for (let i = 0; i < rush; i++) {
    const v = base[i % base.length];
    all.push({ ...v, id: `${v.id}-rush${i + 1}`, email: `rush${i + 1}.${v.email}`, created_at: at(20 + i) });
  }
  all.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    name: 'mock',
    async visitors(since, limit) {
      const now = new Date().toISOString();
      const visitors = all.filter((v) => v.created_at > since && v.created_at <= now).slice(0, limit);
      return { visitors, warming: Promise.resolve(0) };
    },
  };
}
