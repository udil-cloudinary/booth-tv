import { config } from '../config';

/**
 * Who has already been on screen, by visitor id, with when they were last shown. Kept in localStorage
 * (one list per provider), so a reload does not count them as new again. If storage is unavailable it
 * works in memory only: after a reload everyone in the window counts as new once more.
 */
export class ShownStore {
  private at = new Map<string, number>();
  private readonly key: string;

  constructor(providerName: string, private windowMs: number) {
    this.key = `booth-tv:shown:${providerName}`;
    try {
      if (config.forget) localStorage.removeItem(this.key);
      const saved = JSON.parse(localStorage.getItem(this.key) ?? '{}') as Record<string, number>;
      for (const [id, t] of Object.entries(saved)) if (typeof t === 'number') this.at.set(id, t);
    } catch {
      // private window, blocked storage or bad JSON: start empty
    }
  }

  has(id: string) {
    return this.at.has(id);
  }

  /** When this visitor was last on screen (ms), 0 if never. */
  lastShown(id: string) {
    return this.at.get(id) ?? 0;
  }

  mark(id: string) {
    const now = Date.now();
    this.at.set(id, now);
    for (const [k, t] of this.at) if (now - t > this.windowMs) this.at.delete(k);
    try {
      localStorage.setItem(this.key, JSON.stringify(Object.fromEntries(this.at)));
    } catch {
      // keep going in memory
    }
  }
}
