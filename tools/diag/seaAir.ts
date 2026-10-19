/**
 * PLAN 7.35b3: how often a fleet is sunk from the air alone at a sortie's target (critic R9, naval
 * 6: the US Asiatic squadron sailed from Cavite to Takao on seed 3407, found no ship and was sunk by
 * Formosa's wings, `docs/evidence/7.35/measure-b.md` §2). The naval AI's sortie test (`plan` in
 * `src/sim/ai/naval.ts`) weighs the enemy's ships in the target's zone and no air.
 *
 * From 1938 (or a checkpoint; with `A` declaring war on `D` at once, or `-` for the world as it
 * runs), every day at 01:00 (an hour after the naval AI) each fleet with power under way gets its
 * order's kind by where it goes: `sortie` (the water of a port held by a nation at war with it),
 * `stage` (a port its bloc holds), `escort` (a landing's water), `other`. At a sortie's order: the
 * target port, the fleet's hit points, the enemy's ships in the zone (`navalPower`) and the enemy's
 * land-based anti-ship fire over the water: per strike, the hit points the wings based within their
 * range of it would take (Σ squadron aircraft × hard × `NAVAL_STRIKE_FIRE`, before armour and the
 * air's factor), all of them (`air`) and those of the naval role, the AI's that pick fleets first
 * (`navalAir`). Every hour after: whether the fleet was in a sea battle, struck by a land-based wing
 * (`StrikeHit`, its wing's base an airbase) or a carrier's, and its hit points lost by that hour's
 * kind (a sea battle's hour counts as sea). An order ends at the fleet's next order, its loss or the
 * run's end; its outcome is `airAlone` (lost, land-based strikes, no sea battle, no carrier's
 * strike), `sea` (lost after a sea battle), `mixed`, `other` (lost, neither), or `kept`. A fleet
 * with no order since it was seen counts as `none` (its port), so that the fleets sunk in port are
 * counted apart. Each 01:00 a sortied fleet stands at its target (`stands`): the same air over its
 * own place, its hit points and the enemy's ships in its zone (the wings come after the fleet).
 *
 * Usage: npx tsx tools/diag/seaAir.ts <seed> <days> [A D | - -] [save.bin | new] [out = .cache/seaAir_<seed>.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { size1938, TAGS_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { basePlace, wingRange } from '../../src/sim/systems/air';
import { NAVAL_STRIKE_FIRE } from '../../src/sim/systems/airCombat';
import { elementIndex } from '../../src/sim/systems/elements';
import { AT_PORT_CELLS, seaKm } from '../../src/sim/systems/navalCombat';
import { fleetPower, navalPower } from '../../src/sim/systems/seaControl';
import { blocOf } from '../../src/sim/systems/supply';
import { portSeaOf, seaOf, type World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const days = Number(process.argv[3] ?? 365);
const A = process.argv[4] ?? '-';
const D = process.argv[5] ?? '-';
const bin = process.argv[6] ?? 'new';
const out = process.argv[7] ?? `.cache/seaAir_${seed}${A === '-' ? '' : `_${A}_${D}`}.json`;
const SZ = size1938(undefined);
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SZ.w) });
if (bin !== 'new') sim.load(new Uint8Array(readFileSync(bin)));
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const idOf = (t: string): number => TAGS_1938.indexOf(t) + 1;
if (A !== '-') sim.command({ kind: 'declareWar', attacker: idOf(A), defender: idOf(D) });

type Kind = 'none' | 'sortie' | 'stage' | 'escort' | 'other';
type Order = {
  id: number;
  nation: string;
  tpl: string;
  kind: Kind;
  day: number;
  target: number;
  port: string;
  holder: string;
  km: number;
  hp: number;
  ships: number;
  enemyShips: number;
  air: number;
  navalAir: number;
  wings: string[];
  seaHours: number;
  landHits: number;
  carrierHits: number;
  unknownHits: number;
  lost: { sea: number; land: number; carrier: number; other: number };
  arrived: boolean;
  /** Each 01:00 it stood at its sortie's target: the land-based anti-ship fire over it, all and the naval role's, its hit points, the enemy's ships in its zone. */
  stands: { day: number; air: number; navalAir: number; hp: number; enemy: number }[];
  outcome: 'airAlone' | 'sea' | 'mixed' | 'other' | 'kept';
  endDay: number;
};
const open = new Map<number, Order>();
const done: Order[] = [];
const hpOf = new Map<number, number>();

/** Fleet `f`'s hit points: its live ships' strength × hit points per unit. */
const fleetHp = (w: World, f: number): number => {
  const units = w.rules!.units;
  const ec = w.elements.cols;
  let hp = 0;
  for (const e of elementIndex(w).get(f) ?? []) if (ec.strength[e]! > 0) hp += ec.strength[e]! * units[ec.unit[e]!]!.hpPerUnit;
  return hp;
};

const ROLE_NAVAL = 'naval_bomber';
/** The land-based anti-ship fire per strike of the nations at war with `n` over (x, y): all wings, those of the naval role, and their names. */
const airOver = (w: World, n: number, x: number, y: number): { air: number; navalAir: number; wings: string[] } => {
  const rules = w.rules!;
  const ec = w.elements.cols;
  const c = w.formations.cols;
  let air = 0;
  let navalAir = 0;
  const wings: string[] = [];
  for (const [wing, base] of [...w.wingBase].sort((a, b) => a[0] - b[0])) {
    if (base <= 0 || !w.formations.has(wing) || !w.wars.atWar(n, c.nation[wing]!)) continue;
    const at = basePlace(w, base);
    if (!at || seaKm(w, at[0], at[1], x, y) > wingRange(w, wing)) continue;
    let fire = 0;
    for (const e of elementIndex(w).get(wing) ?? []) fire += ec.strength[e]! * rules.units[ec.unit[e]!]!.hard * NAVAL_STRIKE_FIRE;
    if (fire <= 0) continue;
    const first = rules.templates[c.template[wing]!]?.elements[0];
    const naval = first !== undefined && rules.units[first.unit]!.cls === ROLE_NAVAL;
    air += fire;
    if (naval) navalAir += fire;
    wings.push(`${wing}:${tag(c.nation[wing]!)}:${TEMPLATES_1938[c.template[wing]!]?.id ?? c.template[wing]}:${Math.round(fire)}${naval ? ':naval' : ''}`);
  }
  return { air, navalAir, wings };
};

const close = (o: Order, day: number, lostWhole: boolean): void => {
  o.endDay = day;
  if (lostWhole) {
    const land = o.landHits > 0 || o.lost.land > 0;
    const sea = o.seaHours > 0;
    const carrier = o.carrierHits > 0;
    o.outcome = land && !sea && !carrier ? 'airAlone' : sea && !land && !carrier ? 'sea' : land || sea || carrier ? 'mixed' : 'other';
  }
  done.push(o);
};

const fresh = (w: World, id: number, kind: Kind, target: number): Order => {
  const c = w.formations.cols;
  const n = c.nation[id]!;
  const hp = fleetHp(w, id);
  return {
    id,
    nation: tag(n),
    tpl: TEMPLATES_1938[c.template[id]!]?.id ?? String(c.template[id]),
    kind,
    day: Math.round((w.tick / 24) * 10) / 10,
    target,
    port: '',
    holder: '',
    km: 0,
    hp: Math.round(hp),
    ships: 0,
    enemyShips: 0,
    air: 0,
    navalAir: 0,
    wings: [],
    seaHours: 0,
    landHits: 0,
    carrierHits: 0,
    unknownHits: 0,
    lost: { sea: 0, land: 0, carrier: 0, other: 0 },
    arrived: false,
    stands: [],
    outcome: 'kept',
    endDay: -1,
  };
};

let seaBattles = 0;
const seenBattle = new Set<object>();
const t0 = Date.now();
for (let day = 0; day < days; day++) {
  sim.step(24, (w) => {
    const c = w.formations.cols;
    const wd = w.cells.w;
    const now = Math.round((w.tick / 24) * 10) / 10;
    const inBattle = new Set<number>();
    for (const b of w.seaBattles) {
      for (const f of b.fleets) inBattle.add(f);
      if (!seenBattle.has(b)) {
        seenBattle.add(b);
        seaBattles++;
      }
    }
    // The hour's strikes and losses.
    const struck = new Map<number, 'land' | 'carrier' | 'unknown'>();
    const gone = new Set<number>();
    const ev = w.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      const k = ev[i + 1];
      if (k === EventKind.StrikeHit) {
        const g = ev[i + 2]!;
        if (!open.has(g)) continue;
        const base = w.wingBase.get(ev[i + 3]!);
        const kind = base === undefined ? 'unknown' : base > 0 ? 'land' : 'carrier';
        const o = open.get(g)!;
        if (kind === 'land') o.landHits++;
        else if (kind === 'carrier') o.carrierHits++;
        else o.unknownHits++;
        if (struck.get(g) !== 'carrier') struck.set(g, kind);
      } else if (k === EventKind.FormationDestroyed) gone.add(ev[i + 2]!);
    }
    ev.length = 0;
    w.out.fires.length = 0;
    for (const [id, o] of [...open]) {
      const was = hpOf.get(id) ?? o.hp;
      const now_ = w.formations.has(id) ? fleetHp(w, id) : 0;
      const lost = Math.max(0, was - now_);
      hpOf.set(id, now_);
      if (inBattle.has(id)) o.seaHours++;
      if (lost > 0) {
        const s = struck.get(id);
        if (inBattle.has(id)) o.lost.sea += lost;
        else if (s === 'land' || s === 'unknown') o.lost.land += lost;
        else if (s === 'carrier') o.lost.carrier += lost;
        else o.lost.other += lost;
      }
      if (o.kind === 'sortie' && !o.arrived && c.moving[id] !== 1 && w.formations.has(id)) {
        const cx = Math.floor(c.x[id]!);
        const cy = Math.floor(c.y[id]!);
        if (Math.abs(cx - (o.target % wd)) <= w.atSize(AT_PORT_CELLS) && Math.abs(cy - Math.floor(o.target / wd)) <= w.atSize(AT_PORT_CELLS)) o.arrived = true;
      }
      if (gone.has(id) || !w.formations.has(id)) {
        open.delete(id);
        hpOf.delete(id);
        close(o, now, true);
      }
    }
    if (w.tick % 24 !== 1) return;
    // The day's orders, an hour after the naval AI's.
    const water = portSeaOf(w);
    const z = seaOf(w);
    const ctl = w.cells.controller;
    const power = navalPower(w);
    const escorts = new Set<number>();
    for (const e of w.embarked.values()) if (e.water >= 0) escorts.add(e.water);
    // The sortied fleets standing at their targets: the air over each.
    for (const [id, o] of open) {
      if (o.kind !== 'sortie' || !o.arrived || c.moving[id] === 1 || !w.formations.has(id)) continue;
      const n = c.nation[id]!;
      const a = airOver(w, n, c.x[id]!, c.y[id]!);
      const zone = z.zoneOf[Math.floor(c.y[id]!) * wd + Math.floor(c.x[id]!)]!;
      const bloc = blocOf(w, n);
      let e = 0;
      for (const [b, p] of power.get(zone) ?? []) if (b !== bloc && w.wars.atWar(b, n)) e += p;
      o.stands.push({ day: now, air: Math.round(a.air), navalAir: Math.round(a.navalAir), hp: Math.round(fleetHp(w, id)), enemy: Math.round(e) });
    }
    w.formations.forEach((id) => {
      if (!w.isFleet(id) || fleetPower(w, id) <= 0) return;
      const n = c.nation[id]!;
      const target = c.moving[id] === 1 ? c.targetCell[id]! : -1;
      const cur = open.get(id);
      if (!cur) {
        if (target < 0) {
          const o = fresh(w, id, 'none', -1);
          open.set(id, o);
          hpOf.set(id, fleetHp(w, id));
          return;
        }
      } else if (target < 0 || cur.target === target) return;
      // A new order: its kind by where it goes.
      let kind: Kind = 'other';
      let port = -1;
      for (let i = 0; i < w.ports.length; i++) {
        const at = water[i]!;
        if (at < 0) continue;
        if (Math.abs((at % wd) - (target % wd)) > 1 || Math.abs(Math.floor(at / wd) - Math.floor(target / wd)) > 1) continue;
        const holder = ctl[w.ports[i]!.cell]!;
        if (holder !== 0 && w.wars.atWar(n, holder)) {
          kind = 'sortie';
          port = i;
          break;
        }
        if (holder !== 0 && blocOf(w, holder) === blocOf(w, n) && kind === 'other') {
          kind = 'stage';
          port = i;
        }
      }
      if (kind === 'other' && escorts.has(target)) kind = 'escort';
      if (cur) {
        open.delete(id);
        close(cur, now, false);
      }
      const o = fresh(w, id, kind, target);
      if (port >= 0) {
        const p = w.ports[port]!;
        o.port = p.name;
        o.holder = tag(ctl[p.cell]!);
        o.km = Math.round(seaKm(w, c.x[id]!, c.y[id]!, (target % wd) + 0.5, Math.floor(target / wd) + 0.5));
      }
      if (kind === 'sortie') {
        const zone = z.zoneOf[target]!;
        const bloc = blocOf(w, n);
        let e = 0;
        for (const [b, p] of power.get(zone) ?? []) if (b !== bloc && w.wars.atWar(b, n)) e += p;
        o.enemyShips = Math.round(e);
        o.ships = Math.round(fleetPower(w, id));
        const a = airOver(w, n, (target % wd) + 0.5, Math.floor(target / wd) + 0.5);
        o.air = Math.round(a.air);
        o.navalAir = Math.round(a.navalAir);
        o.wings = a.wings;
      }
      open.set(id, o);
      hpOf.set(id, fleetHp(w, id));
    });
  });
}
const endDay = Math.round((sim.world.tick / 24) * 10) / 10;
for (const o of open.values()) close(o, endDay, false);

// The summary: by order kind and outcome; the sorties' air over their targets by outcome.
const by: Record<string, Record<string, number>> = {};
for (const o of done) {
  by[o.kind] ??= {};
  by[o.kind]![o.outcome] = (by[o.kind]![o.outcome] ?? 0) + 1;
}
const lostBy: Record<string, { sea: number; land: number; carrier: number; other: number }> = {};
for (const o of done) {
  const l = (lostBy[o.kind] ??= { sea: 0, land: 0, carrier: 0, other: 0 });
  l.sea += o.lost.sea;
  l.land += o.lost.land;
  l.carrier += o.lost.carrier;
  l.other += o.lost.other;
}
for (const l of Object.values(lostBy)) for (const k of ['sea', 'land', 'carrier', 'other'] as const) l[k] = Math.round(l[k]);
const sorties = done.filter((o) => o.kind === 'sortie').map((o) => ({ ...o, airPerHp: o.hp > 0 ? Math.round((o.air / o.hp) * 1000) / 1000 : 0 }));
const summary = { seed, days, A, D, seaBattles, orders: by, hpLostByOrder: lostBy, sorties: sorties.length, sortiesAirAlone: sorties.filter((o) => o.outcome === 'airAlone').length, wallS: Math.round((Date.now() - t0) / 1000) };
writeFileSync(out, JSON.stringify({ summary, sorties, lostAirAlone: done.filter((o) => o.outcome === 'airAlone' && o.kind !== 'sortie') }, null, 1));
console.log(JSON.stringify(summary));
console.log(`done: ${out}`);
