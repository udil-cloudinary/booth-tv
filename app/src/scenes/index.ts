import type { SceneScript } from '../types';
import { PART1 } from './part1';
import { PART2 } from './part2';

// The opener is its own page (assets/opening/opener.html, still being designed), embedded as is so its
// edits show up on the TV with no copy. It starts its animation when the frame loads, so every play starts at 0. ?fit=7 plays its 19.6 s story in 7 s.
const OPENER = `<iframe class="opener" src="assets/opening/opener.html?fit=7" title="Cloudinary Everywhere" tabindex="-1" aria-hidden="true"></iframe>`;

const HTML: Record<string, string> = { OP: OPENER, ...PART1, ...PART2 };

// Step scripts and captions are data (timeline/scenes/*.json), bundled so the TV never needs the network for them.
const files = import.meta.glob<SceneScript>('../../timeline/scenes/*.json', { eager: true, import: 'default' });
export const SCRIPTS: Record<string, SceneScript> = {};
for (const s of Object.values(files)) SCRIPTS[s.id] = s;

export function renderScene(id: string): string {
  const html = HTML[id];
  if (!html) throw new Error(`No scene ${id}`);
  return html;
}
