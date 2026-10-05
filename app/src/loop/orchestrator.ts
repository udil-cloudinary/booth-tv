import loopJson from '../../timeline/loop.json';
import { config } from '../config';
import { MAYA, type DataProvider } from '../data/provider';
import { visitorVars } from '../engine/fill';
import { SCRIPTS } from '../scenes';
import type { Stage } from '../stage';
import type { LoopConfig, LoopEntry, Part, Visitor } from '../types';
import { counters, log } from './log';
import { preload, release } from './preload';
import { ShownStore } from './shown';

export const LOOP = loopJson as unknown as LoopConfig;

/** What the debug HUD shows. */
export const status = {
  part: '' as Part | '',
  scene: '',
  who: '',
  window: '',
  queue: [] as { name: string; at: string; fails: number }[],
  replay: [] as string[],
  catchUp: false,
  lastFetch: '',
  lastFetchResult: '',
  startedAt: Date.now(),
  reloadAt: 0,
};

/** Visitors per fetch: the whole window, latest upload per email (the search URL returns the newest max_results). */
const FETCH_LIMIT = 500;

/**
 * The loop: Part 1 with Maya (polling for visitors every 10 s), then Part 2 for up to 2 visitors (5 in
 * short form while catching up). Visitors not shown yet go first, oldest first; the slots left are filled
 * from the most recent 15 of the last 24 h, longest-unseen first, so the loop always shows real visitors.
 * Maya only when nobody uploaded in the window. Any failure falls back to Maya; the loop never stops.
 */
export class Loop {
  private recent: Visitor[] = []; // everyone in the window, latest upload per email, oldest first
  private shown: ShownStore; // who has been on screen (survives a reload)
  private fails = new Map<string, number>();
  private dropped = new Set<string>();
  private catchUp = false;
  private fetching: Promise<void> | null = null;
  private readonly reloadAfterMs: number;
  private readonly windowMs = LOOP.windowHours * 3_600_000;

  constructor(private stage: Stage, private provider: DataProvider) {
    this.shown = new ShownStore(provider.name, this.windowMs);
    this.reloadAfterMs = (config.reloadMin ?? LOOP.reloadEveryMin) * 60_000;
    status.reloadAt = status.startedAt + this.reloadAfterMs;
    stage.onWarn = (m) => log('warn', { msg: m });
  }

  async run(): Promise<never> {
    // Poll all the time, so a new upload joins the lineup within seconds (the search URL's TTL is the real limit).
    const poll = () => { if (!this.fetching) this.fetching = this.fetch(); };
    poll();
    setInterval(poll, LOOP.pollSec * 1000);
    for (;;) {
      try {
        await this.cycle();
      } catch (e) {
        counters.errors++;
        log('error', { where: 'cycle', msg: String(e) });
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  private async cycle() {
    counters.cycles++;
    log('cycle', { n: counters.cycles, waiting: this.fresh().length });
    // Warm up whoever is next while Part 1 plays (about 50 s).
    this.lineup().slice(0, 2).forEach((v) => void preload(v, LOOP.preloadTimeoutSec));

    const op = LOOP.opener;
    if (op && SCRIPTS[op.scene] && (counters.cycles - 1) % Math.max(1, op.every) === 0) {
      status.part = 'part1';
      status.scene = op.scene;
      await this.stage.play(SCRIPTS[op.scene], op.dur, visitorVars(MAYA), { part: 'part1', index: 0, count: LOOP.part1.length, who: MAYA.first_name });
    }
    await this.playPart('part1', LOOP.part1, MAYA);
    if (this.fetching) await this.fetching;

    const played = await this.playBatch();
    if (played === 0) {
      counters.maya++;
      await this.playPart('part2', LOOP.part2, MAYA);
    }
    await this.maybeReload();
  }

  private async playPart(part: Part, entries: LoopEntry[], who: Visitor) {
    const vars = visitorVars(who);
    for (let i = 0; i < entries.length; i++) {
      const { scene, dur } = entries[i];
      const script = SCRIPTS[scene];
      if (!script) {
        log('warn', { msg: `no script for ${scene}` });
        continue;
      }
      status.part = part;
      status.scene = scene;
      status.who = vars.name;
      if (part === 'part1' && scene === LOOP.fetchAt && !this.fetching) this.fetching = this.fetch();
      await this.stage.play(script, dur, vars, { part, index: i, count: entries.length, who: vars.name });
    }
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

  /** Plays Part 2 for the next visitors in the lineup. Returns how many were actually shown. */
  private async playBatch(): Promise<number> {
    const waiting = this.fresh().length;
    if (!this.catchUp && waiting > LOOP.catchUp.enterAbove) this.catchUp = true;
    else if (this.catchUp && waiting < LOOP.catchUp.exitBelow) this.catchUp = false;
    status.catchUp = this.catchUp;

    const max = this.catchUp ? LOOP.catchUp.batch : LOOP.batch;
    const entries = this.catchUp
      ? LOOP.part2.filter((e) => LOOP.part2Short.includes(e.scene))
      : LOOP.part2;

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
      await this.playPart('part2', entries, v);
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
      this.lineup().slice(0, 2).forEach((v) => void preload(v, LOOP.preloadTimeoutSec));
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
  }

  /** Watchdog (spec section 10): reload every 2 hours, only at the end of a Part 2, and only if the page is reachable. */
  private async maybeReload() {
    if (Date.now() - status.startedAt < this.reloadAfterMs) return;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(location.href, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      log('warn', { msg: `reload postponed, page not reachable: ${e}` });
      return;
    }
    log('reload', { uptimeMin: Math.round((Date.now() - status.startedAt) / 60_000) });
    location.reload();
    await new Promise(() => {}); // the page is going away; do not start another cycle
  }
}

/** ?scene=B4: one scene on repeat (Maya, or ?v=<mock id or index> for Part 2 scenes). */
export async function repeatScene(stage: Stage, id: string, who: Visitor) {
  const script = SCRIPTS[id];
  const opener = LOOP.opener ? [{ scene: LOOP.opener.scene, dur: LOOP.opener.dur }] : [];
  const entry = [...opener, ...LOOP.part1, ...LOOP.part2].find((e) => e.scene === id);
  if (!script || !entry) throw new Error(`Unknown scene ${id}`);
  const part: Part = id.startsWith('L') ? 'part2' : 'part1';
  const list = part === 'part1' ? LOOP.part1 : LOOP.part2;
  const vars = visitorVars(who);
  status.part = part;
  status.scene = id;
  status.who = vars.name;
  await preload(who, 10);
  for (;;) {
    await stage.play(script, entry.dur, vars, { part, index: list.indexOf(entry), count: list.length, who: vars.name });
    if (config.hold) return new Promise<never>(() => {});
    await new Promise((r) => setTimeout(r, 600));
  }
}
