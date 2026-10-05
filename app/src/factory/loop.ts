import { config } from '../config';
import { MAYA, type DataProvider } from '../data/provider';
import { LOOP, Lineup } from '../loop/lineup';
import { counters, log } from '../loop/log';
import { status } from '../loop/status';
import { maybeReload } from '../loop/watchdog';
import type { FactoryStage } from './stage';

/**
 * The factory flow's loop (the default flow): the opener, then visitors through the factory, picked by the same Lineup
 * as the classic flow (new first, then replays of the latest 15). Catch-up: the Figma and plugin beats once per
 * loop, then the short form. Maya runs the factory only when nobody uploaded in the window.
 */
export class FactoryLoop {
  private lineup: Lineup;
  private readonly reloadAfterMs: number;

  constructor(private stage: FactoryStage, provider: DataProvider) {
    this.lineup = new Lineup(provider);
    this.lineup.onChange = () => stage.setQueue(this.lineup.queue());
    this.reloadAfterMs = (config.reloadMin ?? LOOP.reloadEveryMin) * 60_000;
    status.reloadAt = status.startedAt + this.reloadAfterMs;
  }

  async run(): Promise<never> {
    this.stage.setQueue([]);
    this.lineup.startPolling();
    for (;;) {
      try {
        await this.cycle();
      } catch (e) {
        counters.errors++;
        log('error', { where: 'factory cycle', msg: String(e) });
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  private async cycle() {
    counters.cycles++;
    log('cycle', { n: counters.cycles, waiting: this.lineup.waiting });
    this.lineup.preloadNext();

    const op = LOOP.opener;
    if (op && (counters.cycles - 1) % Math.max(1, op.every) === 0) await this.stage.opener(op.dur);
    await this.lineup.settle();

    let figmaDone = false;
    const played = await this.lineup.playBatch(async (v, o) => {
      await this.stage.run(v, { short: o.short, figma: !o.short || !figmaDone });
      figmaDone = true;
    });
    if (played === 0) {
      counters.maya++;
      await this.stage.run(MAYA, { short: false, figma: true });
    }
    await maybeReload(this.reloadAfterMs);
  }
}
