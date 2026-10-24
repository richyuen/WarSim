/**
 * PLAN 7.106's measure: how the wars of founded nations end. From a saved state, each war with a
 * founded nation (origin ≠ 0) as a side's leader is read every tick; when it ends, its last
 * state (score from the founded side, days, exhaustion of both sides, days without a front, the
 * other side's leader and whether that is a nation of the start) and what became of the founded
 * nation (alive, a puppet, gone). The reason read from the last state as `peaceSystem` decides:
 * days ≥ MAX_WAR_DAYS, frontless ≥ FRONTLESS_DAYS, a side exhausted, else a capitulation or a
 * broke leader.
 *
 * Usage: npx tsx tools/diag/rebelPeace.ts <seed> <in.bin> <days> <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { EventKind } from '../../src/shared/events';
import { EXHAUSTED, FRONTLESS_DAYS, MAX_WAR_DAYS, WHITE_PEACE } from '../../src/sim/systems/war';

const [seedS, bin, daysS, out] = process.argv.slice(2);
const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const w = s.world;
interface Last {
  id: number;
  rebel: number;
  side: number;
  enemy: number;
  enemyFounded: boolean;
  score: number;
  days: number;
  exh: [number, number];
  frontless: number;
  rebelKm2: number;
  enemyBroke: boolean;
  enemyKm2: number;
  rebelHeld: number;
  enemyHeld: number;
}
const kindName = new Map<number, string>(Object.entries(EventKind).map(([k, v]) => [v as number, k]));
const watched = new Set<number>([EventKind.PeaceSigned, EventKind.WarEnded, EventKind.PuppetCreated, EventKind.NationAnnexed, EventKind.NationEliminated, EventKind.AllianceJoined ?? -1, EventKind.UnionFormed ?? -1].filter((k) => k >= 0));
let tickEvents: string[] = [];
const open = new Map<number, Last>();
const ended: (Last & { reason: string; after: string; white: boolean; endDay: number; enemyGold: number; rebelGold: number; events: string[] })[] = [];
for (let day = 0; day < Number(daysS); day++) {
  for (let h = 0; h < 24; h++) {
    tickEvents = [];
    s.step(1, (ww) => {
      const e = ww.out.events;
      for (let i = 0; i < e.length; i += 6) if (watched.has(e[i + 1]!)) tickEvents.push(`${kindName.get(e[i + 1]!)}:${e[i + 2]}:${e[i + 3]}`);
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    const nc = w.nations.cols;
    const now = new Set<number>();
    const land = w.wars.list.length > 0 ? w.landCounts() : null;
    for (const war of w.wars.list) {
      for (const side of [0, 1]) {
        const r = war.sides[side]![0]!;
        if (!w.nations.has(r) || nc.origin[r] === 0) continue;
        const enemy = war.sides[1 - side]![0]!;
        now.add(war.id);
        open.set(war.id, { id: war.id, rebel: r, side, enemy, enemyFounded: w.nations.has(enemy) && nc.origin[enemy] !== 0, score: side === 0 ? war.score : -war.score, days: (w.tick - war.startTick) / 24, exh: [war.exhaustion[side]!, war.exhaustion[1 - side]!], frontless: war.frontless ?? 0, rebelKm2: land!.owned[r] ?? 0, enemyBroke: nc.gold[enemy]! < 0 || nc.bankrupt[enemy] === 1, enemyKm2: land!.owned[enemy] ?? 0, rebelHeld: land!.occupied.get(enemy * 65536 + r) ?? 0, enemyHeld: land!.occupied.get(r * 65536 + enemy) ?? 0 });
      }
    }
    for (const [id, l] of open) {
      if (now.has(id)) continue;
      open.delete(id);
      const reason = l.days >= MAX_WAR_DAYS - 1 ? 'maxDays' : l.frontless >= FRONTLESS_DAYS - 1 ? 'frontless' : l.exh[0] >= EXHAUSTED || l.exh[1] >= EXHAUSTED ? 'exhausted' : 'capitulation/broke';
      const after = nc.living[l.rebel] !== 1 || nc.origin[l.rebel] === 0 ? 'gone' : nc.overlord[l.rebel] !== 0 ? 'puppet' : 'free';
      ended.push({ ...l, reason, after, white: Math.abs(l.score) < WHITE_PEACE, endDay: w.tick / 24, enemyGold: Math.round(nc.gold[l.enemy] ?? 0), rebelGold: Math.round(nc.gold[l.rebel] ?? 0), events: tickEvents.filter((t) => t.includes(`:${l.rebel}`) || t.includes(`:${l.enemy}`)) });
    }
  }
}
writeFileSync(out!, JSON.stringify(ended, null, 1));
console.log(`done: ${seedS} ${ended.length} wars of founded nations ended`);
