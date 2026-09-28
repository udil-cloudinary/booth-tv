import type { SceneScript } from '../types';
import { PART1 } from './part1';
import { PART2 } from './part2';

const HTML: Record<string, string> = { ...PART1, ...PART2 };

// Step scripts and captions are data (timeline/scenes/*.json), bundled so the TV never needs the network for them.
const files = import.meta.glob<SceneScript>('../../timeline/scenes/*.json', { eager: true, import: 'default' });
export const SCRIPTS: Record<string, SceneScript> = {};
for (const s of Object.values(files)) SCRIPTS[s.id] = s;

export function renderScene(id: string): string {
  const html = HTML[id];
  if (!html) throw new Error(`No scene ${id}`);
  return html;
}
