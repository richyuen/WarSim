/**
 * PLAN 7.38a (critic R10-B1: "`nuclearUtility` has no term for the dead"): each AI strike of a run,
 * its utility by its parts as decided (the place's value and the chance it gets there, desperation
 * or the resolve, doctrine, the strike back weighed, the alliance's cost, outrage, the taboo), the
 * people its blast was expected to kill at the yield used and at a fission yield, the place's value
 * at a fission yield (the radius the decision weighs comes from `thermonuclear` alone), its toll
 * (dead, men), and the earlier bursts within a blast radius of the place: in the same war (by
 * `War.id`) and in any.
 *
 * Read after the hour of the decision (as `nukeChain.ts`): a strike of the resolve is told by
 * `resolveStrikes` before and after the hour. The place is weighed with the war's `lastStrike` and
 * `resolveStrikes` of before the hour put back (PLAN 7.45b): after it the resolve is spent, and each
 * yield's score, and so the yield and value read, were the war's without it.
 *
 * Usage: npx tsx tools/diag/nukeToll.ts <seed> <years> [from.bin | new] [out.json] [saveTicks]
 * `saveTicks`: comma-separated ticks; a checkpoint is saved 48 hours before each, to
 * `.cache/nukeToll_<seed>_<tick>.bin` (a named case's A/B from a state just before it).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { nukeStrike } from '../../src/shared/history';
import { NATIONS_1938, size1938 } from '../../src/sim/scenario1938';
import en from '../../src/ui/i18n/en.json' with { type: 'json' };
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { blastRadius, blastShare, deadCost, desperationOf, largestYield, NUKE_FLOOR, nukeInputs, nuclearUtility, peopleShare, placeParts, RESOLVE, RESOLVE_FULL_DAYS } from '../../src/sim/systems/nuclear';
import type { World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 30);
const from = process.argv[4] ?? 'new';
const out = process.argv[5] ?? `.cache/nukeToll_${seed}.json`;
const saveTicks = (process.argv[6] ?? '')
  .split(',')
  .filter((s) => s !== '')
  .map(Number)
  .sort((a, b) => a - b);
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
if (from !== 'new') sim.load(new Uint8Array(readFileSync(from)));
const w = sim.world;
const name = (n: number): string => {
  if (n === 0) return 'none';
  const d = NATIONS_1938[n - 1];
  if (d && (w.nations.cols.origin[n] ?? 0) === 0) return (en as Record<string, string>)[d.nameKey] ?? d.tag;
  return w.names.get(n) ?? `founded#${n}`;
};

/** The people (not formations) a blast of class `yieldN` at (x, y) would kill, as `blast` counts them. */
function peopleIn(world: World, yieldN: number, x: number, y: number): number {
  const radius = blastRadius(yieldN);
  const share = peopleShare(yieldN);
  const { w: W, h, pop } = world.cells;
  const ry = Math.ceil(radius / 10) + 1;
  const rx = Math.ceil(radius / 4) + 1;
  let dead = 0;
  for (let dy = -ry; dy <= ry; dy++) {
    const yy = Math.floor(y) + dy;
    if (yy < 0 || yy >= h) continue;
    for (let dx = -rx; dx <= rx; dx++) {
      const xx = (((Math.floor(x) + dx) % W) + W) % W;
      const f = blastShare(seaKm(world, x, y, xx + 0.5, yy + 0.5), radius);
      if (f > 0) dead += Math.round(pop[yy * W + xx]! * f * share) * 1000;
    }
  }
  return dead;
}

/** The land men of `enemy` within `radius` km of (x, y), as `nuclear.ts`' `menNear` counts them (PLAN 7.38e). */
function menNearPlace(world: World, enemy: number[], x: number, y: number, radius: number): number {
  const c = world.formations.cols;
  const set = new Set(enemy);
  let men = 0;
  world.formations.forEach((id) => {
    if (!set.has(c.nation[id]!) || world.isFleet(id) || world.isWing(id) || world.offLand(id)) return;
    if (Math.abs(c.y[id]! - y) <= radius / 10 && seaKm(world, c.x[id]!, c.y[id]!, x, y) <= radius) men += c.strength[id]!;
  });
  return men;
}

/** The place's value parts with `thermonuclear` unknown to `n` (a fission blast's radius), the tech restored. */
function fissionParts(world: World, n: number, war: Parameters<typeof placeParts>[2], side: number, x: number, y: number): ReturnType<typeof placeParts> {
  const techs = world.rules!.techs;
  const i = techs.findIndex((t) => t.id === 'thermonuclear');
  const nc = world.nations.cols;
  const col = i < 32 ? nc.tech0 : nc.tech1;
  const bit = (1 << (i % 32)) >>> 0;
  const was = col[n]!;
  col[n] = (was & ~bit) >>> 0;
  try {
    return placeParts(world, n, war, side, x, y);
  } finally {
    col[n] = was;
  }
}

type Strikes = { lastStrike: [number, number] | undefined; resolveStrikes: [number, number] | undefined };
/** Puts a war's `lastStrike` and `resolveStrikes` as in `s` (an absent one deleted). */
function setStrikes(war: World['wars']['list'][number], s: Strikes): void {
  if (s.lastStrike) war.lastStrike = s.lastStrike;
  else delete war.lastStrike;
  if (s.resolveStrikes) war.resolveStrikes = s.resolveStrikes;
  else delete war.resolveStrikes;
}

type Row = Record<string, unknown>;
const rows: Row[] = [];
const byLaunch = new Map<number, Row>();
/** Every burst of the run: place, day, war id, striker. */
const bursts: { x: number; y: number; day: number; war: number; by: string; dead: number }[] = [];
const T = years * 365 * 24;
const t0 = performance.now();
const r3 = (v: number): number => +v.toFixed(3);
while (w.tick < T) {
  if (saveTicks.length > 0 && w.tick >= saveTicks[0]! - 48) {
    const t = saveTicks.shift()!;
    writeFileSync(`.cache/nukeToll_${seed}_${t}.bin`, sim.save());
    process.stderr.write(`saved tick ${w.tick} for ${t}\n`);
    continue;
  }
  const launchesBefore = new Set(w.nukeLaunches.map((l) => l.id));
  const resolveBefore = new Map(w.wars.list.map((war) => [war, [...(war.resolveStrikes ?? [0, 0])]]));
  const warBefore = new Map(w.wars.list.map((war) => [war, { lastStrike: war.lastStrike ? ([...war.lastStrike] as [number, number]) : undefined, resolveStrikes: war.resolveStrikes ? ([...war.resolveStrikes] as [number, number]) : undefined }]));
  // The grievances as the decision weighed them: a strike back spends its own within the hour (PLAN 7.45).
  const grievanceBefore = new Map([...w.nukeGrievance].map(([k, g]) => [k, { ...g }]));
  sim.step(1, (world) => {
    const ev = world.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      const kind = ev[i + 1]!;
      const n = ev[i + 2]!;
      if (kind === EventKind.NukeDecided) {
        const x = ev[i + 4]!;
        const y = ev[i + 5]!;
        const day = +(world.tick / 24).toFixed(1);
        const row: Row = { day, year: +(world.tick / 8760).toFixed(2), tick: world.tick, by: name(n), u: ev[i + 3]! / 1000, at: [+x.toFixed(2), +y.toFixed(2)] };
        const cell = Math.floor(y) * world.cells.w + Math.floor(x);
        const owner = world.cells.controller[cell]!;
        row.target = name(owner);
        const thermo = blastRadius(2);
        for (const war of world.wars.list) {
          const side = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
          if (side < 0 || !war.sides[1 - side]!.includes(owner)) continue;
          const g = grievanceBefore.get(n);
          const back = g !== undefined && g.until > world.tick && war.sides[1 - side]!.includes(g.by);
          const rs = resolveBefore.get(war)?.[side] ?? 0;
          const byResolve = (war.resolveStrikes?.[side as 0 | 1] ?? 0) > rs;
          // The war's strikes as the decision saw them (PLAN 7.45b): after the hour `lastStrike` keeps
          // the resolve at 0, so each yield's score (and the yield chosen) would be weighed without it.
          const after = { lastStrike: war.lastStrike, resolveStrikes: war.resolveStrikes };
          const before = warBefore.get(war);
          if (before) setStrikes(war, before);
          const inputs = nukeInputs(world, n, war, side, x, y, back);
          const own = desperationOf(world, n, war, side);
          if (byResolve) inputs.desperation = Math.max(own.desperation, RESOLVE * Math.min(1, (world.tick - war.startTick) / 24 / RESOLVE_FULL_DAYS));
          const p = placeParts(world, n, war, side, x, y);
          const f = fissionParts(world, n, war, side, x, y);
          const gain = inputs.targetValue * inputs.desperation * inputs.doctrine;
          row.war = war.id;
          row.warName = `${war.sides[0].map(name).join('+')} v ${war.sides[1].map(name).join('+')}`;
          row.warDays = Math.round((world.tick - war.startTick) / 24);
          row.byResolve = byResolve;
          row.retaliating = back;
          row.uRecomputed = r3(nuclearUtility(inputs));
          row.utility = {
            value: r3(inputs.targetValue),
            through: r3(inputs.through),
            desperation: r3(inputs.desperation),
            ownDesperation: r3(own.desperation),
            doctrine: r3(inputs.doctrine),
            gain: r3(gain),
            retaliation: r3(inputs.retaliation),
            allianceCost: r3(inputs.allianceCost),
            outrage: r3(inputs.outrage),
            taboo: r3(inputs.taboo),
            // PLAN 7.38c: the people the decision weighed as dead, and their cost (× the chance through).
            people: inputs.people,
            dead: r3(inputs.through * deadCost(inputs.people, inputs.doctrine)),
            mad: inputs.mad,
            extreme: inputs.extreme,
            costs: r3(gain - nuclearUtility(inputs)),
          };
          row.place = { econShare: r3(p.econShare), menShare: r3(p.menShare), ownShare: r3(p.ownShare), menExpected: Math.round(p.menShare * p.theatreMen), theatreMen: Math.round(p.theatreMen), capital: p.capital };
          // At a fission yield: the value the place would have, and its people killed.
          row.fission = { value: r3(f.value), econShare: r3(f.econShare), menShare: r3(f.menShare), menExpected: Math.round(f.menShare * f.theatreMen), capital: f.capital };
          // PLAN 7.38e: compared unrounded (seed 751's day 7896: 0.90786 against 0.90776, both 0.908 rounded).
          row.fissionCovers = f.value >= inputs.targetValue;
          row.peopleExpected = { thermo: peopleIn(world, 2, x, y), fission: peopleIn(world, 1, x, y) };
          setStrikes(war, after);
          // The bursts before within a blast radius of the place.
          const near = bursts.filter((b) => seaKm(world, x, y, b.x, b.y) <= thermo);
          row.before = near.map((b) => ({ day: b.day, by: b.by, sameWar: b.war === war.id, dead: b.dead }));
          row.beforeSameWar = near.filter((b) => b.war === war.id).length;
          // PLAN 7.38e: ADR-569's figures for a restrike in the war: the most men an earlier burst of
          // the side found within a hydrogen bomb's blast of the place (`War.struck`), and the enemy
          // men within the striker's blast of the place now, as `menNear` counts them.
          const s = war.struck ?? [];
          let menThen = -1;
          for (let k = 0; k + 3 < s.length; k += 4) if (s[k + 3] === side && seaKm(world, x, y, s[k]!, s[k + 1]!) <= thermo) menThen = Math.max(menThen, s[k + 2]!);
          if (menThen >= 0) row.warStruck = { menThen, menNow: menNearPlace(world, war.sides[1 - side]!, x, y, blastRadius(largestYield(world, n))) };
          break;
        }
        rows.push(row);
        const l = world.nukeLaunches.find((q) => q.nation === n && !launchesBefore.has(q.id));
        if (l) {
          row.missile = l.missile;
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
        const row = [...byLaunch.values()].find((r) => !r.toll && Math.abs((r.at as number[])[0]! - x) < 0.01 && Math.abs((r.at as number[])[1]! - y) < 0.01);
        if (row) {
          row.toll = { dead: s.dead, yieldN: s.yieldN };
          bursts.push({ x, y, day: +(world.tick / 24).toFixed(1), war: (row.war as number) ?? -1, by: row.by as string, dead: s.dead });
        } else {
          rows.push({ day: +(world.tick / 24).toFixed(1), by: name(n), unmatched: true, toll: { dead: s.dead, yieldN: s.yieldN } });
          bursts.push({ x, y, day: +(world.tick / 24).toFixed(1), war: -1, by: name(n), dead: s.dead });
        }
      }
    }
    world.out.events.length = 0;
    world.out.fires.length = 0;
  });
  if (w.tick % 8760 === 0) process.stderr.write(`year ${w.tick / 8760} ${((performance.now() - t0) / 1000).toFixed(0)} s, ${rows.length} decisions\n`);
}
// The three bars of PLAN 7.38's AT, read off the rows.
const decided = rows.filter((r) => !r.unmatched);
const lowMillion = decided.filter((r) => (r.u as number) < 0.1 && ((r.toll as { dead: number } | undefined)?.dead ?? 0) >= 1_000_000);
const restruck = decided.filter((r) => ((r.beforeSameWar as number) ?? 0) > 0);
// A thermonuclear burst where a fission one's place would have been worth as much.
const thermoNeedless = decided.filter((r) => (r.toll as { yieldN: number } | undefined)?.yieldN === 2 && r.fissionCovers === true);
const bars = { decided: decided.length, floor: NUKE_FLOOR, lowUtilityMillion: lowMillion.length, restruckSameWar: restruck.length, thermoWhereFissionCovers: thermoNeedless.length };
writeFileSync(out, JSON.stringify({ seed, years, from, bars, rows }, null, 1));
process.stderr.write(`done: ${rows.length} decisions -> ${out} ${JSON.stringify(bars)}\n`);
