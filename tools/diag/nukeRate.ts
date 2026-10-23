/**
 * PLAN 7.96a: why `dd3b730`'s nuclear rule fires twice as often a holder-day at war in HEAD's world
 * (`docs/evidence/7.86/measure.md`). Run in the trees that hold that rule: `dd3b730` (its world) and
 * HEAD with `dd3b730`'s `nuclear.ts` (HEAD's world). Each day at 00:00 from `from` to `to` (years), for
 * each holder of warheads and each of its wars, `restraintOf` (the gate of the day's decision): the
 * holder-war-days by reason, and over the days a place is weighed (u finite) the sums of its parts and
 * the days each factor of the gain (value × desperation × doctrine) is at least a step, so the shift
 * of each input between the worlds can be read.
 *
 * Only APIs both trees have. Usage: npx tsx tools/diag/nukeRate.ts <seed> <from> <to> [out.json]
 */
import { writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { dayIndustry, NUKE_FLOOR, restraintOf, warheadsOf } from '../../src/sim/systems/nuclear';

const seed = Number(process.argv[2]);
const fromY = Number(process.argv[3] ?? 10);
const toY = Number(process.argv[4] ?? 20);
const out = process.argv[5] ?? `.cache/nukeRate_${seed}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
const w = sim.world;
const T0 = fromY * 8760;
const T1 = toY * 8760;
const t0 = performance.now();

const reasons: Record<string, number> = {};
const PARTS = ['u', 'value', 'gain', 'desperation', 'doctrine', 'through', 'retaliation', 'alliance', 'outrage', 'taboo', 'dead'] as const;
const sums: Record<string, number> = Object.fromEntries(PARTS.map((p) => [p, 0]));
let weighed = 0;
let holderWarDays = 0;
/** Days a weighed place's factor is at least each step. */
const STEPS = [0.05, 0.1, 0.25, 0.5, 1];
const atLeast: Record<string, number[]> = { value: STEPS.map(() => 0), desperation: STEPS.map(() => 0), doctrine: STEPS.map(() => 0), through: STEPS.map(() => 0) };
/** Days with the gain over NUKE_FLOOR, and of them those whose costs held. */
let gainOver = 0;
let uOver = 0;
/** Bursts in the window, to check against `nukeVolume.ts` that the probe leaves the world alone. */
let bursts = 0;
/** Each weighed day whose gain or utility is over NUKE_FLOOR: its parts, to set one input back by the other world's. */
const rows: Record<string, number | string>[] = [];

while (w.tick < T1) {
  sim.step(24, (world) => {
    const ev = world.out.events;
    if (world.tick > T0) for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.NukeCasualties) bursts++;
    world.out.events.length = 0;
    world.out.fires.length = 0;
  });
  if (w.tick < T0) continue;
  const industry = dayIndustry(w);
  for (const [n] of w.warheads) {
    if (warheadsOf(w, n) < 1) continue;
    for (const war of w.wars.list) {
      const side = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
      if (side < 0) continue;
      holderWarDays++;
      const r = restraintOf(w, n, war, side, industry);
      reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
      if (!Number.isFinite(r.u)) continue;
      weighed++;
      for (const p of PARTS) sums[p]! += r[p];
      for (const k of ['value', 'desperation', 'doctrine', 'through'] as const) STEPS.forEach((s, i) => (r[k] >= s ? atLeast[k]![i]!++ : 0));
      if (r.gain > NUKE_FLOOR) gainOver++;
      if (r.gain > NUKE_FLOOR || r.u > NUKE_FLOOR) {
        rows.push({ day: Math.floor(w.tick / 24), n, war: war.id, reason: r.reason, tabooWorld: +w.nukeTaboo.toFixed(4), ...Object.fromEntries(PARTS.map((p) => [p, +r[p].toFixed(4)])) });
      }
      if (r.u > NUKE_FLOOR) uOver++;
    }
  }
  if (w.tick % (8760 * 2) === 0) process.stderr.write(`seed ${seed} year ${w.tick / 8760} ${((performance.now() - t0) / 1000).toFixed(0)} s\n`);
}
const means = Object.fromEntries(PARTS.map((p) => [p, weighed ? +(sums[p]! / weighed).toFixed(4) : 0]));
writeFileSync(out, JSON.stringify({ seed, fromY, toY, bursts, holderWarDays, weighed, gainOver, uOver, reasons, means, steps: STEPS, atLeast, rows }, null, 1));
process.stderr.write(`done: seed ${seed} bursts ${bursts} holderWarDays ${holderWarDays} weighed ${weighed} gainOver ${gainOver} uOver ${uOver}\n`);
