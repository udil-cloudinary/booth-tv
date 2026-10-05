import loopJson from '../../timeline/loop.json';
import type { DataProvider } from '../data/provider';
import type { LoopConfig, Visitor } from '../types';
import { counters, log } from './log';
import { preload, release } from './preload';
import { ShownStore } from './shown';
import { status } from './status';

export const LOOP = loopJson as unknown as LoopConfig;

/** Visitors per fetch: the whole window, latest upload per email (the search URL returns the newest max_results). */
const FETCH_LIMIT = 500;

export interface QueueItem {
  visitor: Visitor;
  isNew: boolean;
}

/**
 * Who Part 2 shows, shared by both flows. Polls every 10 s; visitors not shown yet go first, oldest first;
 * the slots left are filled from the most recent 15 of the last 24 h, longest-unseen first, so the loop
 * always shows real visitors. Catch-up mode (short form, 5 a batch) while many are waiting.
 */
export class Lineup {
  private recent: Visitor[] = []; // everyone in the window, latest upload per email, oldest first
  private shown: ShownStore; // who has been on screen (survives a reload)
  private fails = new Map<string, number>();
  private dropped = new Set<string>();
  private catchUp = false;
  private fetching: Promise<void> | null = null;
  private current: Visitor | null = null; // on screen right now
  private readonly windowMs = LOOP.windowHours * 3_600_000;
  /** Called whenever the lineup changes (fetch, shown, skipped, a new visitor on screen). */
  onChange: () => void = () => {};

  constructor(private provider: DataProvider) {
    this.shown = new ShownStore(provider.name, this.windowMs);
  }

  /** Poll all the time, so a new upload joins the lineup within seconds (the search URL's TTL is the real limit). */
  startPolling() {
    this.fetchNow();
    setInterval(() => this.fetchNow(), LOOP.pollSec * 1000);
  }

  /** Starts a fetch unless one is already running. */
  fetchNow() {
    if (!this.fetching) this.fetching = this.fetch();
  }

  /** Waits for a fetch in flight, if any. */
  async settle() {
    if (this.fetching) await this.fetching;
  }

  /** Warms up the next visitors while something else plays. */
  preloadNext(n = 2) {
    this.lineup().slice(0, n).forEach((v) => void preload(v, LOOP.preloadTimeoutSec));
  }

  /** Who waits after the visitor on screen, in order, for the factory's queue. */
  queue(): QueueItem[] {
    return this.lineup()
      .filter((v) => v.id !== this.current?.id)
      .map((v) => ({ visitor: v, isNew: !this.shown.has(v.id) }));
  }

  get waiting() {
    return this.fresh().length;
  }

  /** In the window and never on screen yet, oldest first. */
  private fresh() {
    return this.recent.filter((v) => !this.shown.has(v.id) && !this.dropped.has(v.id));
  }

  /** Already shown and among the most recent `replayLast`, the one unseen longest first. */
  private replay() {
    return this.recent
      .filter((v) => !this.dropped.has(v.id))
      .slice(-LOOP.replayLast)
      .filter((v) => this.shown.has(v.id))
      .sort((a, b) => this.shown.lastShown(a.id) - this.shown.lastShown(b.id) || a.created_at.localeCompare(b.created_at));
  }

  /** Who Part 2 would show next, in order: new visitors, then replays. */
  private lineup() {
    return [...this.fresh(), ...this.replay()];
  }

  /**
   * Plays the next batch: up to 2 visitors (5 in short form while catching up), each through `play`.
   * Returns how many were actually shown.
   */
  async playBatch(play: (v: Visitor, o: { short: boolean; index: number }) => Promise<void>): Promise<number> {
    const waiting = this.fresh().length;
    if (!this.catchUp && waiting > LOOP.catchUp.enterAbove) this.catchUp = true;
    else if (this.catchUp && waiting < LOOP.catchUp.exitBelow) this.catchUp = false;
    status.catchUp = this.catchUp;
    const max = this.catchUp ? LOOP.catchUp.batch : LOOP.batch;

    let shown = 0;
    const tried = new Set<string>(); // shown or skipped in this batch
    while (shown < max) {
      // Re-read the lineup for every slot, so someone who uploads during Part 2 can still make this batch.
      const line = this.lineup().filter((p) => !tried.has(p.id));
      const v = line[0];
      if (!v) break;
      tried.add(v.id);
      // Start the one after this one now, so it is ready when its turn comes.
      if (line[1]) void preload(line[1], LOOP.preloadTimeoutSec);
      if (!(await preload(v, LOOP.preloadTimeoutSec))) {
        this.skip(v);
        continue;
      }
      const replay = this.shown.has(v.id);
      this.current = v;
      this.updateQueue();
      try {
        await play(v, { short: this.catchUp, index: shown });
      } finally {
        this.current = null;
      }
      shown++;
      counters.shown++;
      log('shown', { id: v.id, name: v.first_name, form: this.catchUp ? 'short' : 'full', replay });
      this.shown.mark(v.id);
      release(v.id);
      this.updateQueue();
    }
    return shown;
  }

  /** A visitor whose images did not load in time: retried next cycle, then dropped. */
  private skip(v: Visitor) {
    const n = (this.fails.get(v.id) ?? 0) + 1;
    this.fails.set(v.id, n);
    counters.skipped++;
    log('skipped', { id: v.id, name: v.first_name, attempt: n });
    if (n >= 2) this.dropped.add(v.id);
    this.updateQueue();
  }

  private async fetch() {
    status.lastFetch = new Date().toLocaleTimeString();
    counters.fetches++;
    const since = new Date(Date.now() - this.windowMs).toISOString();
    try {
      const res = await this.provider.visitors(since, FETCH_LIMIT);
      const before = this.recent.map((v) => v.id).join();
      this.merge(res.visitors);
      status.lastFetchResult = `${this.recent.length} in the window, ${this.fresh().length} new`;
      // Polling every few seconds: log only when the window changed, so the HUD and the log endpoint stay readable.
      if (this.recent.map((v) => v.id).join() !== before) log('fetch', { since, got: res.visitors.length, fresh: this.fresh().length });
      this.preloadNext();
    } catch (e) {
      counters.fetchErrors++;
      status.lastFetchResult = `failed: ${String(e).slice(0, 60)}`;
      log('fetch-error', { msg: String(e) });
    } finally {
      this.fetching = null;
    }
  }

  /** Each fetch returns the whole window, so it replaces the list: hidden or expired visitors leave it. Latest upload per email wins. */
  private merge(incoming: Visitor[]) {
    const byKey = new Map<string, Visitor>();
    for (const v of incoming) {
      const key = v.email || v.id;
      const prev = byKey.get(key);
      if (!prev || v.created_at > prev.created_at) byKey.set(key, v);
    }
    this.recent = [...byKey.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    this.updateQueue();
  }

  private updateQueue() {
    status.window = `${this.recent.length} visitors in the last ${LOOP.windowHours} h`;
    status.queue = this.fresh().map((v) => ({
      name: v.first_name,
      at: new Date(v.created_at).toLocaleTimeString(),
      fails: this.fails.get(v.id) ?? 0,
    }));
    status.replay = this.replay().map((v) => v.first_name);
    this.onChange();
  }
}
