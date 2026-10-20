/**
 * PLAN 7.32 (critic R9-B2: "the Soviet Union strikes China every 7 days along one line, each burst
 * about 7 cells west of the last: 10,847 → 1,373 → 168 → 24 dead"): each AI strike of a run, what
 * its place was weighed at on the day it was decided (`placeParts`: the enemy output and men in the
 * blast as shares, and the men those shares stand for), against what its burst destroyed: men, guns
 * (artillery, anti-tank, anti-air), tanks, aircraft and ships of formations within the blast, the
 * people killed, and the industry put out of work (`cells.econ` × the bomb damage added).
 *
 * The burst's toll is read by a snapshot of the formations within two blast radii of each warhead
 * due in the hour, before the hour, against the same after it (another system's losses in that hour
 * count too: a few men at most).
 *
 * Usage: npx tsx tools/diag/nukeChain.ts <seed> <years> [from.bin | new] [out = .cache/nukeChain_<seed>.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { nukeStrike } from '../../src/shared/history';
import { size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { elementIndex } from '../../src/sim/systems/elements';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { blastRadius, desperationOf, doctrineOf, placeParts, RESOLVE, RESOLVE_FULL_DAYS } from '../../src/sim/systems/nuclear';
import { Domain, type World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 16);
const from = process.argv[4] ?? 'new';
const out = process.argv[5] ?? `.cache/nukeChain_${seed}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
if (from !== 'new') sim.load(new Uint8Array(readFileSync(from)));
const w = sim.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const GUNS = new Set(['art', 'at', 'aa']);
const TANKS = new Set(['armor_l', 'armor_m', 'armor_h']);

type Kit = { men: number; guns: number; tanks: number; planes: number; ships: number };
/** What the formations within `km` of (x, y) hold, by formation id. */
function kitNear(world: World, x: number, y: number, km: number): Map<number, Kit> {
  const units = world.rules!.units;
  const c = world.formations.cols;
  const ec = world.elements.cols;
  const idx = elementIndex(world);
  const m = new Map<number, Kit>();
  world.formations.forEach((id) => {
    if (Math.abs(c.y[id]! - y) > km / 10 + 2 || seaKm(world, x, y, c.x[id]!, c.y[id]!) > km) return;
    const k: Kit = { men: c.strength[id]!, guns: 0, tanks: 0, planes: 0, ships: 0 };
    for (const e of idx.get(id) ?? []) {
      const u = units[ec.unit[e]!]!;
      const s = ec.strength[e]!;
      if (GUNS.has(u.cls)) k.guns += s;
      else if (TANKS.has(u.cls)) k.tanks += s;
      else if (u.domain === Domain.air) k.planes += s;
      else if (u.domain === Domain.sea) k.ships += s;
    }
    m.set(id, k);
  });
  return m;
}
function industryNear(world: World, x: number, y: number, km: number): number {
  const { w: W, h, econ } = world.cells;
  let sum = 0;
  for (let yy = Math.max(0, Math.floor(y - km / 10 - 2)); yy <= Math.min(h - 1, Math.floor(y + km / 10 + 2)); yy++) {
    for (let xx = Math.floor(x - km / 4 - 2); xx <= Math.floor(x + km / 4 + 2); xx++) {
      const cx = ((xx % W) + W) % W;
      const cell = yy * W + cx;
      if (econ[cell] === 0 || seaKm(world, x, y, cx + 0.5, yy + 0.5) > km) continue;
      sum += econ[cell]! * (1 - (world.bombDamage.get(cell) ?? 0));
    }
  }
  return sum;
}

type Decision = Record<string, unknown>;
const rows: Decision[] = [];
const byLaunch = new Map<number, Decision>();
const T = years * 365 * 24;
const t0 = performance.now();
while (w.tick < T) {
  // Warheads due this hour: their places' kit before it.
  const due = w.nukeLaunches.filter((l) => l.arrive <= w.tick + 1);
  const before = due.map((l) => {
    const r = 2 * blastRadius(2);
    return { l, kit: kitNear(w, l.tx, l.ty, r), econ: industryNear(w, l.tx, l.ty, r), r };
  });
  const launchesBefore = new Set(w.nukeLaunches.map((l) => l.id));
  // Each war's strikes by resolve before the hour: a decision that adds one was taken by it (PLAN 7.37c).
  const resolveBefore = new Map(w.wars.list.map((war) => [war, [...(war.resolveStrikes ?? [0, 0])]]));
  sim.step(1, (world) => {
    const ev = world.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      const kind = ev[i + 1]!;
      const n = ev[i + 2]!;
      if (kind === EventKind.NukeDecided) {
        const x = ev[i + 4]!;
        const y = ev[i + 5]!;
        const row: Decision = { day: +(world.tick / 24).toFixed(1), year: +(world.tick / 8760).toFixed(2), by: tag(n), u: ev[i + 3]! / 1000, at: [+x.toFixed(1), +y.toFixed(1)] };
        const cell = Math.floor(y) * world.cells.w + Math.floor(x);
        const owner = world.cells.controller[cell]!;
        row.target = tag(owner);
        for (const war of world.wars.list) {
          const side = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
          if (side < 0 || !war.sides[1 - side]!.includes(owner)) continue;
          const p = placeParts(world, n, war, side, x, y);
          const d = desperationOf(world, n, war, side);
          row.war = `${war.sides[0].map(tag).join('+')} v ${war.sides[1].map(tag).join('+')}`;
          row.warDays = Math.round((world.tick - war.startTick) / 24);
          row.desperation = +d.desperation.toFixed(2);
          // A strike of the resolve (PLAN 7.18e) weighs at RESOLVE × the war's days / RESOLVE_FULL_DAYS.
          const rs = resolveBefore.get(war)?.[side] ?? 0;
          row.byResolve = (war.resolveStrikes?.[side as 0 | 1] ?? 0) > rs;
          if (row.byResolve) row.resolve = +(RESOLVE * Math.min(1, (world.tick - war.startTick) / 24 / RESOLVE_FULL_DAYS)).toFixed(2);
          row.doctrine = +doctrineOf(world, n).toFixed(2);
          row.extreme = d.extreme;
          row.parts = { econShare: +p.econShare.toFixed(4), menShare: +p.menShare.toFixed(4), ownShare: +p.ownShare.toFixed(4), menExpected: Math.round(p.menShare * p.theatreMen), menAll: p.menAll, theatreMen: Math.round(p.theatreMen), sideMen: p.sideMen, capital: p.capital, through: +p.through.toFixed(2), value: +p.value.toFixed(3) };
          break;
        }
        rows.push(row);
        const l = world.nukeLaunches.find((q) => q.nation === n && !launchesBefore.has(q.id));
        if (l) {
          row.launch = l.id;
          row.missile = l.missile;
          row.flightH = l.arrive - l.launch;
          byLaunch.set(l.id, row);
        }
      }
      if (kind === EventKind.NukeIntercepted) {
        const row = byLaunch.get(ev[i + 3]!);
        if (row) row.intercepted = true;
      }
      if (kind === EventKind.NukeCasualties) {
        const x = ev[i + 4]!;
        const y = ev[i + 5]!;
        const s = nukeStrike(ev[i + 3]!);
        const b = before.find((q) => Math.abs(q.l.tx - x) < 1e-6 && Math.abs(q.l.ty - y) < 1e-6);
        const row = b ? byLaunch.get(b.l.id) : undefined;
        const toll: Record<string, number> = { dead: s.dead, yieldN: s.yieldN };
        if (b) {
          const after = kitNear(world, x, y, b.r);
          const lost: Kit = { men: 0, guns: 0, tanks: 0, planes: 0, ships: 0 };
          for (const [id, k] of b.kit) {
            const a = after.get(id) ?? { men: 0, guns: 0, tanks: 0, planes: 0, ships: 0 };
            for (const key of Object.keys(lost) as (keyof Kit)[]) lost[key] += Math.max(0, k[key] - a[key]);
          }
          Object.assign(toll, lost, { people: s.dead - lost.men, econLost: +(b.econ - industryNear(world, x, y, b.r)).toFixed(2), formationsNear: b.kit.size });
        }
        if (row) row.toll = toll;
        else rows.push({ day: +(world.tick / 24).toFixed(1), by: tag(n), unmatched: true, toll });
      }
    }
    world.out.events.length = 0;
    world.out.fires.length = 0;
  });
  if (w.tick % 8760 === 0) process.stderr.write(`year ${w.tick / 8760} ${((performance.now() - t0) / 1000).toFixed(0)} s, ${rows.length} decisions\n`);
}
writeFileSync(out, JSON.stringify({ seed, years, rows }, null, 1));
process.stderr.write(`done: ${rows.length} decisions -> ${out}\n`);
