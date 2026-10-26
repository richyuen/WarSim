/**
 * PLAN 7.116b's measure: why the wars late have no land contact. From a saved state (or from 1938
 * after `@days`), daily for `days` days (after each day's 24 hours), each war running is put in one
 * class by its land formations on land (not fleets or wings, not aboard) of its living members:
 * - `engaged`: some formation of a member is engaged (the counted contact; how many in `engagedN`);
 * - `unarmed`: a side has no land formation;
 * - `apart`: both sides armed, no landmass (`grid.component`) holds formations of both;
 * - `far`: a shared landmass, the nearest pair on one beyond 12 cells (map's default cells);
 * - `near`: within 12 cells, nobody engaged.
 * Per war also the smaller side's land formations (`minSideAWar`, the contact a war can hold) and
 * the share of them engaged. Per class the wars a day, and of `unarmed` whether the armed side's men outnumber; per war also
 * the nearest pair's distance binned (1.5, 4, 12, 30, 60, beyond). And per nation at war with a free
 * land formation (not engaged, not on the retreat) and none engaged, its own nearest enemy land
 * formation on the landmasses its free formations stand on: `unarmed` (its enemies have none),
 * `apart` (none on those landmasses), `far` (beyond 12 cells), `near`; suffixed `InEngagedWar`
 * when a war of it is engaged (a partner fights it).
 *
 * Usage: npx tsx tools/diag/warContact.ts <out.json> <days> <seed:state.bin | seed:1938@days> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3] ?? 30);
const BINS = [1.5, 4, 12, 30, 60, Infinity] as const;
const CLASSES = ['engaged', 'unarmed', 'apart', 'far', 'near'] as const;
type Cls = (typeof CLASSES)[number];
const rows: unknown[] = [];
for (const a of process.argv.slice(4)) {
  const [seedS, src] = a.split(':');
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  if (src!.startsWith('1938@')) for (let d = Number(src!.slice(5)); d > 0; d--) s.step(24, quiet);
  else s.load(new Uint8Array(readFileSync(src!)));
  const sum: Record<Cls, number> = { engaged: 0, unarmed: 0, apart: 0, far: 0, near: 0 };
  let engagedN = 0;
  let warsN = 0;
  let minSide = 0;
  let minSideEngaged = 0;
  let unarmedStronger = 0;
  const bins = [0, 0, 0, 0, 0, 0];
  const idleNations: Record<string, number> = {};
  const idleForms: Record<string, number> = {};
  let freeAtWar = 0;
  let nationsAtWarFree = 0;
  let nationsEngaged = 0;
  for (let d = 0; d < days; d++) {
    s.step(24, quiet);
    const c = w.formations.cols;
    const nat = w.nations.cols;
    const cw = w.cells.w;
    const loop = w.settings.loopingMap;
    const comp = navOf(w).grid.component;
    const scale = w.atSize(1);
    type F = { id: number; x: number; y: number; m: number; land: number; eng: boolean; free: boolean };
    const byNation = new Map<number, F[]>();
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
      const n = c.nation[id]!;
      if (nat.living[n] !== 1) return;
      const f: F = {
        id, x: c.x[id]!, y: c.y[id]!, m: c.strength[id]!,
        land: comp[Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!)]!,
        eng: c.engaged[id] === 1, free: c.engaged[id] !== 1 && c.retreat[id] === 0,
      };
      let l = byNation.get(n);
      if (!l) byNation.set(n, (l = []));
      l.push(f);
    });
    const dist = (p: F, q: F): number => {
      let dx = Math.abs(p.x - q.x);
      if (loop && dx > cw / 2) dx = cw - dx;
      return Math.hypot(dx, p.y - q.y) / scale;
    };
    const RANK: Record<string, number> = { near: 4, far: 3, apart: 2, unarmed: 1 };
    const nationWorst = new Map<number, string>();
    const engagedWarOf = new Set<number>();
    for (const war of w.wars.list) {
      const side = (k: 0 | 1): F[] => war.sides[k].filter((n) => nat.living[n] === 1).flatMap((n) => byNation.get(n) ?? []);
      const A = side(0);
      const B = side(1);
      warsN++;
      minSide += Math.min(A.length, B.length);
      const smaller = A.length <= B.length ? A : B;
      minSideEngaged += smaller.filter((f) => f.eng).length;
      const e = A.filter((f) => f.eng).length + B.filter((f) => f.eng).length;
      engagedN += e;
      let cls: Cls;
      let near = Infinity;
      if (A.length === 0 || B.length === 0) {
        cls = 'unarmed';
        const men = (L: F[]): number => L.reduce((t, f) => t + f.m, 0);
        if (men(A) + men(B) > 0) unarmedStronger++;
      } else {
        const landsA = new Set(A.map((f) => f.land));
        for (const f of B) if (landsA.has(f.land)) for (const g of A) if (g.land === f.land) near = Math.min(near, dist(f, g));
        cls = !Number.isFinite(near) ? 'apart' : near > 12 ? 'far' : 'near';
        if (Number.isFinite(near)) bins[BINS.findIndex((b) => near <= b)]!++;
      }
      if (e > 0) cls = 'engaged';
      sum[cls]++;
      if (cls !== 'engaged')
        for (const n of [...war.sides[0], ...war.sides[1]]) {
          const was = nationWorst.get(n);
          if (!was || RANK[cls]! > RANK[was]!) nationWorst.set(n, cls);
        }
      else for (const n of [...war.sides[0], ...war.sides[1]]) engagedWarOf.add(n);
    }
    for (const n of w.wars.nations()) {
      if (nat.living[n] !== 1) continue;
      const L = byNation.get(n) ?? [];
      const free = L.filter((f) => f.free).length;
      if (free === 0) continue;
      nationsAtWarFree++;
      freeAtWar += free;
      if (L.some((f) => f.eng)) {
        nationsEngaged++;
        continue;
      }
      // Its own nearest enemy land formation, on the landmasses its free formations stand on.
      const mine = L.filter((f) => f.free);
      const lands = new Set(mine.map((f) => f.land));
      let armed = false;
      let shared = false;
      let best = Infinity;
      for (const [m, E] of byNation)
        if (w.wars.atWar(n, m) && E.length > 0) {
          armed = true;
          for (const g of E)
            if (lands.has(g.land)) {
              shared = true;
              for (const f of mine) if (f.land === g.land) best = Math.min(best, dist(f, g));
            }
        }
      const k = !armed ? 'unarmed' : !shared ? 'apart' : best > 12 ? 'far' : 'near';
      const inEngagedWar = engagedWarOf.has(n);
      const key = inEngagedWar ? `${k}InEngagedWar` : k;
      idleNations[key] = (idleNations[key] ?? 0) + 1;
      idleForms[key] = (idleForms[key] ?? 0) + free;
    }
  }
  const per = (x: number): number => Math.round((x / days) * 100) / 100;
  const row = {
    seed: Number(seedS), src, day: Math.floor(w.tick / 24), days,
    warsADay: per(warsN), engagedADay: per(engagedN), engagedAWar: Math.round((engagedN / Math.max(1, warsN)) * 1000) / 1000,
    minSideAWar: Math.round((minSide / Math.max(1, warsN)) * 100) / 100,
    minSideEngagedShare: Math.round((minSideEngaged / Math.max(1, minSide)) * 1000) / 1000,
    classesADay: Object.fromEntries(CLASSES.map((k) => [k, per(sum[k])])),
    unarmedWithAnArmyADay: per(unarmedStronger),
    nearestBinsADay: Object.fromEntries(BINS.map((b, i) => [String(b), per(bins[i]!)])),
    nationsAtWarWithFreeADay: per(nationsAtWarFree), ofThemEngagedADay: per(nationsEngaged),
    idleNationsADay: Object.fromEntries(Object.entries(idleNations).map(([k, v]) => [k, per(v)])),
    idleFreeFormationsADay: Object.fromEntries(Object.entries(idleForms).map(([k, v]) => [k, per(v)])),
    freeFormationsAtWarADay: per(freeAtWar),
  };
  rows.push(row);
  process.stderr.write(`${JSON.stringify(row)}\n`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`done: ${rows.length} -> ${out}`);
