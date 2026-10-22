/**
 * PLAN 7.69's measure: landings on an enemy capital's land with no port of its nation. From each
 * saved state, at its start, the cases: per war, each living nation `e` of a side whose capital
 * (`capitalCell`) stands on a coast (a cell beside it of a sea zone: the rule's reach) of a landmass (`navOf(world).grid.component`) where `e` holds (controls)
 * no port, while a nation of the other side has transport room afloat (`transportRoom`, any group
 * of its own) and no land front with `e`'s side in that war (no cell it controls beside a cell
 * controlled by a nation of that side). Then, for `days` days, every `FormationLanded` of a nation
 * of the other side on that landmass, read after its hour: `landed` the cases with one, the first
 * day and who. One case per (save, capital): the first war that makes it.
 *
 * Usage: npx tsx tools/diag/capitalLandings.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { capitalCell } from '../../src/sim/systems/capitals';
import { navOf, portSeaOf, seaOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, src] = a.split(':');
  return { seed: Number(seed), src: src! };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;

type Case = { seed: number; capital: string; cell: number; land: number; landCells: number; attackers: string[]; landed: boolean; day: number; by: string };
const all: Case[] = [];
for (const { seed, src } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(src)));
  const world = s.world;
  const { w, h, controller } = world.cells;
  const comp = navOf(world).grid.component;
  const water = portSeaOf(world);
  const nc = world.nations.cols;
  const z = seaOf(world);
  // Transport room afloat, per nation.
  const room = new Map<number, number>();
  world.formations.forEach((id) => {
    if (!world.isFleet(id)) return;
    const r = transportRoom(world, id);
    if (r > 0) room.set(world.formations.cols.nation[id]!, (room.get(world.formations.cols.nation[id]!) ?? 0) + r);
  });
  const nb: number[] = [];
  const fronted = (a: number, side: readonly number[]): boolean => {
    const set = new Set(side);
    for (let c = 0; c < controller.length; c++) {
      if (controller[c] !== a) continue;
      for (const q of neighbours4(c, w, h, world.settings.loopingMap, nb)) if (set.has(controller[q]!)) return true;
    }
    return false;
  };
  const mine: Case[] = [];
  const seen = new Set<number>();
  const sides = new Map<number, number[]>();
  for (const war of world.wars.list) {
    for (let i = 0; i < 2; i++) {
      const side = war.sides[i]!;
      const other = war.sides[1 - i]!;
      for (const e of side) {
        if (seen.has(e) || nc.living[e] !== 1) continue;
        const cell = capitalCell(world, e);
        const land = comp[cell] ?? 0;
        if (land === 0) continue;
        if (!neighbours4(cell, w, h, world.settings.loopingMap, nb).some((q) => z.zoneOf[q] !== 0)) continue;
        if (world.ports.some((p, k) => water[k]! >= 0 && controller[p.cell] === e && comp[p.cell] === land)) continue;
        const attackers = other.filter((n) => nc.living[n] === 1 && (room.get(n) ?? 0) > 0 && !fronted(n, side));
        if (attackers.length === 0) continue;
        seen.add(e);
        let landCells = 0;
        for (let c = 0; c < comp.length; c++) if (comp[c] === land) landCells++;
        mine.push({ seed, capital: tag(e), cell, land, landCells, attackers: attackers.map(tag), landed: false, day: 0, by: '' });
        sides.set(mine.length - 1, other.slice());
      }
    }
  }
  let day = 0;
  const read = (wd: World): void => {
    const ev = wd.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 1] !== EventKind.FormationLanded) continue;
      const n = ev[i + 3]!;
      const at = Math.floor(ev[i + 5]!) * w + Math.floor(ev[i + 4]!);
      const land = comp[at];
      mine.forEach((k, j) => {
        if (k.landed || k.land !== land || !sides.get(j)!.includes(n)) return;
        [k.landed, k.day, k.by] = [true, day, tag(n)];
      });
    }
    ev.length = 0;
    wd.out.fires.length = 0;
  };
  for (day = 1; day <= days; day++) s.step(24, read);
  all.push(...mine);
  console.log(`${seed} ${src}: cases ${mine.length}, landed ${mine.filter((k) => k.landed).length}; ${mine.map((k) => `${k.capital} land ${k.land} (${k.landCells}) by ${k.attackers.join('/')}${k.landed ? ` landed d${k.day} ${k.by}` : ''}`).join('; ')}`);
}
const total = { cases: all.length, landed: all.filter((k) => k.landed).length };
console.log(`total: ${JSON.stringify(total)}`);
writeFileSync(out, JSON.stringify({ days, total, cases: all }, null, 1));
