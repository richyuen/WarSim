/**
 * PLAN 7.104a: one nation's plans over some days from a saved state (`OP_PROBE.sectors`): per plan
 * its sectors (all, threatened, with a formation, attacking), the threatened ones in full (centre,
 * threat, formations, strength, attack, in range), and the marches from afar (`empty`).
 *
 * Usage: npx tsx tools/diag/planOf.ts <seed> <state.bin> <nation tag or #id> [days = 10]
 */
import { readFileSync } from 'node:fs';
import { OP_PROBE, type SectorsSeen } from '../../src/sim/ai/operational';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const who = process.argv[4]!;
const days = Number(process.argv[5] ?? 10);
const N = who.startsWith('#') ? Number(who.slice(1)) : TAGS_1938.indexOf(who) + 1;
const plans: SectorsSeen[] = [];
OP_PROBE.sectors = (p) => {
  if (p.nation === N) plans.push(p);
};
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(process.argv[3]!)));
for (let d = 0; d < days; d++)
  s.step(24, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
for (const p of plans) {
  const S = p.sectors;
  const hot = S.filter((x) => x.threat > 0);
  console.log(`day ${Math.floor(p.tick / 24)}: sectors ${S.length}, threatened ${hot.length}, manned ${S.filter((x) => x.n > 0).length}, attacking ${S.filter((x) => x.attack).length}, empty ${JSON.stringify({ ...p.empty, classes: undefined })}`);
  for (const h of hot) console.log(`   hot (${h.cx.toFixed(0)},${h.cy.toFixed(0)}) threat ${h.threat} n ${h.n} strength ${h.strength} attack ${h.attack} inRange ${h.inRange}`);
}
