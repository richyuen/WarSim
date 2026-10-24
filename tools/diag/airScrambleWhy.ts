/**
 * PLAN 7.101's read: why a sweep over a manned enemy airbase meets no defender. Hourly, for each
 * fighter sortie over its target (`Leg.Over`) whose wing's mission is a patrol over an airbase held by
 * a nation at war with it (PLAN 7.99's sweep): the wings of nations at war with the sweeper based on
 * that airbase, each once, by class and state: aloft (a sortie, its own mission's or a scramble's),
 * with a mission on the ground (turning round or waiting its relay), idle (no mission, no sortie), and
 * of a nation with its AI off. Also whether a battle (`AirBattle`) fell within INTERCEPT_KM of the
 * sweep that hour.
 *
 * Usage: npx tsx tools/diag/airScrambleWhy.ts <seed> <years> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { INTERCEPT_KM } from '../../src/sim/systems/airCombat';
import { loopW } from '../../src/sim/systems/elements';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { Leg, sortieAt } from '../../src/sim/systems/sorties';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 5);
const out = process.argv[4] ?? `.cache/airScrambleWhy_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const cls = (w: World, id: number): string => w.rules!.units[w.rules!.templates[w.formations.cols.template[id]!]!.elements[0]!.unit]!.cls;
const tally: Record<string, number> = {};
const add = (k: string, n = 1): void => void (tally[k] = (tally[k] ?? 0) + n);
const baseAt = new Map<string, number>();
for (let y = 1; y <= years; y++) {
  for (let h = 0; h < 365 * 24; h++) {
    let battles: { x: number; y: number }[] = [];
    s.step(1, (w) => {
      const ev = w.out.events;
      battles = [];
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.AirBattle) battles.push({ x: ev[i + 4]!, y: ev[i + 5]! });
      w.out.events.length = 0;
      w.out.fires.length = 0;
    });
    if (y < 2) continue;
    const w = s.world;
    if (baseAt.size === 0) w.airbases.forEach((b, i) => baseAt.set(w.cellPoint(b.cell).join(','), i + 1));
    const c = w.formations.cols;
    let onBase: Map<number, number[]> | null = null;
    for (const [id, so] of w.sorties) {
      const m = w.wingMission.get(id);
      if (!m || m.kind !== 'patrol' || cls(w, id) !== 'fighter') continue;
      const base = baseAt.get(`${m.x},${m.y}`);
      if (!base) continue;
      const n = c.nation[id]!;
      if (!w.wars.atWar(n, w.cells.controller[w.airbases[base - 1]!.cell]!)) continue;
      const p = sortieAt(so, w.tick, loopW(w));
      if (p.leg !== Leg.Over) continue;
      add('sweepHours');
      if (battles.some((b) => seaKm(w, b.x, b.y, p.x, p.y) <= INTERCEPT_KM)) add('sweepHoursFought');
      if (!onBase) {
        onBase = new Map();
        for (const [o, b] of w.wingBase) if (b > 0 && w.formations.has(o)) (onBase.get(b) ?? onBase.set(b, []).get(b)!).push(o);
      }
      const foes = (onBase.get(base) ?? []).filter((o) => w.wars.atWar(n, c.nation[o]!));
      if (foes.length === 0) add('base: no enemy wing (left since the order)');
      let anyFighter = false;
      for (const o of foes) {
        const k = cls(w, o);
        const st = w.nations.cols.aiOff[c.nation[o]!] === 1 ? 'AI off' : w.sorties.has(o) ? (w.wingMission.has(o) ? 'aloft on its mission' : 'aloft, scrambled') : w.wingMission.has(o) ? 'on the ground with a mission' : 'idle';
        add(`wing ${k === 'fighter' ? 'fighter' : 'other'}: ${st}`);
        if (k === 'fighter') anyFighter = true;
      }
      if (foes.length > 0 && !anyFighter) add('base: enemy wings, no fighter');
    }
  }
  process.stderr.write(`${seed} year ${y}: ${JSON.stringify(tally)}\n`);
}
writeFileSync(out, JSON.stringify({ seed, years, tally }, null, 1));
console.log(`done: ${seed} ${JSON.stringify(tally)}`);
