// Fails the build if the timeline breaks the spec: Part 1 over 40 s, Part 2 over 26 s, a scene without a script,
// or a step that starts after its scene has ended. Run by `npm run build` and `npm run check`.
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../timeline/', import.meta.url);
const loop = JSON.parse(readFileSync(new URL('loop.json', dir)));
const scripts = Object.fromEntries(
  readdirSync(new URL('scenes/', dir)).filter((f) => f.endsWith('.json'))
    .map((f) => { const s = JSON.parse(readFileSync(new URL(`scenes/${f}`, dir))); return [s.id, s]; }),
);
const errors = [];
const HOLD_SEC = 1.2;
const sum = (entries) => entries.reduce((t, e) => t + e.dur, 0);

const max = loop.part1MaxSec ?? 40;
const part1 = sum(loop.part1);
if (part1 > max) errors.push(`Part 1 is ${part1} s, the spec allows ${max} s max`);
const max2 = loop.part2MaxSec ?? 26;
const part2 = sum(loop.part2);
if (part2 > max2) errors.push(`Part 2 is ${part2} s per visitor, the spec allows ${max2} s max`);
if (!loop.part1.some((e) => e.scene === loop.fetchAt)) errors.push(`fetchAt ${loop.fetchAt} is not a Part 1 scene`);
for (const s of loop.part2Short) if (!loop.part2.some((e) => e.scene === s)) errors.push(`short form scene ${s} is not in Part 2`);

for (const { scene, dur } of [...loop.part1, ...loop.part2]) {
  const s = scripts[scene];
  if (!s) { errors.push(`${scene}: no timeline/scenes/${scene}.json`); continue; }
  for (const st of s.steps) if (st.at >= dur) errors.push(`${scene}: step "${st.do} ${st.target ?? ''}" at ${st.at} s starts after the scene ends (${dur} s)`);
  // Settle, act, hold: the last step starts at least HOLD_SEC before the scene ends, so the result stays on screen.
  const last = Math.max(...s.steps.map((st) => st.at));
  if (dur - last < HOLD_SEC) errors.push(`${scene}: last step at ${last} s leaves ${(dur - last).toFixed(1)} s to read the result (min ${HOLD_SEC} s)`);
  if (/[\u2013\u2014]/.test(JSON.stringify(s))) errors.push(`${scene}: contains an en or em dash`);
}

if (errors.length) {
  console.error('Timeline check failed:\n  ' + errors.join('\n  '));
  process.exit(1);
}
console.log(`Timeline OK: Part 1 ${part1} s (max ${max}), Part 2 ${part2} s (max ${max2}), short form ${loop.part2Short.join(' ')}`);
