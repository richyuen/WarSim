/**
 * PLAN 7.91: `deploy.test.ts`'s day-60 world (seed 99, Germany declares war on Poland, 60 days), read
 * only: each formation in contact whose block and its nearest enemy's do not share a view at 20 m/px
 * (half or more of each side's elements in the view centred between the two), with both formations'
 * places, templates, element counts and how many are seen, the blocks' middles and distance, and the
 * day either landed from the sea (`FormationLanded`), if it did. The test's own measure, printed.
 *
 * Usage: npx tsx tools/diag/deployView.ts
 */
import { EventKind } from '../../src/shared/events';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { contactsOf, deployOf, elementIndex, elementPlace, slotCount } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../../tests/helpers/earth';
import { nationId } from '../../tests/helpers/sim1938';
const W = SIZE_1938.w;
const VIEW = { w: (1400 * 20) / 19_570, h: (800 * 20) / 19_570 };
const places = (w: World, f: number): [number, number][] => {
  const list = elementIndex(w).get(f) ?? [];
  const slots = slotCount(w, f, list.length);
  return list.map((e) => elementPlace(w, f, w.elements.cols.slot[e]!, slots, e));
};
const mean = (ps: [number, number][]): [number, number] => [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length];
const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
s.command({ kind: 'declareWar', attacker: nationId('GER'), defender: nationId('POL') });
const landed = new Map<number, number>();
s.step(24 * 60, (w) => {
  const e = w.out.events;
  for (let i = 0; i < e.length; i += 6) if (e[i + 1] === EventKind.FormationLanded) landed.set(e[i + 2]!, e[i]! / 24);
  e.length = 0;
  w.out.fires.length = 0;
});
const w = s.world;
const fc = w.formations.cols;
let engaged = 0;
let both = 0;
const tag = (f: number): string => TAGS_1938[fc.nation[f]! - 1] ?? String(fc.nation[f]);
w.formations.forEach((f) => {
  if (fc.engaged[f] !== 1 || !elementIndex(w).has(f)) return;
  const enemy = contactsOf(w).get(f);
  if (enemy === undefined) return;
  engaged++;
  const a = places(w, f);
  const b = places(w, enemy);
  const [ma, mb] = [mean(a), mean(b)];
  const cx = (ma[0] + mb[0]) / 2;
  const cy = (ma[1] + mb[1]) / 2;
  const seen = (ps: [number, number][]): number => ps.filter((p) => Math.abs(p[0] - cx) < VIEW.w / 2 - 0.05 && Math.abs(p[1] - cy) < VIEW.h / 2 - 0.05).length;
  const ok = seen(a) * 2 >= a.length && seen(b) * 2 >= b.length;
  if (ok) both++;
  else {
    const d = deployOf(w, f, slotCount(w, f, a.length));
    console.log(`FAIL ${f} ${tag(f)} t${fc.template[f]} at (${fc.x[f]!.toFixed(2)},${fc.y[f]!.toFixed(2)}) els ${a.length} seen ${seen(a)} | enemy ${enemy} ${tag(enemy)} t${fc.template[enemy]} at (${fc.x[enemy]!.toFixed(2)},${fc.y[enemy]!.toFixed(2)}) els ${b.length} seen ${seen(b)} | means (${ma[0].toFixed(2)},${ma[1].toFixed(2)}) (${mb[0].toFixed(2)},${mb[1].toFixed(2)}) dist ${Math.hypot(ma[0] - mb[0], ma[1] - mb[1]).toFixed(2)} deploy ${d ? 'yes' : 'no'} landed ${landed.get(f) ?? '-'}/${landed.get(enemy) ?? '-'}`);
  }
});
console.log(`engaged ${engaged} both ${both}; view ${VIEW.w.toFixed(2)}x${VIEW.h.toFixed(2)} cells`);
