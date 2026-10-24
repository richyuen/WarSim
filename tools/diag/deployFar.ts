/**
 * PLAN 7.102: `formationFight1938`'s world (seed 4242, Germany declares war on Poland, 21 days), read
 * only: the formations in contact whose block stands furthest from the block of the enemy it faces,
 * as the panel measures it (`fight.span`, worker/server.ts), with each one's place, its enemy's,
 * whether the two are each other's nearest, and the blocks of the others that come to that enemy.
 *
 * Usage: npx tsx tools/diag/deployFar.ts [seed] [days] [top]
 */
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { contactsOf, deployOf, elementIndex, slotCount, wrapDx } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../../tests/helpers/earth';
import { nationId } from '../../tests/helpers/sim1938';

const seed = Number(process.argv[2] ?? 4242);
const days = Number(process.argv[3] ?? 21);
const top = Number(process.argv[4] ?? 8);
const W = SIZE_1938.w;
/** Kilometres a cell (the view's 19,570 m at the 1938 size). */
const KM = 19.57;
const s = new Sim({ scenario: '1938', seed, assets: assets1938(W) });
s.command({ kind: 'declareWar', attacker: nationId('GER'), defender: nationId('POL') });
s.step(24 * days, (w) => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
});
const w: World = s.world;
const fc = w.formations.cols;
const tag = (f: number): string => TAGS_1938[fc.nation[f]! - 1] ?? String(fc.nation[f]);
const block = (f: number): { x: number; y: number; facing: number } => {
  const d = deployOf(w, f, slotCount(w, f, elementIndex(w).get(f)?.length ?? 0));
  return d ?? { x: fc.x[f]!, y: fc.y[f]!, facing: fc.facing[f]! };
};
const contacts = contactsOf(w);
const rows: { f: number; enemy: number; km: number; sx: number; sy: number }[] = [];
w.formations.forEach((f) => {
  if (fc.engaged[f] !== 1) return;
  const enemy = contacts.get(f);
  if (enemy === undefined || !w.formations.has(enemy)) return;
  const a = block(f);
  const b = block(enemy);
  const sx = Math.abs(wrapDx(w, a.x, b.x));
  const sy = Math.abs(b.y - a.y);
  rows.push({ f, enemy, km: Math.hypot(sx, sy) * KM, sx, sy });
});
rows.sort((p, q) => q.km - p.km);
console.log(`seed ${seed}, day ${days}: ${rows.length} formations in contact; tick ${w.tick}`);
for (const r of rows.slice(0, top)) {
  const a = block(r.f);
  const b = block(r.enemy);
  const comers = [...contacts].filter(([g, e]) => e === r.enemy && g !== r.f).map(([g]) => g);
  console.log(
    `${r.f} ${tag(r.f)} t${fc.template[r.f]} place (${fc.x[r.f]!.toFixed(2)},${fc.y[r.f]!.toFixed(2)}) block (${a.x.toFixed(2)},${a.y.toFixed(2)}) | enemy ${r.enemy} ${tag(r.enemy)} place (${fc.x[r.enemy]!.toFixed(2)},${fc.y[r.enemy]!.toFixed(2)}) block (${b.x.toFixed(2)},${b.y.toFixed(2)}) faces ${contacts.get(r.enemy)} | ${r.km.toFixed(1)} km span ${r.sx.toFixed(2)}x${r.sy.toFixed(2)} | others on that enemy: ${comers.map((g) => `${g}(${block(g).x.toFixed(2)},${block(g).y.toFixed(2)})`).join(' ')}`,
  );
}
