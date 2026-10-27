// Critic run 16: hours in a year with any carrier strike in the air (carrierStrikes), and sea-battle hours with a carrier
// fleet in the record, from a save, for <days> days. Usage: npx tsx critic/scripts/c16_cvworld.ts <seed> <in.bin> <days> <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { carrierStrikes } from '../../src/sim/systems/navalCombat';
import { loadAssets1938 } from '../../tools/headless/assets';
const [seedS, inF, daysS, outF] = process.argv.slice(2);
const sim = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(size1938(undefined).w) });
sim.load(new Uint8Array(readFileSync(inF!)));
const w = sim.world;
let strikeH = 0, strikes = 0;
for (let h = 0; h < Number(daysS) * 24; h++) {
  sim.step(1, () => { w.out.events.length = 0; w.out.fires.length = 0; });
  const cs = carrierStrikes(w); if (cs.length) { strikeH++; strikes += cs.length; }
}
const res = { seed: Number(seedS), bin: inF, days: Number(daysS), strikeH, strikeWingHours: strikes };
console.log(JSON.stringify(res));
writeFileSync(outF!, JSON.stringify(res));
