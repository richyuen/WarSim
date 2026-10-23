/**
 * PLAN 7.82b, read first: why the overseas holders (the United States, Canada, Denmark's Greenland,
 * Australia) keep their land for a decade or more, at war or not. From 1938, over years FROM–TO,
 * per year and holder H:
 * - days at war; its enemies by days;
 * - the invasion turns of its enemies by branch (`LANDING_PROBE.turn`: a landing aboard, the front
 *   not held, a Normandy ordered, the ferry's turn), and every landing and Normandy they planned
 *   past their transports (`LANDING_PROBE.plan`): with H among the enemies looked at or not, how it
 *   ended, on whose cell the target lay;
 * - for the plans that looked at H, how H's best place fared (`watched`): the tests its places
 *   failed, by count, and its best (a landing: the km to its nearest open port; a Normandy: its best
 *   city's score) against the pick's;
 * - the landings (`FormationLanded`) and those thrown back (`LandingRepulsed`) on H's cells; its
 *   cells at the year's end.
 * A checkpoint at the start of year FROM is kept in `.cache/hold82/` and loaded when there.
 *
 * Usage: npx tsx tools/diag/overseasHold.ts <seed> <from year> <to year> <out.json>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { LANDING_PROBE, type LandingPlan } from '../../src/sim/ai/invasion';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const from = Number(process.argv[3] ?? 1);
const to = Number(process.argv[4] ?? 30);
const out = process.argv[5] ?? `.cache/overseasHold_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;
const HOLDERS = ['USA', 'CAN', 'DEN', 'AST'].map((t) => TAGS_1938.indexOf(t) + 1);

type Tally = Record<string, number>;
const bump = (t: Tally, k: string, by = 1): void => void (t[k] = (t[k] ?? 0) + by);
type Row = {
  warDays: number;
  enemies: Tally;
  turns: Tally;
  plans: Tally;
  onH: Tally;
  elsewhere: Tally;
  failed: Tally;
  /** [H's best, the pick's], a landing's km or a Normandy's score, for plans that scored a place of H's. */
  versus: Record<string, [number, number][]>;
  landedOnH: Tally;
  repulsedOnH: Tally;
  cells: number;
};
const fresh = (): Row => ({ warDays: 0, enemies: {}, turns: {}, plans: {}, onH: {}, elsewhere: {}, failed: {}, versus: {}, landedOnH: {}, repulsedOnH: {}, cells: 0 });

let rows = new Map<number, Row>();
LANDING_PROBE.watch = new Set(HOLDERS);
LANDING_PROBE.turn = (n, branch): void => {
  for (const h of HOLDERS) {
    const r = rows.get(h);
    if (r && n !== h && w.wars.atWar(n, h)) bump(r.turns, branch);
  }
};
LANDING_PROBE.plan = (p: LandingPlan): void => {
  const ctl = p.target >= 0 ? w.cells.controller[p.target]! : 0;
  for (const h of HOLDERS) {
    if (p.nation === h || !w.wars.atWar(p.nation, h)) continue;
    const r = rows.get(h);
    if (!r) return;
    const looked = p.foes.includes(h) ? 'H' : 'notH';
    bump(r.plans, `${p.kind}:${looked}:${p.why}`);
    const seen = p.watched?.[h];
    if (seen) {
      for (const [k, v] of Object.entries(seen.failed)) bump(r.failed, `${p.kind}:${k}`, v);
      if (!Number.isNaN(seen.best)) (r.versus[p.kind] ??= []).push([seen.best, p.best ?? Number.NaN]);
    }
    if (p.target < 0) continue;
    if (ctl === h) bump(r.onH, `${p.kind}:${tag(p.nation)}:${p.why}`);
    else bump(r.elsewhere, `${p.kind}:${tag(ctl)}`);
  }
};

const clear = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
mkdirSync('.cache/hold82', { recursive: true });
const ckpt = `.cache/hold82/${seed}_y${from - 1}.bin`;
if (existsSync(ckpt)) s.load(new Uint8Array(readFileSync(ckpt)));
else {
  s.step(24 * 365 * (from - 1), clear);
  writeFileSync(ckpt, s.save());
}
const median = (a: number[]): number => {
  const b = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  return b.length ? b[Math.floor(b.length / 2)]! : Number.NaN;
};
const years: Record<number, Record<string, Row>> = {};
for (let y = from; y <= to; y++) {
  rows = new Map(HOLDERS.map((h) => [h, fresh()]));
  for (let d = 0; d < 365; d++) {
    s.step(24, (ww) => {
      const ev = ww.out.events;
      const W = ww.cells.w;
      for (let i = 0; i < ev.length; i += 6) {
        const k = ev[i + 1];
        if (k !== EventKind.FormationLanded && k !== EventKind.LandingRepulsed) continue;
        const cell = Math.floor(ev[i + 5]!) * W + Math.floor(ev[i + 4]!);
        const id = ev[i + 2]!;
        const n = k === EventKind.FormationLanded ? ev[i + 3]! : ww.formations.has(id) ? ww.formations.cols.nation[id]! : 0;
        for (const h of HOLDERS) {
          if (n === h) continue;
          const r = rows.get(h)!;
          if (k === EventKind.FormationLanded && (ww.cells.controller[cell] === h || ww.cells.owner[cell] === h)) bump(r.landedOnH, tag(n));
          // A landing thrown back is told by its water: the zone's holder is b; count it for H when H holds that sea.
          if (k === EventKind.LandingRepulsed && ev[i + 3] === h) bump(r.repulsedOnH, tag(n));
        }
      }
      clear(ww);
    });
    for (const h of HOLDERS) {
      const r = rows.get(h)!;
      let at = false;
      for (const war of w.wars.list) {
        const i = war.sides[0].includes(h) ? 0 : war.sides[1].includes(h) ? 1 : -1;
        if (i < 0) continue;
        at = true;
        for (const e of war.sides[1 - i]!) bump(r.enemies, tag(e));
      }
      if (at) r.warDays++;
    }
  }
  const ctl = w.cells.controller;
  for (let i = 0; i < ctl.length; i++) {
    const r = rows.get(ctl[i]!);
    if (r) r.cells++;
  }
  years[y] = {};
  for (const h of HOLDERS) {
    const r = rows.get(h)!;
    years[y]![tag(h)] = r;
    const sum = (t: Tally, f = (_k: string): boolean => true): number => Object.entries(t).filter(([k]) => f(k)).reduce((a, [, v]) => a + v, 0);
    const vs = Object.entries(r.versus)
      .map(([k, v]) => `${k} ${v.length}: H ${median(v.map((x) => x[0])).toPrecision(3)} vs pick ${median(v.map((x) => x[1])).toPrecision(3)}`)
      .join('; ');
    process.stderr.write(
      `${seed} year ${y} ${tag(h)}: cells ${r.cells}, war days ${r.warDays}; enemies' turns ${JSON.stringify(r.turns)}; plans ${sum(r.plans)} ` +
        `(H looked at ${sum(r.plans, (k) => k.includes(':H:'))}, aimed at H ${sum(r.onH)}); failed ${JSON.stringify(r.failed)}; ${vs}; ` +
        `landed on H ${sum(r.landedOnH)}, repulsed ${sum(r.repulsedOnH)}\n`,
    );
  }
}
writeFileSync(out, JSON.stringify({ seed, from, to, years }, null, 1));
console.log(`done: ${seed} ${out}`);
