/**
 * PLAN 7.144's read: what the air forces change on the ground, from one save stepped several ways.
 * Per save, `days` days from it, sampled at hour 12 of each day: the land formations (on land, of
 * living nations) engaged, those of nations at war, their men; wings of living nations; the
 * hour's strikes that hit (`AirStrike` with units taken) and the units they took; land formations
 * that ended (on land at hour 12, gone at the next); `attacking`, land formations of nations at war
 * moving to a cell held by an enemy; `hitIn` / `hitOut`, land formations struck in contact or out of it. One line per save and the means.
 *
 * The arm is the tree this runs in, and `AB_KEEP` (0..1, default 1): at load, each living nation
 * keeps that share of its wings (by id, the highest removed), the rest destroyed — the smaller air
 * force of the rule before ADR-736 on HEAD's world.
 *
 * Usage: npx tsx tools/diag/airGround.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { EventKind } from '../../src/shared/events';
import { destroyFormation } from '../../src/sim/systems/elements';
import { type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3] ?? 60);
const keep = Number(process.env.AB_KEEP ?? 1);
const assets = loadAssets1938(SIZE_1938.w);

type Row = { seed: number; aloft: number; engaged: number; attacking: number; hitIn: number; hitOut: number; atWarLand: number; atWarMen: number; wings: number; strikes: number; struck: number; ended: number; airBattles: number };
const rows: Row[] = [];
for (const a of process.argv.slice(4)) {
  const at = a.indexOf(':');
  const seed = Number(a.slice(0, at));
  const s = new Sim({ scenario: '1938', seed, assets });
  const w = s.world;
  s.load(new Uint8Array(readFileSync(a.slice(at + 1))));
  const c = w.formations.cols;
  if (keep < 1) {
    const byNation = new Map<number, number[]>();
    w.formations.forEach((id) => {
      if (!w.isWing(id) || w.nations.cols.living[c.nation[id]!] !== 1) return;
      const n = c.nation[id]!;
      let l = byNation.get(n);
      if (!l) byNation.set(n, (l = []));
      l.push(id);
    });
    for (const l of byNation.values()) {
      l.sort((x, y) => x - y);
      for (const id of l.slice(Math.round(l.length * keep))) destroyFormation(w, id);
    }
  }
  let strikes = 0;
  let struck = 0;
  let airBattles = 0;
  let hitIn = 0;
  let hitOut = 0;
  let aloft = 0;
  let hours = 0;
  const count = (ww: World): void => {
    aloft += ww.sorties.size;
    hours++;
    const ev = ww.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 1] === EventKind.AirStrike && ev[i + 3]! > 0) {
        strikes++;
        struck += ev[i + 3]!;
      } else if (ev[i + 1] === EventKind.AirBattle) airBattles++;
      else if (ev[i + 1] === EventKind.StrikeHit) {
        const g = ev[i + 2]!;
        if (ww.formations.has(g) && !ww.isFleet(g)) {
          if (ww.formations.cols.engaged[g] === 1) hitIn++;
          else hitOut++;
        }
      }
    }
    ev.length = 0;
    ww.out.fires.length = 0;
  };
  let engaged = 0;
  let atWarLand = 0;
  let atWarMen = 0;
  let wings = 0;
  let ended = 0;
  let attacking = 0;
  const ctl = w.cells.controller;
  for (let d = 0; d < days; d++) {
    s.step(12, count);
    const atWar = new Set(w.wars.nations());
    const before: number[] = [];
    w.formations.forEach((id) => {
      if (w.nations.cols.living[c.nation[id]!] !== 1) return;
      if (w.isWing(id)) {
        wings++;
        return;
      }
      if (w.isFleet(id) || w.offLand(id)) return;
      before.push(id);
      if (c.engaged[id] === 1) engaged++;
      if (atWar.has(c.nation[id]!)) {
        atWarLand++;
        atWarMen += c.strength[id]!;
        if (c.moving[id] === 1 && w.wars.atWar(c.nation[id]!, ctl[c.targetCell[id]!]!)) attacking++;
      }
    });
    s.step(12, count);
    for (const id of before) if (!w.formations.has(id)) ended++;
  }
  const r = (x: number): number => Math.round(x * 1000) / 1000;
  const row = { seed, aloft: r(aloft / Math.max(1, hours)), engaged: r(engaged / days), attacking: r(attacking / days), hitIn: r(hitIn / days), hitOut: r(hitOut / days), atWarLand: r(atWarLand / days), atWarMen: Math.round(atWarMen / days), wings: r(wings / days), strikes: r(strikes / days), struck: r(struck / days), ended: r(ended / days), airBattles: r(airBattles / days) };
  rows.push(row);
  process.stderr.write(JSON.stringify(row) + '\n');
}
const mean = (k: keyof Row): number => Math.round((rows.reduce((t, x) => t + x[k], 0) / Math.max(1, rows.length)) * 1000) / 1000;
const summary = Object.fromEntries((['aloft', 'engaged', 'attacking', 'hitIn', 'hitOut', 'atWarLand', 'atWarMen', 'wings', 'strikes', 'struck', 'ended', 'airBattles'] as const).map((k) => [k, mean(k)]));
process.stderr.write(`mean ${JSON.stringify(summary)}\n`);
writeFileSync(out, JSON.stringify({ keep, ab: process.env.AB ?? '', rows, summary }, null, 1));
