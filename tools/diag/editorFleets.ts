/**
 * PLAN 7.41c: what the editor's fleets do (critic run 11, `critic/c11_g_4877.json`: two German and two
 * British battle squadrons placed face to face in the North Sea, "no battle in 30 days" read from
 * `hud.seaBattles` at days 3, 10 and 30). Loads a `.warsim-scenario` file, gives the critic's commands
 * (Germany declares war on Poland, then on Britain), steps hour by hour and records: every sea battle
 * any of the editor's fleets is in (its first and last hour, its fleets' nations, ships lost each
 * side), each editor fleet's fate (sunk in a battle, laid up or disbanded, or living, where), every
 * sea battle between the two navies' blocs, and the sea battles standing at the critic's sample hours.
 * The editor's fleets are each nation's last `per` fleets by id (the editor appends them).
 *
 * Usage: npx tsx tools/diag/editorFleets.ts <file.warsim-scenario> [days = 30] [A = GER] [D = ENG] [per = 2] [pre = POL] [out]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { decodeScenarioFile } from '../../src/shared/scenarioFile';
import { size1938, TAGS_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { keyAt, seaKm, waterKeys } from '../../src/sim/systems/navalCombat';
import { fleetPower, navalPower } from '../../src/sim/systems/seaControl';
import { blocOf } from '../../src/sim/systems/supply';
import { SORTIE_KM, standingWarfleets } from '../../src/sim/ai/naval';
import { STAGGER } from '../../src/sim/ai/strategic';
import { seaOf, type World } from '../../src/sim/world';

const file = process.argv[2]!;
const days = Number(process.argv[3] ?? 30);
const A = process.argv[4] ?? 'GER';
const D = process.argv[5] ?? 'ENG';
const per = Number(process.argv[6] ?? 2);
const pre = process.argv[7] ?? 'POL';
const out = process.argv[8] ?? `.cache/editorFleets_${A}_${D}.json`;

const { header, bytes } = await decodeScenarioFile(new Uint8Array(readFileSync(file)));
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed: 1, assets: loadAssets1938(SZ.w) });
sim.load(bytes);
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const id = (t: string): number => TAGS_1938.indexOf(t) + 1;
const nA = id(A);
const nD = id(D);
if (pre !== '-') sim.command({ kind: 'declareWar', attacker: nA, defender: id(pre) });
sim.command({ kind: 'declareWar', attacker: nA, defender: nD });

const nearestPort = (w: World, x: number, y: number): string => {
  let best = { name: '', km: Infinity };
  for (const p of w.ports) {
    const km = seaKm(w, x, y, p.x, p.y);
    if (km < best.km) best = { name: `${p.name}(${tag(w.cells.controller[p.cell]!)})`, km };
  }
  return `${best.name} ${Math.round(best.km)} km`;
};

type Fleet = { id: number; nation: string; tpl: string; power0: number; at0: string; fate: string; tick?: number; at?: string; power?: number; battles: number; closest?: { km: number; hour: number; foe: string } };
const editor: Fleet[] = [];
const battles: { first: number; last: number; fleets: string[]; a: string; b: string; lostA: number; lostB: number; at: string; editor: boolean }[] = [];
const open = new Map<object, (typeof battles)[number]>();
const samples: { day: number; standing: number; editorIn: number }[] = [];
/** PLAN 7.59, measured first: each living editor fleet each day at 00:00, its nearest standing enemy warfleet and the battle test `awayOrder` applies (the zone's enemy power no more than its nation's warfleets within SORTIE_KM together). */
const daily: { day: number; id: number; aiDay: boolean; standing: boolean; offPlace: number; placeZone: number; foe?: string; km?: number; foeZone?: number; sameZone?: boolean; sameWaters?: boolean; enemy?: number; together?: number; placedTogether?: number; takes?: boolean }[] = [];
const last = new Map<number, { x: number; y: number; engaged: boolean; moving: boolean; power: number }>();
let t0 = -1;

sim.step(1, (w) => {
  t0 = w.tick - 1;
  const c = w.formations.cols;
  for (const n of [nA, nD]) {
    const mine: number[] = [];
    w.formations.forEach((f) => {
      if (w.isFleet(f) && c.nation[f] === n) mine.push(f);
    });
    for (const f of mine.sort((a, b) => a - b).slice(-per)) {
      editor.push({ id: f, nation: tag(n), tpl: TEMPLATES_1938[c.template[f]!]?.id ?? String(c.template[f]), power0: Math.round(fleetPower(w, f)), at0: nearestPort(w, c.x[f]!, c.y[f]!), fate: 'living', battles: 0 });
    }
  }
});

const isEditor = new Set(editor.map((e) => e.id));
const blocSides = (w: World, n: number): number => (w.wars.atWar(n, nD) ? 1 : w.wars.atWar(n, nA) ? 2 : 0);

for (let h = 1; h < days * 24; h++) {
  sim.step(1, (w) => {
    const c = w.formations.cols;
    const hour = w.tick - t0;
    for (const b of w.seaBattles) {
      const ed = b.fleets.some((f) => isEditor.has(f));
      const pair = (blocSides(w, b.a) === 1 && blocSides(w, b.b) === 2) || (blocSides(w, b.a) === 2 && blocSides(w, b.b) === 1);
      if (!ed && !pair) continue;
      let r = open.get(b);
      if (!r) {
        r = { first: hour, last: hour, fleets: [], a: tag(b.a), b: tag(b.b), lostA: 0, lostB: 0, at: nearestPort(w, b.x, b.y), editor: ed };
        open.set(b, r);
        battles.push(r);
        for (const e of editor) if (b.fleets.includes(e.id)) e.battles++;
      }
      r.last = hour;
      r.editor ||= ed;
      r.lostA = b.lostA;
      r.lostB = b.lostB;
      r.fleets = b.fleets.map((f) => `${f}:${w.formations.has(f) ? tag(c.nation[f]!) : '?'}${isEditor.has(f) ? '*' : ''}`);
    }
    for (const e of editor) {
      if (e.fate !== 'living') continue;
      const alive = w.formations.has(e.id) && w.isFleet(e.id);
      const prev = last.get(e.id);
      if (!alive) {
        e.fate = prev?.engaged ? 'sunk in battle' : 'gone (laid up or disbanded)';
        e.tick = hour;
        e.at = prev ? nearestPort(w, prev.x, prev.y) : '';
        if (prev) e.power = prev.power;
        continue;
      }
      for (const g of w.formations.ids()) {
        if (!w.isFleet(g) || !w.wars.atWar(c.nation[g]!, c.nation[e.id]!)) continue;
        const km = Math.round(seaKm(w, c.x[e.id]!, c.y[e.id]!, c.x[g]!, c.y[g]!));
        if (!e.closest || km < e.closest.km) e.closest = { km, hour, foe: `${g}:${tag(c.nation[g]!)}` };
      }
      last.set(e.id, { x: c.x[e.id]!, y: c.y[e.id]!, engaged: c.engaged[e.id] === 1, moving: c.moving[e.id] === 1, power: Math.round(fleetPower(w, e.id)) });
    }
    if (hour % 24 === 0) {
      const z = seaOf(w);
      const ww = w.cells.w;
      const power = navalPower(w);
      const prey = standingWarfleets(w);
      for (const e of editor) {
        if (!w.formations.has(e.id) || !w.isFleet(e.id)) continue;
        const n = c.nation[e.id]!;
        const st = w.station.get(e.id);
        const bloc = blocOf(w, n);
        const keys = waterKeys(w, n);
        const zoneAtXY = (x: number, y: number): number => z.zoneOf[Math.floor(y) * ww + Math.floor(x)]!;
        const placeZone = st ? zoneAtXY(st[0], st[1]) : -1;
        const r: (typeof daily)[number] = { day: hour / 24, id: e.id, aiDay: (Math.floor(w.tick / 24) + n) % STAGGER === 0, standing: c.moving[e.id] !== 1 && c.engaged[e.id] !== 1, offPlace: st ? Math.round(Math.max(Math.abs(c.x[e.id]! - st[0]), Math.abs(c.y[e.id]! - st[1]))) : -1, placeZone };
        let best = Infinity;
        for (const q of prey) {
          if (!w.wars.atWar(n, q.nation)) continue;
          const km = seaKm(w, c.x[e.id]!, c.y[e.id]!, (q.at % ww) + 0.5, Math.floor(q.at / ww) + 0.5);
          if (km >= best) continue;
          best = km;
          let enemy = 0;
          for (const [b, p] of power.get(q.zone) ?? []) if (b !== bloc && w.wars.atWar(b, n)) enemy += p;
          let together = 0;
          let placedTogether = 0;
          w.formations.forEach((g) => {
            if (!w.isFleet(g) || c.nation[g] !== n || c.moving[g] === 1 || c.engaged[g] === 1) return;
            const p = fleetPower(w, g);
            if (p <= 0 || seaKm(w, c.x[g]!, c.y[g]!, (q.at % ww) + 0.5, Math.floor(q.at / ww) + 0.5) > SORTIE_KM) return;
            together += p;
            if (w.station.has(g)) placedTogether += p;
          });
          Object.assign(r, { foe: `${q.at}:${tag(q.nation)}`, km: Math.round(km), foeZone: q.zone, sameZone: q.zone === placeZone, sameWaters: keys[q.zone] === keyAt(w, keys, c.x[e.id]!, c.y[e.id]!), enemy: Math.round(enemy), together: Math.round(together), placedTogether: Math.round(placedTogether), takes: enemy <= together });
        }
        daily.push(r);
      }
    }
    if (hour % 24 === 0 && [3, 10, 30].includes(hour / 24)) {
      samples.push({ day: hour / 24, standing: w.seaBattles.length, editorIn: w.seaBattles.filter((b) => b.fleets.some((f) => isEditor.has(f))).length });
    }
  });
}
{
  const w = sim.world;
  const c = w.formations.cols;
  for (const e of editor) {
    if (e.fate !== 'living') continue;
    e.at = nearestPort(w, c.x[e.id]!, c.y[e.id]!);
    e.power = Math.round(fleetPower(w, e.id));
  }
}

const report = { file, name: header.name, days, A, D, pre, editor, editorBattles: battles.filter((b) => b.editor), pairBattles: battles.length, samples, daily, battles };
writeFileSync(out, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ editor, editorBattles: report.editorBattles, pairBattles: battles.length, samples }, null, 1));
console.log(`written ${out}`);
