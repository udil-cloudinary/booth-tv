import { config } from '../config';
import { counters, recent } from '../loop/log';
import { status } from '../loop/orchestrator';

/** Hidden debug HUD: press H (or open with ?hud). Outside the stage, so it never ends up on the TV by accident. */
export function installHud(providerName: string) {
  const el = document.createElement('pre');
  el.className = 'hud';
  el.hidden = !config.hud;
  document.body.appendChild(el);
  addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') el.hidden = !el.hidden;
  });

  const mins = (ms: number) => `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  const render = () => {
    if (el.hidden) return;
    const now = Date.now();
    el.textContent = [
      `BOOTH TV  provider=${providerName}  speed=${config.speed}${config.scene ? `  repeat=${config.scene}` : ''}`,
      `scene     ${status.part} ${status.scene}  (${status.who})`,
      `window    ${status.window}`,
      `catch-up  ${status.catchUp ? 'ON (short form)' : 'off'}`,
      `fetch     ${status.lastFetch || '-'}  ${status.lastFetchResult}`,
      `new       ${status.queue.length ? status.queue.map((q) => `${q.name} ${q.at}${q.fails ? ` (failed ${q.fails})` : ''}`).join(', ') : '(none)'}`,
      `replay    ${status.replay.length ? status.replay.join(', ') : status.queue.length ? '(none)' : '(none, Maya)'}`,
      `counts    cycles ${counters.cycles}  shown ${counters.shown}  maya ${counters.maya}  skipped ${counters.skipped}  errors ${counters.errors}  fetch errors ${counters.fetchErrors}`,
      `uptime    ${mins(now - status.startedAt)}   reload in ${mins(Math.max(0, status.reloadAt - now))} (at the end of a Part 2)`,
      `online    ${navigator.onLine}`,
      '',
      ...recent.slice(0, 8).map((e) => `${e.t.slice(11, 19)} ${e.type} ${JSON.stringify({ ...e, t: undefined, type: undefined })}`),
    ].join('\n');
  };
  setInterval(render, 500);
}
