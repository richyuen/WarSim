/**
 * PLAN 7.35d2d3c: does a nation's landing sail and land (`measure-d.md` §9 and §10: seed 1471's US
 * fleets took up the same landing water 25 AI days at each of four Caribbean ports in year 3)?
 * From `fromYear` to `toYear`, every `FormationEmbarked`, `FormationLanded` and `LandingRepulsed` of
 * the nation, and each day (01:00, when it changes) what it has aboard, on which transports, under
 * way or not, for which water.
 * Usage: npx tsx tools/diag/seaLandings.ts <seed> <tag> <fromYear> <toYear>
 */
import { EventKind } from '../../src/shared/events';
import { size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2] ?? 1471);
const tagName = process.argv[3] ?? 'USA';
const from = Number(process.argv[4] ?? 3);
const to = Number(process.argv[5] ?? 3);
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const N = TAGS_1938.indexOf(tagName) + 1;
sim.step(24 * 365 * (from - 1), (w) => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
});
const tally: Record<string, number> = {};
const bump = (k: string): void => void (tally[k] = (tally[k] ?? 0) + 1);
let lastDay = '';
sim.step(24 * 365 * (to - from + 1), (w) => {
  const ev = w.out.events;
  const W = w.cells.w;
  const day = (w.tick / 24).toFixed(1);
  for (let i = 0; i < ev.length; i += 6) {
    const k = ev[i + 1]!;
    if (k !== EventKind.FormationEmbarked && k !== EventKind.FormationLanded && k !== EventKind.LandingRepulsed) continue;
    const id = ev[i + 2]!;
    const n = w.formations.has(id) ? w.formations.cols.nation[id]! : k === EventKind.LandingRepulsed ? -1 : ev[i + 3]!;
    if (n !== N && ev[i + 3] !== N) continue;
    const name = k === EventKind.FormationEmbarked ? 'embarked' : k === EventKind.FormationLanded ? 'landed' : 'repulsed';
    const cell = Math.floor(ev[i + 5]!) * W + Math.floor(ev[i + 4]!);
    const ctl = w.cells.controller[cell] ?? 0;
    bump(name);
    console.log(`day ${day} ${name} f${id} at (${ev[i + 4]!.toFixed(0)},${ev[i + 5]!.toFixed(0)}) held by ${ctl ? tag(ctl) : '-'}`);
  }
  ev.length = 0;
  w.out.fires.length = 0;
  if (w.tick % 24 === 1) {
    const c = w.formations.cols;
    const mine = [...w.embarked].filter(([id]) => c.nation[id] === N);
    const fleets = new Set(mine.map(([, e]) => e.fleet));
    const s = [...fleets].map((f) => `fleet ${f} ${c.moving[f] === 1 ? 'moving' : 'still'} at (${c.x[f]!.toFixed(0)},${c.y[f]!.toFixed(0)}) water (${mine.find(([, e]) => e.fleet === f)![1].water % W},${Math.floor(mine.find(([, e]) => e.fleet === f)![1].water / W)})`).join('; ');
    const line = `${mine.length} aboard: ${s}`;
    if (line !== lastDay) console.log(`day ${day} ${line}`);
    lastDay = line;
    bump(mine.length > 0 ? 'daysAboard' : 'daysNone');
  }
});
console.log('done:', JSON.stringify(tally));
