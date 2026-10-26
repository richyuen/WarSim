/**
 * PLAN 7.121: why the AI's wings at war sit out of range late. From a saved state, each day at 01:00
 * (an hour after `airAi`), every wing of a living AI nation at war whose role rebases (`roleOf`: patrol,
 * front, naval) and that has no mission is put in one bucket:
 * - `inRange`: an enemy land formation within its range of its base all the same (a mission not given);
 * - `hop`: an airbase of its side with room within a ferry flight (FERRY_RANGE ranges) of its base and
 *   nearer the enemy land formation nearest its base than its base is (`toward` would have one with that goal);
 * - `chain`: no such hop, but a chain of ferry flights over bases of its side with room reaches a base with
 *   an enemy land formation in range (the greedy hop is stuck);
 * - `island`: no chain of its side's bases reaches one in range of the enemy's land forces;
 * - `noEnemy`: the enemy has no land formation on land.
 * Also per bucket the wing-days that moved base since the day before, and per nation the stuck wing-days.
 *
 * Usage: npx tsx tools/diag/airStuck.ts <seed> <state.bin | -> [days = 120]  (`-`: from 1938)
 */
import { readFileSync } from 'node:fs';
import { roleOf } from '../../src/sim/ai/air';
import { airbaseRoom } from '../../src/sim/data/airbases';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { basePlace, FERRY_RANGE, kmFromBase, ofSide, wingAircraft, wingRange } from '../../src/sim/systems/air';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const src = process.argv[3]!;
const days = Number(process.argv[4] ?? 120);
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
if (src !== '-') s.load(new Uint8Array(readFileSync(src)));
const w = s.world;
const c = w.formations.cols;
const nc = w.nations.cols;
const tag = (n: number): string => ((nc.origin[n] ?? 0) === 0 ? (TAGS_1938[n - 1] ?? `#${n}`) : `f${n}`);
const B = { inRange: 0, hop: 0, chain: 0, island: 0, noEnemy: 0 };
const moved = { inRange: 0, hop: 0, chain: 0, island: 0, noEnemy: 0 };
const byNation: Record<string, number> = {};
let rebasing = 0;
let tasked = 0;
let lastBase = new Map<number, number>();
const step = (h: number): void =>
  s.step(h, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
step(1);
for (let d = 0; d < days; d++) {
  step(24);
  const atWar = w.wars.nations();
  const land: number[] = [];
  w.formations.forEach((g) => {
    if (!w.isFleet(g) && !w.isWing(g) && !w.embarked.has(g) && !w.offLand(g)) land.push(g);
  });
  const used = new Map<number, number>();
  for (const [o, b] of w.wingBase) if (b > 0 && w.formations.has(o)) used.set(b, (used.get(b) ?? 0) + wingAircraft(w, c.template[o]!));
  const now = new Map<number, number>();
  for (const [id, base] of [...w.wingBase].sort((a, b) => a[0] - b[0])) {
    now.set(id, base);
    const n = c.nation[id]!;
    if (!atWar.has(n) || nc.living[n] !== 1 || nc.aiOff[n] === 1 || base <= 0) continue;
    const role = roleOf(w, id);
    if (role !== 'patrol' && role !== 'front' && role !== 'naval') continue;
    rebasing++;
    if (w.wingMission.has(id)) {
      tasked++;
      continue;
    }
    const at = basePlace(w, base);
    if (!at) continue;
    const range = wingRange(w, id);
    const enemy = land.filter((g) => w.wars.atWar(n, c.nation[g]!));
    let k: keyof typeof B;
    if (enemy.length === 0) k = 'noEnemy';
    else if (enemy.some((g) => kmFromBase(w, id, c.x[g]!, c.y[g]!) <= range)) k = 'inRange';
    else {
      let goal = -1;
      let gd = Infinity;
      for (const g of enemy) {
        const x = seaKm(w, at[0], at[1], c.x[g]!, c.y[g]!);
        if (x < gd) [goal, gd] = [g, x];
      }
      const need = wingAircraft(w, c.template[id]!);
      const ferry = FERRY_RANGE * range;
      const side: { i: number; x: number; y: number; free: boolean }[] = [];
      w.airbases.forEach((b, i) => {
        if (!ofSide(w, n, w.cells.controller[b.cell]!)) return;
        const [x, y] = w.cellPoint(b.cell);
        side.push({ i: i + 1, x, y, free: i + 1 === base || (used.get(i + 1) ?? 0) + need <= airbaseRoom(b) });
      });
      const hop = side.some((b) => b.i !== base && b.free && seaKm(w, at[0], at[1], b.x, b.y) <= ferry && seaKm(w, b.x, b.y, c.x[goal]!, c.y[goal]!) < gd);
      if (hop) k = 'hop';
      else {
        // A chain of ferry flights over free bases of the side, from its base.
        const seen = new Set<number>([base]);
        const queue: [number, number][] = [[at[0], at[1]]];
        let reach = false;
        while (queue.length > 0 && !reach) {
          const [x, y] = queue.pop()!;
          for (const b of side) {
            if (seen.has(b.i) || !b.free || seaKm(w, x, y, b.x, b.y) > ferry) continue;
            seen.add(b.i);
            if (enemy.some((g) => seaKm(w, b.x, b.y, c.x[g]!, c.y[g]!) <= range)) {
              reach = true;
              break;
            }
            queue.push([b.x, b.y]);
          }
        }
        k = reach ? 'chain' : 'island';
      }
    }
    B[k]++;
    if (lastBase.has(id) && lastBase.get(id) !== base) moved[k]++;
    if (k === 'chain' || k === 'hop') byNation[tag(n)] = (byNation[tag(n)] ?? 0) + 1;
  }
  lastBase = now;
}
const top = Object.entries(byNation).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', ');
console.log(`seed ${seed} ${src}, ${days} days: wing-days of rebasing roles at war ${rebasing}, with a mission ${tasked}`);
console.log(`  none: ${Object.entries(B).map(([k, v]) => `${k} ${v} (moved ${moved[k as keyof typeof B]})`).join(', ')}`);
console.log(`  hop or chain by nation: ${top}`);
console.log('done:');
