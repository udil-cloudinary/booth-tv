import { config } from '../config';
import { MAYA, type DataProvider } from '../data/provider';
import { visitorVars } from '../engine/fill';
import { SCRIPTS } from '../scenes';
import type { Stage } from '../stage';
import type { LoopEntry, Part, Visitor } from '../types';
import { LOOP, Lineup } from './lineup';
import { counters, log } from './log';
import { preload } from './preload';
import { status } from './status';
import { maybeReload } from './watchdog';

export { LOOP } from './lineup';
export { status } from './status';

/**
 * The classic loop: Part 1 with Maya, then Part 2 for up to 2 visitors (5 in short form while catching up),
 * picked by the shared Lineup (new visitors first, then replays of the most recent 15). Maya only when nobody
 * uploaded in the window. Any failure falls back to Maya; the loop never stops.
 */
export class Loop {
  private lineup: Lineup;
  private readonly reloadAfterMs: number;

  constructor(private stage: Stage, provider: DataProvider) {
    this.lineup = new Lineup(provider);
    this.reloadAfterMs = (config.reloadMin ?? LOOP.reloadEveryMin) * 60_000;
    status.reloadAt = status.startedAt + this.reloadAfterMs;
    stage.onWarn = (m) => log('warn', { msg: m });
  }

  async run(): Promise<never> {
    this.lineup.startPolling();
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
    log('cycle', { n: counters.cycles, waiting: this.lineup.waiting });
    // Warm up whoever is next while Part 1 plays (about 50 s).
    this.lineup.preloadNext();

    const op = LOOP.opener;
    if (op && SCRIPTS[op.scene] && (counters.cycles - 1) % Math.max(1, op.every) === 0) {
      status.part = 'part1';
      status.scene = op.scene;
      await this.stage.play(SCRIPTS[op.scene], op.dur, visitorVars(MAYA), { part: 'part1', index: 0, count: LOOP.part1.length, who: MAYA.first_name });
    }
    await this.playPart('part1', LOOP.part1, MAYA);
    await this.lineup.settle();

    const short = LOOP.part2.filter((e) => LOOP.part2Short.includes(e.scene));
    const played = await this.lineup.playBatch((v, o) => this.playPart('part2', o.short ? short : LOOP.part2, v));
    if (played === 0) {
      counters.maya++;
      await this.playPart('part2', LOOP.part2, MAYA);
    }
    await maybeReload(this.reloadAfterMs);
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
      if (part === 'part1' && scene === LOOP.fetchAt) this.lineup.fetchNow();
      await this.stage.play(script, dur, vars, { part, index: i, count: entries.length, who: vars.name });
    }
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
