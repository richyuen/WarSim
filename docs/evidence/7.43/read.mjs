/* global process, console */
import { readFileSync } from 'node:fs';
for (const f of process.argv.slice(2)) {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  const o0 = j.samples[0].owned;
  let worst = -1e9, worstNoArmy = -1e9;
  const line = j.samples.map((s) => `${s.day}:${s.held}/${s.men}${s.overlord ? '' : '*'}`).join(' ');
  for (const s of j.samples) { const ex = s.held - o0; worst = Math.max(worst, ex); if (s.men === 0) worstNoArmy = Math.max(worstNoArmy, ex); }
  console.log(f, 'owned1938', o0, 'max excess', worst, 'max excess with 0 men', worstNoArmy, 'living end', j.samples.at(-1).living);
  console.log(' ', line);
}
