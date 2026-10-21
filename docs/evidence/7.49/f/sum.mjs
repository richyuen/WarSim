// PLAN 7.49f: of the nations watched by islandArmies.ts (60 days of each of the 48 saves), those on
// `send` 30 days or more with none boarded (the AT's figure), and those at `atPort` so, and the
// formations boarded and landed. Usage: node docs/evidence/7.49/f/sum.mjs <dir> (d: HEAD before, f: after)
/* global console, process */
import { readFileSync } from 'node:fs';
const dir = process.argv[2] ?? 'docs/evidence/7.49/f';
for (const y of [10, 20]) {
  const j = JSON.parse(readFileSync(`${dir}/island_y${y}.json`, 'utf8'));
  let boarded = 0;
  let landed = 0;
  const send = [];
  const atPort = [];
  for (const r of j.rows) {
    for (const x of r.nations ?? []) {
      boarded += x.boarded;
      landed += x.landed;
      if ((x.gates.send ?? 0) >= 30 && x.boarded === 0) send.push(`${r.seed} ${x.nation} (${x.gates.send} d, ${x.island0} island)`);
      if ((x.gates.atPort ?? 0) >= 30 && x.boarded === 0) atPort.push(`${r.seed} ${x.nation} (${x.gates.atPort} d, ${x.island0} island)`);
    }
  }
  console.log(`year ${y}: island ${j.firstPct} % -> ${j.lastPct} %; boarded ${boarded}, landed ${landed}; on send 30+ d with none boarded ${send.length}: ${send.join(', ')}; at atPort 30+ d with none boarded ${atPort.length}: ${atPort.join(', ')}`);
}
