/**
 * PLAN 7.99's read: the AI's land-based wings at war with no mission, and what of the enemy lies
 * within their range. Each 7th day, in the hour `airAi` gave its missions, every wing of a living AI
 * nation at war on an airbase (not one carrying a warhead) is counted by role and by whether it has
 * a mission; one without, by what of its nation's enemies is within its range from its base: a land
 * formation (on land, not embarked), an airbase held by the enemy (and of those, one with an enemy
 * wing on it), a fleet afloat (not embarked). Per year, summed over the days read.
 *
 * Usage: npx tsx tools/diag/airIdle.ts <seed> [years = 20] [out = .cache/airIdle_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { isDayStart } from '../../src/shared/calendar';
import { loadAssets1938 } from '../headless/assets';
import { roleOf } from '../../src/sim/ai/air';
import { basePlace, wingRange } from '../../src/sim/systems/air';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { carriesNuke } from '../../src/sim/systems/nuclear';
import type { World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 20);
const out = process.argv[4] ?? `.cache/airIdle_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });

type Row = Record<string, number>;
const rows: (Row & { year: number })[] = [];
const add = (r: Row, k: string, v = 1): void => {
  r[k] = (r[k] ?? 0) + v;
};

function read(w: World, r: Row): void {
  const c = w.formations.cols;
  const nc = w.nations.cols;
  const atWar = w.wars.nations();
  // The land formations, fleets afloat and the wings at each airbase.
  const land: number[] = [];
  const fleets: number[] = [];
  w.formations.forEach((id) => {
    if (nc.living[c.nation[id]!] !== 1) return;
    if (w.isFleet(id)) {
      if (!w.embarked.has(id)) fleets.push(id);
    } else if (!w.isWing(id) && !w.offLand(id) && !w.embarked.has(id)) land.push(id);
  });
  const wingsAt = new Map<number, number[]>();
  for (const [id, b] of w.wingBase) {
    if (b <= 0 || !w.formations.has(id)) continue;
    const l = wingsAt.get(b);
    if (l) l.push(id);
    else wingsAt.set(b, [id]);
  }
  add(r, 'days');
  for (const [id, base] of w.wingBase) {
    if (base <= 0 || !w.formations.has(id) || carriesNuke(w, id)) continue;
    const n = c.nation[id]!;
    if (nc.living[n] !== 1 || nc.aiOff[n] === 1 || !atWar.has(n)) continue;
    const role = roleOf(w, id) ?? 'none';
    const has = w.wingMission.has(id);
    add(r, `${role}:${has ? 'mission' : 'idle'}`);
    add(r, has ? 'mission' : 'idle');
    if (has) {
      add(r, `kind:${w.wingMission.get(id)!.kind}`);
      continue;
    }
    if (role === 'lift' || role === 'bomb') continue;
    const at = basePlace(w, base)!;
    const range = wingRange(w, id);
    const within = (x: number, y: number): boolean => seaKm(w, at[0], at[1], x, y) <= range;
    let landIn = false;
    let nearestLand = Infinity;
    for (const g of land) {
      if (!w.wars.atWar(n, c.nation[g]!)) continue;
      const d = seaKm(w, at[0], at[1], c.x[g]!, c.y[g]!);
      nearestLand = Math.min(nearestLand, d);
      if (d <= range) landIn = true;
    }
    let baseIn = false;
    let mannedIn = false;
    w.airbases.forEach((b, i) => {
      const h = w.cells.controller[b.cell]!;
      if (!w.wars.atWar(n, h)) return;
      const [x, y] = w.cellPoint(b.cell);
      if (!within(x, y)) return;
      baseIn = true;
      if ((wingsAt.get(i + 1) ?? []).some((o) => w.wars.atWar(n, c.nation[o]!))) mannedIn = true;
    });
    let fleetIn = false;
    for (const g of fleets) if (w.wars.atWar(n, c.nation[g]!) && within(c.x[g]!, c.y[g]!)) fleetIn = true;
    add(r, `idle:${role}`);
    if (landIn) add(r, 'idle.landIn');
    if (baseIn) add(r, 'idle.baseIn');
    if (mannedIn) add(r, 'idle.mannedBaseIn');
    if (fleetIn) add(r, 'idle.fleetIn');
    if (!landIn && !baseIn && !fleetIn) add(r, 'idle.nothing');
    if (Number.isFinite(nearestLand)) {
      const k = nearestLand / range;
      add(r, k < 2 ? 'idle.land<2r' : k < 4 ? 'idle.land2-4r' : 'idle.land>4r');
    } else add(r, 'idle.noEnemyLand');
  }
}

for (let y = 1; y <= years; y++) {
  const r: Row = {};
  for (let d = 0; d < 365; d++) {
    s.step(24, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
      if (d % 7 === 0 && isDayStart(ww.tick - 1)) read(ww, r);
    });
  }
  rows.push({ year: y, ...r });
  process.stderr.write(`${seed} year ${y}: ${JSON.stringify(r)}\n`);
}
writeFileSync(out, JSON.stringify({ seed, years, rows }, null, 1));
console.log(`done: ${seed} ${years} years`);
