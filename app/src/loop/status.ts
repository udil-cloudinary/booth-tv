import type { Part } from '../types';

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
