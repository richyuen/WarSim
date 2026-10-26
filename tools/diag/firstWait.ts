/**
 * PLAN 7.5 (check:review before critic run 15): the first formation of each seed whose march from afar
 * is refused and waits (`World.farWait`, ADR-703), day by day from 1938. `farWait1938.test.ts` reads one.
 *
 * Usage: npx tsx tools/diag/firstWait.ts <seed> [seed ...]
 */
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../../tests/helpers/earth';
for (const seed of process.argv.slice(2).map(Number)) {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
  let found = '';
  for (let d = 0; d < 400 && !found; d++) {
    s.step(24, (w) => {
      w.out.events.length = 0;
      w.out.fires.length = 0;
    });
    for (const [k, u] of s.world.farWait) {
      found = `day ${d + 1}: formation ${k} until ${u}`;
      break;
    }
  }
  console.log(`seed ${seed}: ${found || 'none in 400 days'}`);
}
console.log('done:');
