/**
 * PLAN 7.37e (critic run 10: "3 of 14 worlds never see a burst while 4 to 6 nations hold 145 to 164
 * warheads", seeds 4219, 5309, 6421): why each holder of warheads at war does not strike. Each day
 * at 00:00, for each holder and each of its wars, `restraintOf` (the gate of the day's decision that
 * holds it). Per holder and war: the days by reason, and the day its best place came nearest to
 * NUKE_FLOOR (the highest utility) with that day's parts; per holder: its days at peace with a warhead.
 *
 * Usage: npx tsx tools/diag/nukeRestraint.ts <seed> <years> [from.bin | new] [out = .cache/nukeRestraint_<seed>.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { dayIndustry, NUKE_FLOOR, restraintOf, warheadsOf, type Restraint } from '../../src/sim/systems/nuclear';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 20);
const from = process.argv[4] ?? 'new';
const outPath = process.argv[5] ?? `.cache/nukeRestraint_${seed}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
if (from !== 'new') sim.load(new Uint8Array(readFileSync(from)));
const w = sim.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const r3 = (v: number): number => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v);
const startDay = Math.floor(w.tick / 24);

type Row = { holder: string; war: number; enemies: string[]; warheads: number; days: number; reasons: Record<string, number>; nearest: Record<string, unknown> | null; firstDay: number; lastDay: number };
const rows = new Map<string, Row>();
const peace = new Map<string, { days: number; warheads: number }>();
const decisions: { day: number; n: string; u: number }[] = [];
const bursts: { day: number; n: string }[] = [];
const partsOf = (r: Restraint): Record<string, unknown> => ({ reason: r.reason, by: r.by ? tag(r.by) : null, u: r3(r.u), value: r3(r.value), gain: r3(r.gain), retaliation: r3(r.retaliation), alliance: r3(r.alliance), outrage: r3(r.outrage), taboo: r3(r.taboo), desperation: r3(r.desperation), doctrine: r3(r.doctrine), through: r3(r.through), at: [r3(r.x), r3(r.y)] });

for (let d = 0; d < years * 365; d++) {
  sim.step(24, (ww) => {
    const ev = ww.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 1] === EventKind.NukeDecided) decisions.push({ day: Math.floor(ev[i]! / 24), n: tag(ev[i + 2]!), u: ev[i + 3]! / 1000 });
      if (ev[i + 1] === EventKind.NukeDetonated) bursts.push({ day: Math.floor(ev[i]! / 24), n: tag(ev[i + 2]!) });
    }
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  if (w.warheads.size === 0) continue;
  const day = Math.floor(w.tick / 24);
  const industry = dayIndustry(w);
  for (const n of [...w.warheads.keys()].sort((a, b) => a - b)) {
    const k = warheadsOf(w, n);
    if (k < 1 || w.nations.cols.living[n] !== 1) continue;
    let atWar = false;
    for (const war of w.wars.list) {
      const side = war.sides[0].includes(n) ? 0 : war.sides[1].includes(n) ? 1 : -1;
      if (side < 0) continue;
      atWar = true;
      const r = restraintOf(w, n, war, side, industry);
      const key = `${tag(n)}:${war.id}`;
      let row = rows.get(key);
      if (!row) rows.set(key, (row = { holder: tag(n), war: war.id, enemies: [], warheads: 0, days: 0, reasons: {}, nearest: null, firstDay: day, lastDay: day }));
      row.enemies = war.sides[1 - side]!.map(tag);
      row.warheads = Math.max(row.warheads, k);
      row.days++;
      row.lastDay = day;
      row.reasons[r.reason] = (row.reasons[r.reason] ?? 0) + 1;
      if (Number.isFinite(r.u) && (row.nearest === null || r.u > (row.nearest.u as number))) row.nearest = { day, warDays: Math.floor((w.tick - war.startTick) / 24), ...partsOf(r) };
    }
    if (!atWar) {
      const p = peace.get(tag(n)) ?? { days: 0, warheads: 0 };
      p.days++;
      p.warheads = Math.max(p.warheads, k);
      peace.set(tag(n), p);
    }
  }
  if (d % 365 === 364) process.stderr.write(`seed ${seed} year ${(d + 1) / 365}: decisions ${decisions.length}\n`);
}

// Per holder: its war-days by reason over all its wars, and its nearest day.
const holders = new Map<string, { warDays: number; reasons: Record<string, number>; nearest: Record<string, unknown> | null; wars: number; warheads: number }>();
for (const row of rows.values()) {
  const h = holders.get(row.holder) ?? { warDays: 0, reasons: {}, nearest: null, wars: 0, warheads: 0 };
  h.warDays += row.days;
  h.wars++;
  h.warheads = Math.max(h.warheads, row.warheads);
  for (const [k, v] of Object.entries(row.reasons)) h.reasons[k] = (h.reasons[k] ?? 0) + v;
  if (row.nearest && (h.nearest === null || (row.nearest.u as number) > (h.nearest.u as number))) h.nearest = { war: row.war, enemies: row.enemies, ...row.nearest };
  holders.set(row.holder, h);
}
const out = { seed, from, startDay, years, floor: NUKE_FLOOR, decisions, bursts, holders: Object.fromEntries(holders), peace: Object.fromEntries(peace), wars: [...rows.values()].sort((a, b) => b.days - a.days) };
writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(`done: seed ${seed} decisions ${decisions.length} bursts ${bursts.length} holders ${holders.size}`);
for (const [h, v] of holders) console.log(`  ${h} (${v.warheads} warheads) war-days ${v.warDays} in ${v.wars} wars:`, JSON.stringify(v.reasons), 'nearest', JSON.stringify(v.nearest));
