import { log } from './log';
import { status } from './status';

/** Watchdog (spec section 10): reload every 2 hours, only at the end of a Part 2, and only if the page is reachable. */
export async function maybeReload(reloadAfterMs: number) {
  if (Date.now() - status.startedAt < reloadAfterMs) return;
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
