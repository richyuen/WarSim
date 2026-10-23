/**
 * PLAN 7.82d, read first: why the holders at peace (the United States, Canada, Denmark) are not
 * picked as a war's target. From 1938, over years FROM–TO, at each day's start (the state the
 * strategic AI reads), for every actor of that day (`strategicAi`'s: living, AI on, no overlord,
 * day + id ≡ 0 mod STAGGER) and every holder H:
 * - whether the actor could reach H: a land neighbour (`neighbourMap`, the war choice's only
 *   targets), or by sea: the actor has a transport group (room > 0) on a water (`waterKeys`) where
 *   H holds a port (`planLanding`'s reach, which has no km limit);
 * - the gate it fell at for H: its own (in MAX_WARS wars, pacifist, broke), a refusal
 *   (`whyNotWar`: allied, truce, …), not a neighbour, the utility under DECLARE_AT, or H not its
 *   best; and the utility on H by term (`warUtility`), against its best target's;
 * - per H and year: days at war, enemies, cells at the year's end.
 * A checkpoint at the start of year FROM is kept in `.cache/hold82d/` and loaded when there.
 *
 * Usage: npx tsx tools/diag/warChoice.ts <seed> <from year> <to year> <out.json> [any]
 * (`any`: a transport group anywhere counts as lift; by default only one at a port of its own)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Refusal } from '../../src/shared/commands';
import { DECLARE_AT, MAX_WARS, PACIFIST_BELOW, STAGGER, neighbourMap, restlessOf, sides, strengths, warUtility, warsOf } from '../../src/sim/ai/strategic';
import { transportGroupsAtPort, transportRoom } from '../../src/sim/systems/amphibious';
import { keyAt, waterKeys } from '../../src/sim/systems/navalCombat';
import { whyNotWar } from '../../src/sim/systems/war';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { portSeaOf, seaOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const from = Number(process.argv[3] ?? 8);
const to = Number(process.argv[4] ?? 26);
const out = process.argv[5] ?? `.cache/warChoice_${seed}.json`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;
const HOLDERS = ['USA', 'CAN', 'DEN'].map((t) => TAGS_1938.indexOf(t) + 1);
const clear = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
mkdirSync('.cache/hold82d', { recursive: true });
const ckpt = `.cache/hold82d/${seed}_y${from - 1}.bin`;
if (existsSync(ckpt)) s.load(new Uint8Array(readFileSync(ckpt)));
else {
  s.step(24 * 365 * (from - 1), clear);
  writeFileSync(ckpt, s.save());
}

type Tally = Record<string, number>;
const bump = (t: Tally, k: string, by = 1): void => void (t[k] = (t[k] ?? 0) + by);
type Row = {
  warDays: number;
  enemies: Tally;
  cells: number;
  /** Actor turns by reach (land / sea / none) and the gate it fell at for H. */
  gates: Tally;
  /** Per reaching actor (land or sea): turns, refusals, best utility on H with its terms, and its own best target's. */
  actors: Record<string, { reach: string; turns: number; refused: Tally; maxU: number; terms: Record<string, number>; overAt: number; beatsBest: number; noLandOver: number; ownBest: Tally }>;
};
const fresh = (): Row => ({ warDays: 0, enemies: {}, cells: 0, gates: {}, actors: {} });
const refusalName = (r: Refusal): string => Object.entries(Refusal).find(([, v]) => v === r)?.[0] ?? String(r);

/**
 * The water keys where nation n has a transport group with room: `PORT` true, as `planLanding`
 * reads it (`transportGroupsAtPort`: at a port n holds, not moving, not engaged); false, anywhere.
 */
const PORT = process.argv[6] !== 'any';
function liftKeys(n: number): Set<number> {
  const keys = waterKeys(w, n);
  const c = w.formations.cols;
  const out = new Set<number>();
  if (PORT) {
    for (const g of transportGroupsAtPort(w, n)) out.add(keyAt(w, keys, c.x[g.fleet]!, c.y[g.fleet]!));
    return out;
  }
  w.formations.forEach((id) => {
    if (c.nation[id] !== n || !w.isFleet(id) || transportRoom(w, id) <= 0) return;
    out.add(keyAt(w, keys, c.x[id]!, c.y[id]!));
  });
  return out;
}

/** Whether H holds a port on a water whose key (n's `waterKeys`) is in `lift`. */
function portOn(n: number, h: number, lift: Set<number>): boolean {
  if (lift.size === 0) return false;
  const keys = waterKeys(w, n);
  const z = seaOf(w);
  const water = portSeaOf(w);
  const ctl = w.cells.controller;
  return w.ports.some((p, i) => ctl[p.cell] === h && water[i]! >= 0 && z.zoneOf[water[i]!]! !== 0 && z.closed[z.zoneOf[water[i]!]!] !== 1 && lift.has(keys[z.zoneOf[water[i]!]!]!));
}

let rows = new Map<number, Row>();
function readDay(): void {
  const day = w.tick / 24;
  const nc = w.nations.cols;
  const actors: number[] = [];
  w.nations.forEach((n) => {
    if (nc.living[n] === 1 && nc.aiOff[n] !== 1 && nc.overlord[n] === 0 && (day + n) % STAGGER === 0) actors.push(n);
  });
  if (actors.length === 0) return;
  const nb = neighbourMap(w);
  const str = strengths(w);
  const { withAllies, defence } = sides(w, str);
  for (const n of actors) {
    const neighbours = [...(nb.get(n) ?? [])].sort((a, b) => a - b);
    const wars = warsOf(w, n);
    const own = wars >= MAX_WARS ? 'maxWars' : nc.aggression[n]! < PACIFIST_BELOW ? 'pacifist' : nc.gold[n]! < 0 || nc.bankrupt[n] === 1 ? 'broke' : '';
    const attack = withAllies(n);
    const restless = wars === 0 ? restlessOf(w, n) : 0;
    let best = 0;
    let bestU = DECLARE_AT;
    for (const t of neighbours) {
      if (whyNotWar(w, n, t) !== Refusal.None) continue;
      const u = warUtility(w, n, t, attack, defence(t), wars, restless).u;
      if (u > bestU) [bestU, best] = [u, t];
    }
    let lift: Set<number> | null = null;
    for (const h of HOLDERS) {
      if (n === h) continue;
      const r = rows.get(h)!;
      const land = neighbours.includes(h);
      if (!land) lift ??= liftKeys(n);
      const reach = land ? 'land' : portOn(n, h, lift!) ? 'sea' : 'none';
      if (reach === 'none') {
        bump(r.gates, 'none');
        continue;
      }
      const why = whyNotWar(w, n, h);
      const u = warUtility(w, n, h, attack, defence(h), wars, restless);
      const a = (r.actors[tag(n)] ??= { reach, turns: 0, refused: {}, maxU: -Infinity, terms: {}, overAt: 0, beatsBest: 0, noLandOver: 0, ownBest: {} });
      a.reach = reach === 'land' || a.reach === 'land' ? 'land' : 'sea';
      a.turns++;
      bump(a.ownBest, best === 0 ? '-' : tag(best));
      let gate: string;
      if (own) gate = own;
      else if (why !== Refusal.None) {
        gate = `refused:${refusalName(why)}`;
        bump(a.refused, refusalName(why));
      } else if (u.u <= DECLARE_AT) gate = 'underAt';
      else if (!land) gate = u.u > bestU ? 'notNeighbour(wouldPick)' : 'notNeighbour(notBest)';
      else gate = u.u > bestU || best === h ? 'picked' : 'notBest';
      bump(r.gates, `${reach}:${gate}`);
      if (why === Refusal.None) {
        if (u.u > a.maxU) {
          a.maxU = u.u;
          a.terms = { strength: u.strength, opportunity: u.opportunity, claim: u.claim, exhaustion: -u.exhaustion, wars: -u.wars, restless: u.restless, pariah: u.pariah, aggression: nc.aggression[n]!, ratio: attack / defence(h) };
        }
        if (u.u > DECLARE_AT) a.overAt++;
        if (u.u > bestU) a.beatsBest++;
        // Over the bar with no land target over it, and the actor free to declare (the narrow rule's case).
        if (!own && u.u > DECLARE_AT && best === 0) a.noLandOver++;
      }
    }
  }
}

const years: Record<number, Record<string, Row>> = {};
for (let y = from; y <= to; y++) {
  rows = new Map(HOLDERS.map((h) => [h, fresh()]));
  for (let d = 0; d < 365; d++) {
    readDay();
    s.step(24, clear);
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
  for (const h of HOLDERS) years[y]![tag(h)] = rows.get(h)!;
  const line = HOLDERS.map((h) => {
    const r = rows.get(h)!;
    const sea = Object.values(r.actors).filter((a) => a.reach === 'sea').length;
    const land = Object.values(r.actors).filter((a) => a.reach === 'land').length;
    const top = Object.entries(r.actors)
      .filter(([, a]) => Number.isFinite(a.maxU))
      .sort((p, q) => q[1].maxU - p[1].maxU)[0];
    return `${tag(h)} war ${r.warDays}d cells ${r.cells} reach land ${land} sea ${sea} maxU ${top ? `${top[0]} ${top[1].maxU.toFixed(2)}` : '-'}`;
  }).join(' | ');
  process.stdout.write(`year ${y}: ${line}\n`);
  writeFileSync(out, JSON.stringify({ seed, from, to, years }, null, 1));
}
process.stdout.write(`done: ${seed} ${from}-${to} -> ${out}\n`);
