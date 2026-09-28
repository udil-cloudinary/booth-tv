import loopJson from '../../timeline/loop.json';
import { config } from '../config';
import { MAYA, type DataProvider } from '../data/provider';
import { visitorVars } from '../engine/fill';
import { SCRIPTS } from '../scenes';
import type { Stage } from '../stage';
import type { LoopConfig, LoopEntry, Part, Visitor } from '../types';
import { counters, log } from './log';
import { preload, release } from './preload';

export const LOOP = loopJson as unknown as LoopConfig;

/** What the debug HUD shows. */
export const status = {
  part: '' as Part | '',
  scene: '',
  who: '',
  cursor: '',
  queue: [] as { name: string; at: string; fails: number }[],
  catchUp: false,
  lastFetch: '',
  lastFetchResult: '',
  startedAt: Date.now(),
  reloadAt: 0,
};

/**
 * The loop (spec section 2): Part 1 with Maya, fetch at the Publish moment (B9), then Part 2 for
 * up to 2 new visitors oldest first (5 in short form while catching up), or Maya when nobody is new.
 * Any failure (network, images, a scene) falls back to Maya; the loop itself never stops.
 */
export class Loop {
  private cursor: string; // created_at of the last visitor shown
  private pending: Visitor[] = []; // fetched, not yet shown, oldest first
  private fails = new Map<string, number>();
  private dropped = new Set<string>();
  private catchUp = false;
  private fetching: Promise<void> | null = null;
  private readonly reloadAfterMs: number;

  constructor(private stage: Stage, private provider: DataProvider) {
    this.cursor = new Date(Date.now() - LOOP.cursorLookbackMin * 60_000).toISOString();
    this.reloadAfterMs = (config.reloadMin ?? LOOP.reloadEveryMin) * 60_000;
    status.reloadAt = status.startedAt + this.reloadAfterMs;
    status.cursor = this.cursor;
    stage.onWarn = (m) => log('warn', { msg: m });
  }

  async run(): Promise<never> {
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
    log('cycle', { n: counters.cycles, waiting: this.pending.length });
    // Warm up whoever is already known while Part 1 plays (about 50 s).
    this.pending.slice(0, 2).forEach((v) => void preload(v, LOOP.preloadTimeoutSec));

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
      if (part === 'part1' && scene === LOOP.fetchAt) this.fetching = this.fetch();
      await this.stage.play(script, dur, vars, { part, index: i, count: entries.length, who: vars.name });
    }
  }

  /** Plays Part 2 for the next visitors in line. Returns how many were actually shown. */
  private async playBatch(): Promise<number> {
    const waiting = this.pending.length;
    if (!this.catchUp && waiting > LOOP.catchUp.enterAbove) this.catchUp = true;
    else if (this.catchUp && waiting < LOOP.catchUp.exitBelow) this.catchUp = false;
    status.catchUp = this.catchUp;

    const max = this.catchUp ? LOOP.catchUp.batch : LOOP.batch;
    const entries = this.catchUp
      ? LOOP.part2.filter((e) => LOOP.part2Short.includes(e.scene))
      : LOOP.part2;

    let shown = 0;
    const skippedNow = new Set<string>();
    for (;;) {
      const line = this.pending.filter((p) => !skippedNow.has(p.id));
      const v = line[0];
      if (!v || shown >= max) break;
      // Start the one after this one now, so it is ready when its turn comes.
      if (line[1]) void preload(line[1], LOOP.preloadTimeoutSec);
      const ok = await preload(v, LOOP.preloadTimeoutSec);
      this.pending = this.pending.filter((p) => p !== v);
      if (!ok) {
        skippedNow.add(v.id);
        this.skip(v);
        continue;
      }
      await this.playPart('part2', entries, v);
      shown++;
      counters.shown++;
      log('shown', { id: v.id, name: v.first_name, form: this.catchUp ? 'short' : 'full' });
      if (v.created_at > this.cursor) this.cursor = v.created_at;
      status.cursor = this.cursor;
      release(v.id);
      this.updateQueue();
    }
    return shown;
  }

  /** A visitor whose images did not load in time: retried once next cycle, then dropped. */
  private skip(v: Visitor) {
    const n = (this.fails.get(v.id) ?? 0) + 1;
    this.fails.set(v.id, n);
    counters.skipped++;
    log('skipped', { id: v.id, name: v.first_name, attempt: n });
    if (n >= 2) {
      this.dropped.add(v.id);
      if (v.created_at > this.cursor) this.cursor = v.created_at;
    } else {
      this.pending.push(v); // back of the line
    }
    this.updateQueue();
  }

  private async fetch() {
    status.lastFetch = new Date().toLocaleTimeString();
    counters.fetches++;
    try {
      const res = await this.provider.visitors(this.cursor, 10);
      this.merge(res.visitors);
      status.lastFetchResult = `${res.visitors.length} new, ${this.pending.length} waiting`;
      log('fetch', { since: this.cursor, got: res.visitors.length, waiting: this.pending.length });
      this.pending.slice(0, 2).forEach((v) => void preload(v, LOOP.preloadTimeoutSec));
    } catch (e) {
      counters.fetchErrors++;
      status.lastFetchResult = `failed: ${String(e).slice(0, 60)}`;
      log('fetch-error', { msg: String(e) });
    } finally {
      this.fetching = null;
    }
  }

  /** New arrivals join the line oldest first; a newer upload from the same email replaces the older one. */
  private merge(incoming: Visitor[]) {
    for (const v of incoming) {
      if (this.dropped.has(v.id) || v.created_at <= this.cursor) continue;
      const i = this.pending.findIndex((p) => p.id === v.id || (!!v.email && p.email === v.email));
      if (i >= 0) {
        if (v.created_at >= this.pending[i].created_at) this.pending[i] = v;
      } else {
        this.pending.push(v);
      }
    }
    this.pending.sort((a, b) => a.created_at.localeCompare(b.created_at));
    this.updateQueue();
  }

  private updateQueue() {
    status.queue = this.pending.map((v) => ({
      name: v.first_name,
      at: new Date(v.created_at).toLocaleTimeString(),
      fails: this.fails.get(v.id) ?? 0,
    }));
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
  const entry = [...LOOP.part1, ...LOOP.part2].find((e) => e.scene === id);
  if (!script || !entry) throw new Error(`Unknown scene ${id}`);
  const part: Part = id.startsWith('B') ? 'part1' : 'part2';
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
