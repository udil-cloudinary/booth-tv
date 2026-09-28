import { config } from '../config';

// Every duration on the TV goes through here, so ?speed scales the whole show.
export const speed = config.speed;

/** Script seconds to real milliseconds. */
export const ms = (seconds: number) => (seconds * 1000) / speed;

export const sleep = (seconds: number) => new Promise<void>((r) => setTimeout(r, ms(seconds)));

/** Runs onFrame(p) with p going 0..1 over `seconds` (script time), on animation frames. */
export function tween(seconds: number, onFrame: (p: number) => void): Promise<void> {
  const total = ms(seconds);
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = total <= 0 ? 1 : Math.min(1, (now - start) / total);
      onFrame(p);
      if (p < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

export const EASE = 'cubic-bezier(.45,.05,.25,1)';
export const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';
export const EASE_BACK = 'cubic-bezier(.34,1.56,.64,1)';
