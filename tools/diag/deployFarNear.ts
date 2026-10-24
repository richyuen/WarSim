/**
 * PLAN 7.102: in `deployFar.ts`'s world, every block within `r` cells of formation `f`'s line from its
 * place to the block of the enemy it faces: nation, the formation's place, its block, whom it faces.
 *
 * Usage: npx tsx tools/diag/deployFarNear.ts <f> [seed] [days] [r]
 */
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { slotGrid } from '../../src/sim/core/pose';
import { contactsOf, deployOf, elementIndex, slotCount } from '../../src/sim/systems/elements';
import { assets1938 } from '../../tests/helpers/earth';
import { nationId } from '../../tests/helpers/sim1938';

const f = Number(process.argv[2]);
const seed = Number(process.argv[3] ?? 4242);
const days = Number(process.argv[4] ?? 21);
const r = Number(process.argv[5] ?? 0.5);
const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
s.command({ kind: 'declareWar', attacker: nationId('GER'), defender: nationId('POL') });
s.step(24 * days, (w) => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
});
const w = s.world;
const fc = w.formations.cols;
const tag = (g: number): string => TAGS_1938[fc.nation[g]! - 1] ?? String(fc.nation[g]);
const slots = (g: number): number => slotCount(w, g, elementIndex(w).get(g)?.length ?? 0);
const block = (g: number) => deployOf(w, g, slots(g)) ?? { x: fc.x[g]!, y: fc.y[g]!, facing: fc.facing[g]! };
const contacts = contactsOf(w);
const enemy = contacts.get(f)!;
const a = { x: fc.x[f]!, y: fc.y[f]! };
const b = block(enemy);
const dx = b.x - a.x;
const dy = b.y - a.y;
const L = Math.hypot(dx, dy);
console.log(`${f} ${tag(f)} place (${a.x.toFixed(2)},${a.y.toFixed(2)}) block (${block(f).x.toFixed(2)},${block(f).y.toFixed(2)}) grid ${JSON.stringify(slotGrid(slots(f)))}; to ${enemy}'s block ${L.toFixed(2)} cells`);
w.formations.forEach((g) => {
  if (g === f) return;
  const p = block(g);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (L * L);
  const off = ((p.x - a.x) * dy - (p.y - a.y) * dx) / L;
  if (t < -0.2 || t > 1.2 || Math.abs(off) > r) return;
  console.log(`  ${g} ${tag(g)} t${fc.template[g]} engaged ${fc.engaged[g]} faces ${contacts.get(g) ?? '-'} place (${fc.x[g]!.toFixed(2)},${fc.y[g]!.toFixed(2)}) block (${p.x.toFixed(2)},${p.y.toFixed(2)}) facing ${p.facing.toFixed(2)} along ${(t * L).toFixed(2)} across ${off.toFixed(2)} grid ${JSON.stringify(slotGrid(slots(g)))} atWar ${w.wars.atWar(fc.nation[f]!, fc.nation[g]!)}`);
});
if (process.env['LAND'] !== undefined) {
  // `side room` pairs: the forward points k = 0..8 of each, as deployOf walks them.
  const [side, room] = process.env['LAND'].split(' ').map(Number) as [number, number];
  const t = block(enemy);
  const ux = (t.x - a.x) / Math.hypot(t.x - a.x, t.y - a.y);
  const uy = (t.y - a.y) / Math.hypot(t.x - a.x, t.y - a.y);
  const shift = Math.min(Math.sqrt(1.5 * 1.5 - side * side), room);
  const marks: string[] = [];
  for (let k = 0; k <= 8; k++) marks.push(w.onLand(a.x + (ux * shift * k) / 8 - uy * side, a.y + (uy * shift * k) / 8 + ux * side) ? 'L' : '.');
  console.log(`side ${side} shift ${shift.toFixed(3)} k0..8 ${marks.join('')}`);
}
