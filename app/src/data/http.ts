import { config } from '../config';
import type { VisitorsResponse } from '../types';
import { isUsable, type DataProvider } from './provider';

/** The booth backend: GET /api/tv/visitors?since=<ISO>&limit=10. Any failure throws; the loop falls back to Maya. */
export class HttpProvider implements DataProvider {
  readonly name = 'http';

  constructor(private timeoutSec: number) {}

  async visitors(since: string, limit: number): Promise<VisitorsResponse> {
    const url = `${config.apiBase}/api/tv/visitors?since=${encodeURIComponent(since)}&limit=${limit}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutSec * 1000);
    try {
      const headers: Record<string, string> = config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : {};
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store', headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as Partial<VisitorsResponse>;
      const visitors = Array.isArray(body.visitors) ? body.visitors.filter(isUsable) : [];
      return { now: body.now ?? new Date().toISOString(), visitors };
    } finally {
      clearTimeout(timer);
    }
  }
}
