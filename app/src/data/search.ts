import { log } from '../loop/log';
import type { VisitorsResponse } from '../types';
import { isUsable, type DataProvider } from './provider';
import { selectVisitors, type SearchResource } from './visitors';

/**
 * Reads the booth cloud straight from a signed Cloudinary search URL (scripts/sign-search-url.mjs):
 * no backend, no secret on the TV. Cloudinary caches the result for the URL's TTL (10 s with the script's default), and the
 * `since` cut, latest-per-email and oldest-first order are done here. Any failure throws; the loop falls back to Maya.
 */
export class SearchProvider implements DataProvider {
  readonly name = 'search';
  private cloud: string;

  constructor(private url: string, private timeoutSec: number) {
    this.cloud = new URL(url).pathname.split('/')[1]; // https://res.cloudinary.com/<cloud>/search/...
  }

  async visitors(since: string, limit: number): Promise<VisitorsResponse> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutSec * 1000);
    try {
      const res = await fetch(this.url, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.headers.get('x-cld-error') ?? ''}`.trim());
      const body = (await res.json()) as { resources?: SearchResource[] };
      const resources = Array.isArray(body.resources) ? body.resources : [];
      const { visitors, skipped } = selectVisitors(resources, { cloud: this.cloud, since, limit });
      if (skipped.length) log('search-skipped', { skipped });
      return { now: new Date().toISOString(), visitors: visitors.filter(isUsable) };
    } finally {
      clearTimeout(timer);
    }
  }
}
