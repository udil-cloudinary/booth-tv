// Build-time config (VITE_*, see .env.example) plus the dev switches in the page URL.
const q = new URLSearchParams(location.search);
const env = import.meta.env;

function num(name: string, fallback: number): number {
  const v = q.get(name);
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const mockParam = q.get('mock');
const searchUrl: string = env.VITE_SEARCH_URL || '';

export const config = {
  // mock (assets/mock) or search (the signed search URL); ?mock=1 / ?mock=0 override VITE_PROVIDER.
  provider: (mockParam === null ? (env.VITE_PROVIDER || 'mock') : mockParam === '0' ? 'search' : 'mock') as 'mock' | 'search',
  searchUrl,
  logUrl: env.VITE_LOG_URL || '',

  flow: (q.has('new-flow') ? 'factory' : 'classic') as 'classic' | 'factory', // ?new-flow: the factory flow (src/factory)
  route: q.get('route'), // with ?new-flow: shopify, contentful, agent, klaviyo or claude for every visitor

  // Dev switches
  scene: q.get('scene')?.toUpperCase() || null, // ?scene=B4 plays one scene on repeat
  hold: q.has('hold'), // with ?scene: play once and freeze on the last frame (for review)
  visitor: q.get('v'), // with ?scene=L3: which mock visitor (id or index), default Maya
  speed: num('speed', 1), // ?speed=0.5 slows everything down
  hud: q.has('hud'), // ?hud opens the debug HUD at start (else press H)
  reloadMin: q.has('reloadMin') ? num('reloadMin', 120) : null, // override the 2-hour watchdog
  forget: q.has('forget'), // ?forget: clear the list of visitors already shown, so everyone in the window counts as new

  // Mock provider switches
  rush: num('rush', 0), // ?rush=10: 10 extra mock visitors arrive about 20 s after load
  broken: q.has('broken'), // ?broken: adds one visitor whose images fail (tests the 4 s skip)
  novisitors: q.has('novisitors'), // ?novisitors: nobody new, Part 2 runs with Maya
};
