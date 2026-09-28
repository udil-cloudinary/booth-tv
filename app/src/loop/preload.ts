import type { Visitor } from '../types';

// Keeps decoded images of the visitors we are about to show, so no scene waits on the network.
const held = new Map<string, HTMLImageElement[]>();
const pending = new Map<string, Promise<boolean>>();

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => img.decode().then(() => resolve(img), () => resolve(img));
    img.onerror = () => reject(new Error(`image failed: ${url}`));
    img.src = url;
  });
}

/**
 * Loads all of a visitor's images. Resolves true when every one is ready, false if any fails or
 * the lot is not ready within `timeoutSec` (spec: skip anyone whose images fail within 4 s).
 * Calls for the same visitor share one attempt; a failed attempt is forgotten so a later cycle can retry.
 */
export function preload(v: Visitor, timeoutSec: number): Promise<boolean> {
  const existing = pending.get(v.id);
  if (existing) return existing;
  const urls = Object.values(v.urls);
  const all = Promise.all(urls.map(load)).then(
    (imgs) => { held.set(v.id, imgs); return true; },
    () => false,
  );
  const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), timeoutSec * 1000));
  const p = Promise.race([all, timeout]).then((ok) => {
    if (!ok) pending.delete(v.id);
    return ok;
  });
  pending.set(v.id, p);
  return p;
}

/** Lets go of a visitor's images once they have been on screen. */
export function release(id: string) {
  held.delete(id);
  pending.delete(id);
}
