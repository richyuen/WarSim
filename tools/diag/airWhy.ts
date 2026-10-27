/**
 * PLAN 7.108b's read: why the AI's wings at war sit idle late. From a checkpoint, each day in the
 * hour `airAi` gave its missions, every wing of a living AI nation at war on an airbase (not one
 * carrying a warhead) is counted by role and mission. One idle of a fighter's or striker's role,
 * by why: no enemy of its nation has a wing at all (`noEnemyAir`); no airbase of its side has an
 * enemy land formation within the wing's range (`beyondBases`: the front is across the sea or past
 * every base); such a base exists and is within a ferry flight of its own (`baseInFerry`) or not
 * (`baseFar`). A strategic bomber idle: whether an enemy cell with industry lies within its range
 * (`bomb.industryIn`). Per day the hours' air battles and the sorties aloft are summed too.
 *
 * Usage: npx tsx tools/diag/airWhy.ts <save.bin> [days = 60] [out = .cache/airWhy.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { isDayStart } from '../../src/shared/calendar';
import { EventKind } from '../../src/shared/events';
import { loadAssets1938 } from '../headless/assets';
import { byIndustry, roleOf } from '../../src/sim/ai/air';
import { basePlace, FERRY_RANGE, ofSide, wingRange } from '../../src/sim/systems/air';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { carriesNuke } from '../../src/sim/systems/nuclear';
import { loopW } from '../../src/sim/systems/elements';
import { sortieAt } from '../../src/shared/sorties';
import { AIR_HELD, airSuperiority } from '../../src/sim/systems/airSuperiority';
import { airOf as airGrid } from '../../src/sim/world';
import type { World } from '../../src/sim/world';

const save = process.argv[2]!;
const days = Number(process.argv[3] ?? 60);
const out = process.argv[4] ?? '.cache/airWhy.json';
const s = new Sim({ scenario: '1938', seed: 1, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(save)));

const r: Record<string, number> = {};
const add = (k: string, v = 1): void => {
  r[k] = (r[k] ?? 0) + v;
};

function read(w: World): void {
  const c = w.formations.cols;
  const nc = w.nations.cols;
  const atWar = w.wars.nations();
  const land: number[] = [];
  const airOf = new Set<number>();
  w.formations.forEach((id) => {
    if (nc.living[c.nation[id]!] !== 1) return;
    if (w.isWing(id)) airOf.add(c.nation[id]!);
    else if (!w.isFleet(id) && !w.offLand(id) && !w.embarked.has(id)) land.push(id);
  });
  add('days');
  // PLAN 7.133: the nations at war with no wing; the carriers' wings at war.
  for (const n of atWar) {
    if (nc.living[n] !== 1 || nc.aiOff[n] === 1) continue;
    add('nationsAtWar');
    if (!airOf.has(n)) add('nationsAtWarNoWings');
  }
  for (const [id, base] of w.wingBase) {
    if (base < 0 && w.formations.has(id) && atWar.has(c.nation[id]!)) add('carrier:atWar');
    if (base <= 0 || !w.formations.has(id) || carriesNuke(w, id)) continue;
    const n = c.nation[id]!;
    if (nc.living[n] !== 1 || nc.aiOff[n] === 1 || !atWar.has(n)) continue;
    const role = roleOf(w, id) ?? 'none';
    const has = w.wingMission.has(id);
    add(`${role}:${has ? 'mission' : 'idle'}`);
    if (has || role === 'lift') continue;
    const range = wingRange(w, id);
    const at = basePlace(w, base)!;
    if (role === 'bomb') {
      let rich = false;
      let held = false;
      let contested = false;
      const zones = airGrid(w).zoneOf;
      for (const cell of byIndustry(w)) {
        if (!w.wars.atWar(n, w.cells.controller[cell]!)) continue;
        const [x, y] = w.cellPoint(cell);
        if (seaKm(w, at[0], at[1], x, y) <= range) {
          rich = true;
          const z = zones[cell]!;
          if (w.airPower.has(z)) {
            contested = true;
            if (airSuperiority(w, n, z) >= AIR_HELD) held = true;
          }
        }
      }
      add(rich ? 'bomb.industryIn' : 'bomb.noIndustryIn');
      // PLAN 7.133: of those, any such cell in a zone flown in (`airPower`), and one held there.
      if (rich) add(held ? 'bomb.in.held' : contested ? 'bomb.in.notHeld' : 'bomb.in.unflown');
      continue;
    }
    const enemyAir = [...airOf].some((o) => w.wars.atWar(n, o));
    if (!enemyAir) add(`${role}.noEnemyAir`);
    const enemy = land.filter((g) => w.wars.atWar(n, c.nation[g]!));
    if (enemy.length === 0) {
      add(`${role}.noEnemyLand`);
      continue;
    }
    // The side's airbases with an enemy land formation within this wing's range.
    let inReach = false;
    let inFerry = false;
    w.airbases.forEach((b) => {
      if (inFerry || !ofSide(w, n, w.cells.controller[b.cell]!)) return;
      const [px, py] = w.cellPoint(b.cell);
      if (!enemy.some((g) => seaKm(w, px, py, c.x[g]!, c.y[g]!) <= range)) return;
      inReach = true;
      if (seaKm(w, at[0], at[1], px, py) <= FERRY_RANGE * range) inFerry = true;
    });
    add(`${role}.${!inReach ? 'beyondBases' : inFerry ? 'baseInFerry' : 'baseFar'}`);
    if (enemyAir) add(`${role}.enemyAir.${!inReach ? 'beyondBases' : inFerry ? 'baseInFerry' : 'baseFar'}`);
    // A base in reach of the enemy, but past a ferry flight: is there a chain of the side's bases
    // (hops of a ferry flight each, room not weighed) to one, and how many hops?
    if (inReach && !inFerry && enemyAir && w.tick % (24 * 6) < 24) {
      const pts: [number, number, boolean][] = [];
      w.airbases.forEach((b) => {
        if (!ofSide(w, n, w.cells.controller[b.cell]!)) return;
        const [px, py] = w.cellPoint(b.cell);
        pts.push([px, py, enemy.some((g) => seaKm(w, px, py, c.x[g]!, c.y[g]!) <= range)]);
      });
      const hop = FERRY_RANGE * range;
      const seen = new Uint8Array(pts.length);
      let frontier = pts.map((p, i) => (seaKm(w, at[0], at[1], p[0], p[1]) <= hop ? i : -1)).filter((i) => i >= 0);
      frontier.forEach((i) => (seen[i] = 1));
      let hops = 1;
      let found = 0;
      while (frontier.length > 0 && !found) {
        if (frontier.some((i) => pts[i]![2])) {
          found = hops;
          break;
        }
        const next: number[] = [];
        for (const i of frontier) pts.forEach((p, j) => {
          if (seen[j] || seaKm(w, pts[i]![0], pts[i]![1], p[0], p[1]) > hop) return;
          seen[j] = 1;
          next.push(j);
        });
        frontier = next;
        hops++;
      }
      add('far.read');
      add(found ? `far.chain${Math.min(found, 6)}` : 'far.noChain');
      // The destination a sea hop would take: the side's base in reach of the enemy nearest the
      // wing's nearest enemy formation. Is an enemy wing based within its range + INTERCEPT_KM?
      let goal = -1;
      let gd = Infinity;
      for (const g of enemy) {
        const d = seaKm(w, at[0], at[1], c.x[g]!, c.y[g]!);
        if (d < gd) [goal, gd] = [g, d];
      }
      let dest = -1;
      let dd = Infinity;
      pts.forEach((p, i) => {
        if (!p[2]) return;
        const d = seaKm(w, p[0], p[1], c.x[goal]!, c.y[goal]!);
        if (d < dd) [dest, dd] = [i, d];
      });
      if (dest >= 0) {
        const [dx, dy] = [pts[dest]![0], pts[dest]![1]];
        let foeAir = false;
        for (const [o, b] of w.wingBase) {
          if (b <= 0 || !w.formations.has(o) || !w.wars.atWar(n, c.nation[o]!)) continue;
          const p = basePlace(w, b)!;
          if (seaKm(w, dx, dy, p[0], p[1]) <= range + 150) {
            foeAir = true;
            break;
          }
        }
        add(foeAir ? 'dest.foeAirNear' : 'dest.noFoeAirNear');
        add('dest.km', seaKm(w, at[0], at[1], dx, dy));
        const name = (k: number): string => w.names.get(k) ?? `#${k}`;
        const key = `case ${name(n)} -> base of ${name(w.cells.controller[w.airbases.find((b) => w.cellPoint(b.cell)[0] === dx && w.cellPoint(b.cell)[1] === dy)!.cell]!)} vs ${name(c.nation[goal]!)}`;
        add(key);
      }
    }
  }
}

/** Per hour: for each pair of nations at war with sorties of both aloft, how near their nearest two come. */
function meet(w: World): void {
  const byNation = new Map<number, { x: number; y: number }[]>();
  const lw = loopW(w);
  for (const [id, so] of w.sorties) {
    if (!w.formations.has(id)) continue;
    const n = w.formations.cols.nation[id]!;
    const p = sortieAt(so, w.tick, lw);
    const l = byNation.get(n);
    if (l) l.push(p);
    else byNation.set(n, [p]);
  }
  const ns = [...byNation.keys()];
  for (let i = 0; i < ns.length; i++)
    for (let j = i + 1; j < ns.length; j++) {
      if (!w.wars.atWar(ns[i]!, ns[j]!)) continue;
      let d = Infinity;
      for (const a of byNation.get(ns[i]!)!) for (const b of byNation.get(ns[j]!)!) d = Math.min(d, seaKm(w, a.x, a.y, b.x, b.y));
      add('pairHours');
      add(d <= 150 ? 'pair.within150' : d <= 600 ? 'pair.150-600' : d <= 1500 ? 'pair.600-1500' : 'pair.over1500');
    }
}

for (let d = 0; d < days; d++) {
  s.step(24, (ww) => {
    const ev = ww.out.events;
    for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.AirBattle) add('airBattles');
    ev.length = 0;
    ww.out.fires.length = 0;
    add('aloftHours', ww.sorties.size);
    meet(ww);
    if (isDayStart(ww.tick - 1)) read(ww);
  });
}
writeFileSync(out, JSON.stringify({ save, days, r }, null, 1));
console.log(`done: ${save} ${JSON.stringify(r)}`);
