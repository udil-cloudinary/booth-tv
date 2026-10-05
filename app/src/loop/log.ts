import { config } from '../config';

// "N people saw themselves on the TV" (spec section 10): one log endpoint, plus counters for the HUD.
export interface LogEvent {
  t: string;
  type: 'boot' | 'cycle' | 'shown' | 'skipped' | 'fetch' | 'fetch-error' | 'error' | 'reload' | 'warn' | 'search-skipped';
  [k: string]: unknown;
}

export const counters = { cycles: 0, shown: 0, maya: 0, skipped: 0, errors: 0, fetches: 0, fetchErrors: 0 };
export const recent: LogEvent[] = [];
let buffer: LogEvent[] = [];

export function log(type: LogEvent['type'], data: Record<string, unknown> = {}) {
  const e: LogEvent = { t: new Date().toISOString(), type, ...data };
  recent.unshift(e);
  recent.length = Math.min(recent.length, 12);
  if (type === 'error' || type === 'warn' || type === 'fetch-error') console.warn('[tv]', e);
  else console.info('[tv]', type, JSON.stringify(data));
  if (config.logUrl) buffer.push(e);
}

function flush() {
  if (!config.logUrl || buffer.length === 0) return;
  const body = buffer.map((e) => JSON.stringify(e)).join('\n');
  buffer = [];
  try {
    navigator.sendBeacon(config.logUrl, new Blob([body], { type: 'application/x-ndjson' }));
  } catch {
    /* logging never breaks the show */
  }
}
setInterval(flush, 30_000);
addEventListener('pagehide', flush);
