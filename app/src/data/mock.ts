import data from '../../../assets/mock/visitors.json';
import { config } from '../config';
import type { Visitor, VisitorsResponse } from '../types';
import type { DataProvider } from './provider';

/**
 * Serves assets/mock/visitors.json as if people were doing the wizard right now:
 * two are already waiting at load, two arrive during the first minutes.
 * ?rush=10 adds 10 more about 20 s after load (catch-up mode), ?broken adds one whose
 * images 404 (the 4 s skip), ?novisitors serves nobody (Part 2 with Maya).
 */
export class MockProvider implements DataProvider {
  readonly name = 'mock';
  private all: Visitor[] = [];

  constructor() {
    const t0 = Date.now();
    const base = (data as { visitors: Visitor[] }).visitors;
    const at = (offsetSec: number) => new Date(t0 + offsetSec * 1000).toISOString();
    if (config.novisitors) return;

    const schedule = [-240, -120, 70, 150];
    base.forEach((v, i) => this.all.push({ ...v, created_at: at(schedule[i] ?? 200 + i * 60) }));

    if (config.broken) {
      const v = base[0];
      this.all.push({
        ...v, id: 'broken-image-test', first_name: 'Broken', email: 'broken.test@cloudinary.com', created_at: at(-180),
        urls: { ...v.urls, hero: 'assets/mock/does-not-exist/hero.png' },
      });
    }
    for (let i = 0; i < config.rush; i++) {
      const v = base[i % base.length];
      this.all.push({ ...v, id: `${v.id}-rush${i + 1}`, email: `rush${i + 1}.${v.email}`, created_at: at(20 + i) });
    }
    this.all.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async visitors(since: string, limit: number): Promise<VisitorsResponse> {
    await new Promise((r) => setTimeout(r, 120));
    const now = new Date().toISOString();
    const visitors = this.all.filter((v) => v.created_at > since && v.created_at <= now).slice(0, limit);
    return { now, visitors };
  }
}
