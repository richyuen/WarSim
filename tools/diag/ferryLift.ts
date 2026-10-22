/**
 * PLAN 7.88b: the ferry's lift. From a saved state, daily for `days` days, over the living nations
 * at war: their transport groups (fleets with transport room) at sea (moving), their land
 * formations aboard (`world.embarked`), and their island garrisons (land formations standing on a
 * landmass with no front cell of their nation's: a cell of its beside an enemy's). The means of the
 * daily counts, the world's and one nation's (`tag`). Read only.
 *
 * Usage: npx tsx tools/diag/ferryLift.ts <out.json> <days> <seed:state.bin:TAG> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { frontierOf } from '../../src/sim/systems/territory';
import { navOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const result: unknown[] = [];
for (const arg of process.argv.slice(4)) {
  const [seedS, bin, tag] = arg.split(':');
  const seed = Number(seedS);
  const one = TAGS_1938.indexOf(tag!) + 1;
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(bin!)));
  const w = s.world;
  const { w: W, h: H, controller } = w.cells;
  const comp = navOf(w).grid.component;
  const c = w.formations.cols;
  const sum = { atSea: 0, aboard: 0, island: 0 };
  const mine = { atSea: 0, aboard: 0, island: 0 };
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  const nb: number[] = [];
  for (let d = 0; d < days; d++) {
    s.step(24, quiet);
    const atWar = new Set(w.wars.nations());
    // The landmasses with a front cell of each nation at war.
    const fronted = new Map<number, Set<number>>();
    for (const k of frontierOf(w)) {
      const a = controller[k]!;
      if (!atWar.has(a)) continue;
      if (neighbours4(k, W, H, w.settings.loopingMap, nb).some((q) => controller[q] !== 0 && controller[q] !== a && w.wars.atWar(a, controller[q]!))) {
        (fronted.get(a) ?? fronted.set(a, new Set()).get(a)!).add(comp[k]!);
      }
    }
    w.formations.forEach((id) => {
      const n = c.nation[id]!;
      if (!atWar.has(n) || w.nations.cols.living[n] !== 1) return;
      const add = (key: 'atSea' | 'aboard' | 'island'): void => {
        sum[key]++;
        if (n === one) mine[key]++;
      };
      if (w.isFleet(id)) {
        if (c.moving[id] === 1 && transportRoom(w, id) > 0) add('atSea');
        return;
      }
      if (w.isWing(id)) return;
      if (w.embarked.has(id)) return add('aboard');
      if (w.offLand(id)) return;
      const l = comp[Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!)]!;
      if (l !== 0 && !fronted.get(n)?.has(l)) add('island');
    });
  }
  const mean = (o: typeof sum): Record<string, number> => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round((v / days) * 10) / 10]));
  const row = { seed, bin, tag, days, world: mean(sum), nation: mean(mine) };
  console.log(JSON.stringify(row));
  result.push(row);
}
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`done: ${result.length} saves -> ${out}`);
