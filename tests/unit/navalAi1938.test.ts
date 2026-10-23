import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { seaSide } from '../../src/shared/history';
import { NATIONS_1938, PORTS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { AVOID_RATIO, fleetPower, navalAi, navalBombers, SORTIE_KM, waterKeys } from '../../src/sim/ai/naval';
import { STAGGER } from '../../src/sim/ai/strategic';
import { equipFormation } from '../../src/sim/systems/elements';
import { AT_PORT_CELLS, basinAt, nearestOwnPort, sailHome, seaKm } from '../../src/sim/systems/navalCombat';
import { navalPower } from '../../src/sim/systems/seaControl';
import { convoyWays, passageShut } from '../../src/sim/systems/seaSupply';
import { blocOf } from '../../src/sim/systems/supply';
import { basinOf, portSeaOf, seaOf, type World } from '../../src/sim/world';
import { declareWar, makePeace } from '../../src/sim/systems/war';
import { assets1938 } from '../helpers/earth';

// PLAN 4.6c: the AI's fleets at sea. AT (PLAN 4.6's battle half, in the ten-year tests): ≥ 1
// fleet battle per 10 years on 3/3 seeds. Here: the United Kingdom at war with Italy sails its
// warships from their ports to the nearest Italian port whose sea it can win, and they fight
// Italy's there; Greece sails only where it is the stronger; a fleet out-gunned away from home
// turns home; at peace the fleets come home.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const ITA = id('ITA');
const own = (s: Sim, n: number): number[] => {
  const out: number[] = [];
  s.world.formations.forEach((f) => {
    if (s.world.isFleet(f) && s.world.formations.cols.nation[f] === n && fleetPower(s.world, f) > 0) out.push(f);
  });
  return out;
};

function addFleet(w: World, nation: number, tpl: string, x: number, y: number): number {
  const f = w.formations;
  const fid = f.create();
  const t = TEMPLATES_1938.findIndex((x2) => x2.id === tpl);
  f.cols.nation[fid] = nation;
  f.cols.x[fid] = x;
  f.cols.y[fid] = y;
  f.cols.template[fid] = t;
  f.cols.supply[fid] = 1;
  f.cols.org[fid] = 1;
  equipFormation(w, fid, t);
  return fid;
}

describe('the AI\'s fleets at sea (PLAN 4.6c)', () => {
  it('the United Kingdom at war with Italy: its warships sail within a week, and fight Italy\'s within 60 days', () => {
    const s = new Sim({ scenario: '1938', seed: 4604, assets: assets1938(W) });
    const w = s.world;
    expect(declareWar(w, ENG, ITA, true)).not.toBeNull();
    const ships = own(s, ENG);
    const at = new Map(ships.map((f) => [f, [w.formations.cols.x[f], w.formations.cols.y[f]]]));
    let battle = -1;
    let sailed: number[] = [];
    // From day 0: the first week's battles count (PLAN 7.24a: seed 4604's first is on day 5, and
    // since the air spread the next after day 60; the week was stepped unwatched before).
    for (let d = 0; d < 60 && (battle < 0 || d <= 7); d++) {
      if (d === 7) {
        sailed = ships.filter((f) => w.formations.has(f) && (w.formations.cols.x[f] !== at.get(f)![0] || w.formations.cols.y[f] !== at.get(f)![1]));
        expect(sailed.length).toBeGreaterThan(0);
      }
      s.step(24, (world) => {
        const ev = world.out.events;
        for (let i = 0; i < ev.length; i += 6) {
          if (ev[i + 1] !== EventKind.SeaBattle) continue;
          const pair = [seaSide(ev[i + 2]!).nation, seaSide(ev[i + 3]!).nation];
          if (pair.includes(ENG) && pair.includes(ITA) && battle < 0) battle = d;
        }
        world.out.events.length = 0;
        world.out.fires.length = 0;
      });
    }
    expect(battle).toBeGreaterThanOrEqual(0);
    process.stderr.write(`ENG–ITA: ${sailed.length} of ${ships.length} British warfleets under way in a week; the first sea battle with Italy on day ${battle}\n`);
  });

  it('Greece at war with Italy sails only for a zone whose Italian power its fleets there together match', () => {
    const s = new Sim({ scenario: '1938', seed: 4605, assets: assets1938(W) });
    const w = s.world;
    const GRE = id('GRE');
    expect(declareWar(w, GRE, ITA, true)).not.toBeNull();
    const ships = own(s, GRE);
    expect(ships.length).toBeGreaterThan(0);
    // Italy's AI off (PLAN 5.12a): its naval bombers, rebased toward the war, sank Greece's fleet on
    // the second day, before it was ordered. Its fleets stand; their power is what Greece weighs.
    w.nations.cols.aiOff[ITA] = 1;
    // The hour Greece's fleets are first ordered: each one's target zone against the Greek fleets in port near it.
    let checked = 0;
    for (let h = 0; h < 8 * 24 && checked === 0; h++) {
      const standing = ships.filter((f) => w.formations.cols.moving[f] === 0);
      const power = new Map(ships.map((f) => [f, fleetPower(w, f)]));
      const at = new Map(ships.map((f) => [f, [w.formations.cols.x[f]!, w.formations.cols.y[f]!]]));
      s.step(1);
      for (const f of standing) {
        if (w.formations.cols.moving[f] !== 1) continue;
        const t = w.formations.cols.targetCell[f]!;
        const zone = seaOf(w).zoneOf[t]!;
        const italian = navalPower(w).get(zone)?.get(ITA) ?? 0;
        const near = ships.filter((g) => seaKm(w, at.get(g)![0]!, at.get(g)![1]!, (t % W) + 0.5, Math.floor(t / W) + 0.5) <= SORTIE_KM).reduce((sum, g) => sum + power.get(g)!, 0);
        expect(italian, `fleet ${f} to zone ${zone}`).toBeLessThanOrEqual(near);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('a warfleet away from its ports where the enemy is far the stronger sails home', () => {
    const s = new Sim({ scenario: '1938', seed: 4605, assets: assets1938(W) });
    const w = s.world;
    const GRE = id('GRE');
    expect(declareWar(w, GRE, ITA, true)).not.toBeNull();
    // Italy's AI off: its fleets stand (its own would sail them for Greece's ports).
    w.nations.cols.aiOff[ITA] = 1;
    // A Greek destroyer flotilla in the zone of Taranto's water, where Italy's battle fleet
    // stands, at the cell of the zone farthest from any Italian fleet and not by a Greek port.
    const taranto = w.ports.findIndex((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === 'Taranto');
    const water = portSeaOf(w)[taranto]!;
    const zone = seaOf(w).zoneOf[water]!;
    const italian = navalPower(w).get(zone)?.get(ITA) ?? 0;
    const theirs: number[] = [];
    w.formations.forEach((f) => void (w.isFleet(f) && w.formations.cols.nation[f] === ITA && theirs.push(f)));
    let far = -1;
    let gap = 0;
    for (let k = 0; k < seaOf(w).zoneOf.length; k++) {
      if (seaOf(w).zoneOf[k] !== zone) continue;
      // Away from Greece's ports (the zone reaches Corfu).
      if (w.ports.some((p, i) => w.cells.controller[p.cell] === GRE && portSeaOf(w)[i]! >= 0 && Math.abs((portSeaOf(w)[i]! % W) - (k % W)) <= 5 && Math.abs(Math.floor(portSeaOf(w)[i]! / W) - Math.floor(k / W)) <= 5)) continue;
      const d = Math.min(...theirs.map((f) => seaKm(w, w.formations.cols.x[f]!, w.formations.cols.y[f]!, (k % W) + 0.5, Math.floor(k / W) + 0.5)));
      if (d > gap) [gap, far] = [d, k];
    }
    expect(gap).toBeGreaterThan(100);
    const dd = addFleet(w, GRE, 'destroyer_flotilla', (far % W) + 0.5, Math.floor(far / W) + 0.5);
    expect(italian).toBeGreaterThan(AVOID_RATIO * fleetPower(w, dd));
    let sent = -1;
    let fought = false;
    for (let d = 0; d < 8 && sent < 0; d++) {
      s.step(24, (world) => {
        if (world.seaBattles.some((b) => b.fleets.includes(dd))) fought = true;
        world.out.events.length = 0;
        world.out.fires.length = 0;
      });
      // Under way, or home already (a short way ends within the day).
      if (w.formations.cols.moving[dd] === 1 || w.formations.cols.x[dd] !== (far % W) + 0.5 || w.formations.cols.y[dd] !== Math.floor(far / W) + 0.5) sent = d;
    }
    // Sent home by the rule, not by a battle's break-off.
    expect(fought).toBe(false);
    expect(sent).toBeGreaterThanOrEqual(0);
  });

  it('Germany at war with the United Kingdom sends its submarines to a British convoy\'s way within a week; they raid it within 60 days (PLAN 4.6d)', () => {
    const s = new Sim({ scenario: '1938', seed: 4606, assets: assets1938(W) });
    const w = s.world;
    const GER = id('GER');
    expect(declareWar(w, GER, ENG, true)).not.toBeNull();
    const boats: number[] = [];
    w.formations.forEach((f) => void (w.isFleet(f) && w.formations.cols.nation[f] === GER && TEMPLATES_1938[w.formations.cols.template[f]!]!.id === 'submarine_flotilla' && boats.push(f)));
    expect(boats.length).toBeGreaterThan(0);
    s.step(7 * 24);
    // Under way to, or at, a zone of a British convoy's way.
    const ways = new Set<number>();
    for (const [bloc, byLand] of convoyWays(w)) if (w.wars.atWar(bloc, GER)) for (const way of byLand.values()) for (const z of way) ways.add(z);
    const sent = boats.filter((f) => w.formations.cols.moving[f] === 1 && ways.has(seaOf(w).zoneOf[w.formations.cols.targetCell[f]!]!));
    expect(sent.length).toBeGreaterThan(0);
    let raided = -1;
    for (let d = 7; d < 60 && raided < 0; d++) {
      s.step(24, (world) => {
        const ev = world.out.events;
        // A month's raid goes into the quarter's tally; the log tells it at the quarter's start (PLAN 7.33a).
        for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.ConvoyRaided && ev[i + 2] === GER && raided < 0) raided = d;
        if (raided < 0 && world.convoyQuarter.some((t) => t.raider === GER && [...t.zones.values()].some((g) => g > 0))) raided = d;
        world.out.events.length = 0;
        world.out.fires.length = 0;
      });
    }
    expect(raided).toBeGreaterThanOrEqual(0);
    process.stderr.write(`GER–ENG: ${sent.length} of ${boats.length} U-boat flotillas sent to British convoy ways in a week; the first raid logged on day ${raided}\n`);
  });

  it('at war a transport group left away from its ports with no one aboard sails home within its nation\'s turn; one with men aboard stays (PLAN 7.26h1)', () => {
    const s = new Sim({ scenario: '1938', seed: 4607, assets: assets1938(W) });
    const w = s.world;
    const c = w.formations.cols;
    expect(declareWar(w, ENG, ITA, true)).not.toBeNull();
    w.nations.cols.aiOff[ITA] = 1;
    const groups: number[] = [];
    w.formations.forEach((f) => void (w.isFleet(f) && c.nation[f] === ENG && TEMPLATES_1938[c.template[f]!]!.id === 'transport_group' && groups.push(f)));
    expect(groups.length).toBeGreaterThanOrEqual(2);
    const [empty, full] = groups as [number, number];
    // The open sea cell farthest from every port's water (the mid-ocean: no land, no port, no fleet near).
    const z = seaOf(w);
    const waters = portSeaOf(w).filter((x) => x >= 0);
    let far = -1;
    let gap = 0;
    for (let k = 0; k < z.zoneOf.length; k += 7) {
      if (z.zoneOf[k] === 0 || z.closed[z.zoneOf[k]!] === 1) continue;
      let d = Infinity;
      for (const x of waters) d = Math.min(d, Math.hypot((x % W) - (k % W), Math.floor(x / W) - Math.floor(k / W)));
      if (d > gap) [gap, far] = [d, k];
    }
    expect(gap).toBeGreaterThan(20);
    const [fx, fy] = [(far % W) + 0.5, Math.floor(far / W) + 0.5];
    for (const g of [empty, full]) [c.x[g], c.y[g], c.moving[g]] = [fx, fy, 0];
    // A British division aboard `full`, its landing elsewhere (so it neither lands nor strays here: no land near).
    let div = -1;
    w.formations.forEach((f) => void (div < 0 && !w.isFleet(f) && !w.isWing(f) && c.nation[f] === ENG && (div = f)));
    expect(div).toBeGreaterThan(0);
    w.embarked.set(div, { fleet: full, land: -1, water: waters[0]!, target: -1 });
    [c.x[div], c.y[div]] = [fx, fy];
    // Within a turn of its nation's (`STAGGER` days) and a day.
    s.step(8 * 24);
    const left = (g: number): boolean => c.moving[g] === 1 || c.x[g] !== fx || c.y[g] !== fy;
    expect(left(empty)).toBe(true);
    expect(w.embarked.get(div)?.fleet).toBe(full);
    expect(left(full)).toBe(false);
  });

  // PLAN 7.35b2 (ADR-543): a warfleet with no enemy port within SORTIE_KM stages to its bloc's
  // nearest port that has one; one with an enemy port in reach does not, nor one with no such base.
  const enemyWaters = (w: World, n: number): number[] => w.ports.flatMap((p, i) => {
    const holder = w.cells.controller[p.cell]!;
    const at = portSeaOf(w)[i]!;
    return holder !== 0 && at >= 0 && w.wars.atWar(n, holder) && seaOf(w).zoneOf[at] !== 0 ? [at] : [];
  });
  const kmTo = (w: World, x: number, y: number, cell: number): number => seaKm(w, x, y, (cell % W) + 0.5, Math.floor(cell / W) + 0.5);

  it('the United States at war with Japan: its fleets at San Diego, no Japanese port within SORTIE_KM, stage within a turn to a port of its bloc that has one (PLAN 7.35b2)', () => {
    const s = new Sim({ scenario: '1938', seed: 4608, assets: assets1938(W) });
    const w = s.world;
    const c = w.formations.cols;
    const USA = id('USA');
    const JAP = id('JAP');
    expect(declareWar(w, JAP, USA, true)).not.toBeNull();
    // Japan's AI off: its fleets stand and its ports stay its own (Guam stays American).
    w.nations.cols.aiOff[JAP] = 1;
    const sd = w.ports.find((p) => p.name === 'San Diego' && p.navalBase > 0)!;
    const fleets = own(s, USA).filter((f) => seaKm(w, c.x[f]!, c.y[f]!, sd.x, sd.y) < 100);
    expect(fleets.length).toBeGreaterThan(0);
    const enemy = enemyWaters(w, USA);
    for (const f of fleets) expect(Math.min(...enemy.map((e) => kmTo(w, c.x[f]!, c.y[f]!, e)))).toBeGreaterThan(SORTIE_KM);
    s.step(8 * 24);
    const water = portSeaOf(w);
    for (const f of fleets) {
      expect(c.moving[f], `fleet ${f} under way`).toBe(1);
      const t = c.targetCell[f]!;
      // A port's water of the United States' bloc, with a Japanese port within SORTIE_KM of it.
      const base = w.ports.findIndex((_p, i) => water[i] === t);
      expect(base, `fleet ${f} sails for a port`).toBeGreaterThanOrEqual(0);
      const holder = w.cells.controller[w.ports[base]!.cell]!;
      expect(blocOf(w, holder), `held by ${holder}`).toBe(blocOf(w, USA));
      expect(Math.min(...enemyWaters(w, USA).map((e) => kmTo(w, (t % W) + 0.5, Math.floor(t / W) + 0.5, e)))).toBeLessThanOrEqual(SORTIE_KM);
    }
    process.stderr.write(`USA–JAP: ${fleets.length} fleets at San Diego staged for ${[...new Set(fleets.map((f) => w.ports.find((_p, i) => water[i] === c.targetCell[f])!.name))].join(', ')}\n`);
  });

  it('Italy at war with the United States: no port of Italy\'s has an American one within SORTIE_KM, and its fleets stand (PLAN 7.35b2)', () => {
    const s = new Sim({ scenario: '1938', seed: 4609, assets: assets1938(W) });
    const w = s.world;
    const c = w.formations.cols;
    const USA = id('USA');
    expect(declareWar(w, ITA, USA, true)).not.toBeNull();
    w.nations.cols.aiOff[USA] = 1;
    // One war (PLAN 7.82d, ADR-670): Japan declared on the Spanish Republic across the sea on day 2,
    // Italy joined it as Japan's ally, and its fleets sailed for Spain's ports. A truce with every
    // nation outside the war keeps Italy out of another (nobody joins against a truce partner).
    w.nations.forEach((n) => {
      if (n !== ITA && !w.wars.atWar(ITA, n)) w.wars.truces.push({ a: ITA, b: n, untilTick: w.tick + 24 * 365 });
    });
    const fleets = own(s, ITA);
    const at = new Map(fleets.map((f) => [f, [c.x[f]!, c.y[f]!]]));
    s.step(8 * 24);
    const moved = fleets.filter((f) => c.moving[f] === 1 || c.x[f] !== at.get(f)![0] || c.y[f] !== at.get(f)![1]);
    expect(moved).toEqual([]);
  });

  it('Canada at war with Cuba: its fleets stage to a port of their own basin, not to Toronto on the Great Lakes, the nearest by the line (PLAN 7.35b4c)', () => {
    const s = new Sim({ scenario: '1938', seed: 4610, assets: assets1938(W) });
    const w = s.world;
    const c = w.formations.cols;
    const CAN = id('CAN');
    const CUB = id('CUB');
    expect(declareWar(w, CAN, CUB, true)).not.toBeNull();
    w.nations.cols.aiOff[CUB] = 1;
    const enemy = enemyWaters(w, CAN);
    const fleets = own(s, CAN).filter((f) => Math.min(...enemy.map((e) => kmTo(w, c.x[f]!, c.y[f]!, e))) > SORTIE_KM);
    expect(fleets.length).toBeGreaterThan(0);
    const { basin } = basinOf(w);
    const z = seaOf(w);
    const water = portSeaOf(w);
    // The lake ports the line puts nearest are of another basin than the fleets'.
    const lakes = w.ports.flatMap((p, i) => (water[i]! >= 0 && blocOf(w, w.cells.controller[p.cell]!) === blocOf(w, CAN) && basin[z.zoneOf[water[i]!]!] !== basinAt(w, c.x[fleets[0]!]!, c.y[fleets[0]!]!) ? [p.name] : []));
    expect(lakes).toContain('Toronto');
    // Each fleet's first goal, and its basin where it stood when given it, within a turn of Canada's.
    const goal = new Map<number, [number, number]>();
    for (let d = 0; d < 8; d++) {
      const from = new Map(fleets.map((f) => [f, basinAt(w, c.x[f]!, c.y[f]!)]));
      s.step(24);
      for (const f of fleets) if (!goal.has(f) && c.moving[f] === 1) goal.set(f, [c.targetCell[f]!, from.get(f)!]);
    }
    const to: string[] = [];
    for (const f of fleets) {
      expect(goal.has(f), `fleet ${f} under way`).toBe(true);
      const [t, b] = goal.get(f)!;
      expect(basin[z.zoneOf[t]!], `fleet ${f}'s goal in its basin`).toBe(b);
      const i = water.indexOf(t);
      to.push(i >= 0 ? w.ports[i]!.name : `cell ${t}`);
    }
    process.stderr.write(`CAN–CUB: ${fleets.length} fleets staged for ${[...new Set(to)].join(', ')}\n`);
  });

  it('the United States at war with Canada: its fleets whose nearest Canadian port is on the Great Lakes sail for one of their own basin (PLAN 7.35d2d)', () => {
    const s = new Sim({ scenario: '1938', seed: 4611, assets: assets1938(W) });
    const w = s.world;
    const c = w.formations.cols;
    const USA = id('USA');
    const CAN = id('CAN');
    // Canada is Britain's puppet: the war is on the British bloc, so Bermuda and Halifax are enemy ports too.
    expect(declareWar(w, USA, CAN, true)).not.toBeNull();
    w.nations.cols.aiOff[CAN] = 1;
    const { basin } = basinOf(w);
    const z = seaOf(w);
    const water = portSeaOf(w);
    const enemy = enemyWaters(w, USA);
    // The fleets whose nearest enemy port within SORTIE_KM, by the line, is of another basin (Hamilton, Toronto).
    const across = own(s, USA).filter((f) => {
      const near = enemy.filter((e) => kmTo(w, c.x[f]!, c.y[f]!, e) <= SORTIE_KM).sort((a, b) => kmTo(w, c.x[f]!, c.y[f]!, a) - kmTo(w, c.x[f]!, c.y[f]!, b))[0];
      return near !== undefined && basin[z.zoneOf[near]!] !== basinAt(w, c.x[f]!, c.y[f]!);
    });
    expect(across.length).toBeGreaterThan(0);
    // Each one's first goal within a turn of the United States', and its basin where it stood when given it.
    const goal = new Map<number, [number, number]>();
    for (let d = 0; d < 8; d++) {
      const from = new Map(across.map((f) => [f, basinAt(w, c.x[f]!, c.y[f]!)]));
      s.step(24);
      for (const f of across) if (!goal.has(f) && w.formations.has(f) && c.moving[f] === 1) goal.set(f, [c.targetCell[f]!, from.get(f)!]);
    }
    const to: string[] = [];
    for (const f of across) {
      expect(goal.has(f), `fleet ${f} under way`).toBe(true);
      const [t, b] = goal.get(f)!;
      expect(basin[z.zoneOf[t]!], `fleet ${f}'s goal in its basin`).toBe(b);
      const i = water.indexOf(t);
      to.push(i >= 0 ? w.ports[i]!.name : `cell ${t}`);
    }
    process.stderr.write(`USA–CAN: ${across.length} fleets sailed for ${[...new Set(to)].join(', ')}\n`);
  });

  it('the United Kingdom at war with Turkey: a fleet in the Aegean whose nearest Turkish port is behind the Dardanelles, which Turkey holds, sails for one it reaches (PLAN 7.35d2d2)', () => {
    const s = new Sim({ scenario: '1938', seed: 4612, assets: assets1938(W) });
    const w = s.world;
    const c = w.formations.cols;
    const TUR = id('TUR');
    expect(declareWar(w, ENG, TUR, true)).not.toBeNull();
    w.nations.cols.aiOff[TUR] = 1;
    // The Dardanelles' bank is Turkey's: the passage is shut to British ships (PLAN 4.4e).
    const dardanelles = w.seaPassages.findIndex((p) => p.id === 'dardanelles');
    expect(passageShut(w, dardanelles, ENG)).toBe(true);
    const keys = waterKeys(w, ENG);
    const z = seaOf(w);
    const water = portSeaOf(w);
    const enemy = enemyWaters(w, ENG);
    const named = (cell: number): string => {
      const i = water.indexOf(cell);
      return i >= 0 ? w.ports[i]!.name : `cell ${cell}`;
    };
    // An open-water cell of the Aegean (İzmir's waters) whose nearest Turkish port by the line is
    // behind the strait (Bursa, Gölcük or Istanbul), not by an enemy port: the first such, scanning out from İzmir's water.
    const izmir = water[w.ports.findIndex((p) => p.name === 'İzmir')]!;
    const aegean = keys[z.zoneOf[izmir]!]!;
    const nearest = (cell: number): number => enemy.reduce((b, e) => (kmTo(w, (cell % W) + 0.5, Math.floor(cell / W) + 0.5, e) < kmTo(w, (cell % W) + 0.5, Math.floor(cell / W) + 0.5, b) ? e : b));
    let start = -1;
    for (let r = 1; r < 20 && start < 0; r++) {
      for (let dy = -r; dy <= r && start < 0; dy++) {
        for (let dx = -r; dx <= r && start < 0; dx++) {
          const cell = izmir + dy * W + dx;
          const zone = z.zoneOf[cell]!;
          if (zone === 0 || keys[zone] !== aegean || (Math.abs(dx) !== r && Math.abs(dy) !== r)) continue;
          // Not by an enemy port already (on station there, it would stay).
          if (enemy.some((e) => Math.abs((e % W) - (cell % W)) <= w.atSize(AT_PORT_CELLS) && Math.abs(Math.floor(e / W) - Math.floor(cell / W)) <= w.atSize(AT_PORT_CELLS))) continue;
          if (keys[z.zoneOf[nearest(cell)]!] !== aegean) start = cell;
        }
      }
    }
    expect(start, 'an Aegean cell nearest a port behind the strait').toBeGreaterThanOrEqual(0);
    const behind = nearest(start);
    const fleet = addFleet(w, ENG, 'battle_squadron', (start % W) + 0.5, Math.floor(start / W) + 0.5);
    expect(keys[z.zoneOf[behind]!]).not.toBe(aegean);
    expect(kmTo(w, c.x[fleet]!, c.y[fleet]!, behind)).toBeLessThanOrEqual(SORTIE_KM);
    // Within a turn of Britain's: it sails for a port of its waters, its order never refused.
    let rejected = 0;
    let goal = -1;
    for (let d = 0; d < 8 && goal < 0; d++) {
      s.step(24, (world) => {
        const ev = world.out.events;
        for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && ev[i + 2] === fleet) rejected++;
        world.out.events.length = 0;
        world.out.fires.length = 0;
      });
      // Under way, or there already (a day's sail).
      if (c.moving[fleet] === 1 || Math.floor(c.y[fleet]!) * W + Math.floor(c.x[fleet]!) !== start) goal = c.targetCell[fleet]!;
    }
    expect(rejected, 'orders refused').toBe(0);
    expect(goal, 'sailed').toBeGreaterThanOrEqual(0);
    expect(keys[z.zoneOf[goal]!], `its goal ${named(goal)} in its waters`).toBe(aegean);
    process.stderr.write(`ENG–TUR: the fleet nearest ${named(behind)} by the line sailed for ${named(goal)}\n`);
  });

  it('France at war with Turkey: a French fleet in the Black Sea has no home port it reaches, and is not sent for one through the Bosporus (PLAN 7.35d2d3a)', () => {
    const s = new Sim({ scenario: '1938', seed: 4613, assets: assets1938(W) });
    const w = s.world;
    const FRA = id('FRA');
    const TUR = id('TUR');
    const water = portSeaOf(w);
    const named = (cell: number): string => {
      const i = water.indexOf(cell);
      return i >= 0 ? w.ports[i]!.name : `cell ${cell}`;
    };
    // At Constanța's water, Romania's: at peace with everyone there, so on no enemy station.
    const at = water[w.ports.findIndex((p) => p.name === 'Constanța')]!;
    expect(at).toBeGreaterThanOrEqual(0);
    const fleet = addFleet(w, FRA, 'cruiser_squadron', (at % W) + 0.5, Math.floor(at / W) + 0.5);
    // At peace the strait is open: home is a French port beyond it.
    const bosporus = w.seaPassages.findIndex((p) => p.id === 'bosporus');
    expect(passageShut(w, bosporus, FRA)).toBe(false);
    const before = nearestOwnPort(w, fleet);
    expect(before, 'a home port at peace').toBeGreaterThanOrEqual(0);
    // At war with Turkey, which holds the Bosporus' bank: no French port is in the fleet's waters.
    expect(declareWar(w, FRA, TUR, true)).not.toBeNull();
    w.nations.cols.aiOff[TUR] = 1;
    expect(passageShut(w, bosporus, FRA)).toBe(true);
    expect(nearestOwnPort(w, fleet), `no home port through the strait (was ${named(before)})`).toBe(-1);
    expect(sailHome(w, fleet)).toBe(false);
    // Over France's turns: its order never refused.
    let rejected = 0;
    for (let d = 0; d < 8; d++) {
      s.step(24, (world) => {
        const ev = world.out.events;
        for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && ev[i + 2] === fleet) rejected++;
        world.out.events.length = 0;
        world.out.fires.length = 0;
      });
    }
    expect(rejected, 'orders refused').toBe(0);
    process.stderr.write(`FRA–TUR: home at peace ${named(before)}; at war none in the Black Sea, no order refused in 8 days\n`);
  });

  it('Greece at war with Italy, Italian ports within SORTIE_KM: no Greek fleet stages, each sails for an Italian port or stands (PLAN 7.35b2)', () => {
    const s = new Sim({ scenario: '1938', seed: 4605, assets: assets1938(W) });
    const w = s.world;
    const c = w.formations.cols;
    const GRE = id('GRE');
    expect(declareWar(w, GRE, ITA, true)).not.toBeNull();
    w.nations.cols.aiOff[ITA] = 1;
    const fleets = own(s, GRE);
    // At a Greek port's water (AT_PORT_CELLS, 3): one away sails home by the rules of PLAN 4.6c.
    const atHome = (f: number): boolean => w.ports.some((p, i) => {
      const at = portSeaOf(w)[i]!;
      return at >= 0 && w.cells.controller[p.cell] === GRE && Math.abs((at % W) - Math.floor(c.x[f]!)) <= 3 && Math.abs(Math.floor(at / W) - Math.floor(c.y[f]!)) <= 3;
    });
    let sailed = 0;
    for (let h = 0; h < 8 * 24; h++) {
      const standing = fleets.filter((f) => w.formations.has(f) && c.moving[f] === 0 && atHome(f));
      s.step(1);
      for (const f of standing) {
        if (!w.formations.has(f) || c.moving[f] !== 1) continue;
        const t = c.targetCell[f]!;
        const port = w.ports.findIndex((_p, i) => portSeaOf(w)[i] === t);
        expect(port, `fleet ${f} sails for a port's water`).toBeGreaterThanOrEqual(0);
        expect(w.cells.controller[w.ports[port]!.cell], `fleet ${f} sails for ${w.ports[port]!.name}`).toBe(ITA);
        sailed++;
      }
    }
    expect(sailed).toBeGreaterThan(0);
  });

  // PLAN 7.35b3b, ADR-544: under the enemy's naval bombers a zone with no enemy ship holds nothing
  // to fight. Greece at war with Italy, Italy's AI off (its fleets and wings stand); the naval AI
  // called at Greece's turn. Bari's zone (the Adriatic) has no Italian ship and Italy's naval
  // bomber group at its start base has Bari within its range; Tobruk's zone has no Italian ship.
  describe('under the enemy\'s naval bombers (PLAN 7.35b3b)', () => {
    const GRE = id('GRE');
    const setup = (): { s: Sim; w: World; wing: number; water: (name: string) => number } => {
      const s = new Sim({ scenario: '1938', seed: 4605, assets: assets1938(W) });
      const w = s.world;
      expect(declareWar(w, GRE, ITA, true)).not.toBeNull();
      w.nations.cols.aiOff[ITA] = 1;
      const wing = [...w.wingBase].find(([f, b]) => b > 0 && w.formations.cols.nation[f] === ITA && TEMPLATES_1938[w.formations.cols.template[f]!]!.id === 'naval_bomber_group')![0];
      const water = (name: string): number => portSeaOf(w)[w.ports.findIndex((p) => p.name === name && w.cells.controller[p.cell] === ITA)]!;
      return { s, w, wing, water };
    };
    /** Greece's next turn of the naval AI (its `STAGGER` day), called alone. */
    const greekTurn = (w: World): void => {
      let d = w.tick / 24;
      while ((d + GRE) % STAGGER !== 0) d++;
      w.tick = d * 24;
      navalAi(w);
    };
    const at = (cell: number): [number, number] => [(cell % W) + 0.5, Math.floor(cell / W) + 0.5];
    const zoneEnemy = (w: World, cell: number): number => navalPower(w).get(seaOf(w).zoneOf[cell]!)?.get(ITA) ?? 0;
    const bombedAt = (w: World, cell: number): boolean => navalBombers(w, GRE).some((b) => seaKm(w, b.x, b.y, ...at(cell)) <= b.r);
    /** Greece's other fleets sunk and flotilla `dd` at half strength (600, under Italy's least fleet in a zone of the Mediterranean, 1,200): no battle it can win in reach. Its power. */
    const weakenAll = (w: World, dd: number): number => {
      const ec = w.elements.cols;
      const fleet = own({ world: w } as Sim, GRE).filter((f) => f !== dd);
      w.elements.forEach((e) => {
        if (fleet.includes(ec.formation[e]!)) ec.strength[e] = 0;
        else if (ec.formation[e] === dd) ec.strength[e] = Math.floor(ec.strength[e]! / 2);
      });
      return fleetPower(w, dd);
    };
    /** Italy's naval bomber wing `wing` out of the fight (so no flotilla is sent home by ADR-544's test). */
    const noBombers = (w: World, wing: number): void => {
      const ec = w.elements.cols;
      w.elements.forEach((e) => void (ec.formation[e] === wing && (ec.strength[e] = 0)));
    };
    const homeWater = (w: World, cell: number): boolean => w.ports.some((p, i) => portSeaOf(w)[i] === cell && blocOf(w, w.cells.controller[p.cell]!) === blocOf(w, GRE));

    it('a Greek destroyer flotilla at Bari, no Italian ship in its zone, Italy\'s naval bombers in range: it sails home at its turn', () => {
      const { w, water } = setup();
      const bari = water('Bari');
      expect(zoneEnemy(w, bari)).toBe(0);
      expect(bombedAt(w, bari)).toBe(true);
      const dd = addFleet(w, GRE, 'destroyer_flotilla', ...at(bari));
      greekTurn(w);
      expect(w.formations.cols.moving[dd], 'under way').toBe(1);
      expect(homeWater(w, w.formations.cols.targetCell[dd]!), 'for a port of Greece\'s bloc').toBe(true);
    });

    it('the same flotilla with Italy\'s naval bombers out of the fight stays at Bari', () => {
      const { w, wing, water } = setup();
      const bari = water('Bari');
      const ec = w.elements.cols;
      w.elements.forEach((e) => void (ec.formation[e] === wing && (ec.strength[e] = 0)));
      expect(bombedAt(w, bari)).toBe(false);
      const dd = addFleet(w, GRE, 'destroyer_flotilla', ...at(bari));
      // No battle it can win in reach: since PLAN 7.35d2b (ADR-549) a flotilla on station sails for
      // one (Naples' zone: Italy's 1,200 against the flotilla's and Athens' fleet's together).
      weakenAll(w, dd);
      greekTurn(w);
      expect(w.formations.cols.moving[dd]).toBe(0);
    });

    it('the same flotilla escorting a Greek landing at Bari\'s water stays (the escort is exempt)', () => {
      const { w, water } = setup();
      const bari = water('Bari');
      const dd = addFleet(w, GRE, 'destroyer_flotilla', ...at(bari));
      const tp = addFleet(w, GRE, 'transport_group', ...at(bari));
      const army = addFleet(w, GRE, 'infantry_div', ...at(bari));
      w.embarked.set(army, { fleet: tp, land: -1, water: bari, target: -1 });
      greekTurn(w);
      expect(w.formations.cols.moving[dd]).toBe(0);
    });

    it('Greece\'s fleets in port: with Italy\'s naval bombers based in range of Tobruk, none sails for Tobruk\'s empty water; without them they do', () => {
      const tobruk = (bombers: boolean): number[] => {
        const { w, wing, water } = setup();
        const t = water('Tobruk');
        expect(zoneEnemy(w, t)).toBe(0);
        if (bombers) {
          // Italy's group based at the airbase nearest Tobruk's water.
          let best = Infinity;
          let base = -1;
          w.airbases.forEach((a, i) => {
            const d = seaKm(w, ...w.cellPoint(a.cell), ...at(t));
            if (d < best) [best, base] = [d, i];
          });
          w.wingBase.set(wing, base + 1);
          expect(bombedAt(w, t)).toBe(true);
        } else expect(bombedAt(w, t)).toBe(false);
        greekTurn(w);
        const c = w.formations.cols;
        const sent = own({ world: w } as Sim, GRE).filter((f) => c.moving[f] === 1);
        expect(sent.length).toBeGreaterThan(0);
        // No sortie for empty water the bombers cover.
        if (bombers) for (const f of sent) expect(zoneEnemy(w, c.targetCell[f]!) > 0 || !bombedAt(w, c.targetCell[f]!), `fleet ${f}`).toBe(true);
        return sent.filter((f) => c.targetCell[f] === t);
      };
      expect(tobruk(false).length).toBeGreaterThan(0);
      expect(tobruk(true).length).toBe(0);
    });

    // PLAN 7.35d2b, ADR-549: a warfleet at war away from its bloc's ports gets a new order on its
    // AI day; before, it stood where its sortie ended until peace. Italy's naval bombers out of the
    // fight in each (so no flotilla is sent home by ADR-544's test). Greece's one fleet (1,200) at
    // Athens; Italy's power by zone: Naples' 1,200, Genoa's 4,000, Taranto's 16,600, Tobruk's none.
    describe('away from its ports, a new order (PLAN 7.35d2b)', () => {
      const italianHeld = (w: World, cell: number): boolean => w.ports.some((p, i) => portSeaOf(w)[i] === cell && w.cells.controller[p.cell] === ITA);

      it('a Greek flotilla on station at a Yugoslav port sails on once Greece has made its peace with Yugoslavia (a station whose war ended)', () => {
        const { w, wing } = setup();
        noBombers(w, wing);
        const YUG = id('YUG');
        const war = declareWar(w, GRE, YUG, true);
        expect(war).not.toBeNull();
        // A Yugoslav port whose zone has no Italian ship (ADR-264's test would send it home from one that has).
        const i = w.ports.findIndex((p, k) => w.cells.controller[p.cell] === YUG && portSeaOf(w)[k]! >= 0 && zoneEnemy(w, portSeaOf(w)[k]!) === 0);
        expect(i, 'a Yugoslav port').toBeGreaterThanOrEqual(0);
        const station = portSeaOf(w)[i]!;
        const dd = addFleet(w, GRE, 'destroyer_flotilla', ...at(station));
        makePeace(w, war!);
        expect(w.wars.atWar(GRE, YUG)).toBe(false);
        expect(w.wars.atWar(GRE, ITA)).toBe(true);
        greekTurn(w);
        expect(w.formations.cols.moving[dd], `under way from ${w.ports[i]!.name}`).toBe(1);
        const t = w.formations.cols.targetCell[dd]!;
        expect(italianHeld(w, t) || homeWater(w, t), 'for an Italian port or home').toBe(true);
      });

      it('a Greek flotilla on station at Tobruk\'s empty water sails for a winnable Italian fleet\'s port in reach (Naples\' zone)', () => {
        const { w, wing, water } = setup();
        noBombers(w, wing);
        const tobruk = water('Tobruk');
        expect(zoneEnemy(w, tobruk)).toBe(0);
        const dd = addFleet(w, GRE, 'destroyer_flotilla', ...at(tobruk));
        greekTurn(w);
        expect(w.formations.cols.moving[dd], 'under way from Tobruk').toBe(1);
        const t = w.formations.cols.targetCell[dd]!;
        expect(italianHeld(w, t), 'for an Italian port').toBe(true);
        const enemy = zoneEnemy(w, t);
        // Italian ships there, no more than Greece's warfleets within SORTIE_KM of it together.
        const together = own({ world: w } as Sim, GRE).reduce((s, f) => s + (seaKm(w, w.formations.cols.x[f]!, w.formations.cols.y[f]!, ...at(t)) <= SORTIE_KM ? fleetPower(w, f) : 0), 0);
        expect(enemy, 'a battle').toBeGreaterThan(0);
        expect(enemy).toBeLessThanOrEqual(together);
        expect(seaKm(w, ...at(tobruk), ...at(t))).toBeLessThanOrEqual(SORTIE_KM);
      });

      it('the same flotilla at Tobruk, at half strength, Greece\'s fleet at Athens sunk, no battle it can win in reach: it keeps its station (the blockade)', () => {
        const { w, wing, water } = setup();
        noBombers(w, wing);
        const tobruk = water('Tobruk');
        const dd = addFleet(w, GRE, 'destroyer_flotilla', ...at(tobruk));
        const p = weakenAll(w, dd);
        // Every Italian port in reach with Italian ships has more of them than the flotilla.
        w.ports.forEach((port, i) => {
          const cell = portSeaOf(w)[i]!;
          if (cell < 0 || w.cells.controller[port.cell] !== ITA || seaKm(w, ...at(tobruk), ...at(cell)) > SORTIE_KM) return;
          const e = zoneEnemy(w, cell);
          if (e > 0) expect(e, port.name).toBeGreaterThan(p);
        });
        greekTurn(w);
        // Not sent home either: it stands where it is.
        expect(w.formations.cols.moving[dd]).toBe(0);
        expect(w.formations.cols.x[dd]).toBe(at(tobruk)[0]);
      });

      // PLAN 7.39b, 7.46c, ADR-580: beyond `SORTIE_KM`, the nearest enemy warfleet of its waters whose
      // zone its navy there can win is chased, before the station. Before, a fleet on station never
      // sought one beyond reach, and late wars' navies stood thousands of km apart until peace.
      /** The seed cell of the zone nearest Tobruk's water beyond `SORTIE_KM`, of its waters, open, with no Italian ship. */
      const farWater = (w: World, from: number): number => {
        const z = seaOf(w);
        const keys = waterKeys(w, GRE);
        const mine = keys[z.zoneOf[from]!]!;
        let best = Infinity;
        let cell = -1;
        for (let zone = 1; zone < z.seedCell.length; zone++) {
          const s = z.seedCell[zone]!;
          if (s < 0 || z.closed[zone] === 1 || keys[zone] !== mine || zoneEnemy(w, s) > 0) continue;
          const d = seaKm(w, ...at(from), ...at(s));
          if (d > SORTIE_KM && d < best) [best, cell] = [d, s];
        }
        expect(cell, 'open water of its waters beyond SORTIE_KM').toBeGreaterThanOrEqual(0);
        return cell;
      };
      /** Fleet `f` with its first `keep` ships of `of` afloat, the rest sunk (a ship is an element of strength 1: halving a strength sinks it). */
      const thin = (w: World, f: number, keep: number, of: number): void => {
        const ec = w.elements.cols;
        const ships: number[] = [];
        w.elements.forEach((e) => void (ec.formation[e] === f && ships.push(e)));
        expect(ships.length).toBe(of);
        ships.slice(keep).forEach((e) => void (ec.strength[e] = 0));
      };
      /**
       * A Greek destroyer flotilla at Tobruk with half its ships, Greece's other fleets sunk: no battle it can
       * win in reach (the blockade case). An Italian destroyer flotilla beyond reach with `keep` of its ships.
       */
      const chaseCase = (keep: number): { w: World; dd: number; sea: number; p: number; enemy: number } => {
        const { w, wing, water } = setup();
        noBombers(w, wing);
        const tobruk = water('Tobruk');
        const dd = addFleet(w, GRE, 'destroyer_flotilla', ...at(tobruk));
        const shipsOf = (f: number): number => {
          let k = 0;
          w.elements.forEach((e) => void (w.elements.cols.formation[e] === f && k++));
          return k;
        };
        const of = shipsOf(dd);
        own({ world: w } as Sim, GRE).forEach((f) => f !== dd && thin(w, f, 0, shipsOf(f)));
        thin(w, dd, Math.floor(of / 2), of);
        const p = fleetPower(w, dd);
        expect(p, 'half a flotilla afloat').toBeGreaterThan(0);
        w.ports.forEach((port, i) => {
          const cell = portSeaOf(w)[i]!;
          if (cell < 0 || w.cells.controller[port.cell] !== ITA || seaKm(w, ...at(tobruk), ...at(cell)) > SORTIE_KM) return;
          const e = zoneEnemy(w, cell);
          if (e > 0) expect(e, port.name).toBeGreaterThan(p);
        });
        const sea = farWater(w, tobruk);
        const ita = addFleet(w, ITA, 'destroyer_flotilla', ...at(sea));
        thin(w, ita, keep, of);
        return { w, dd, sea, p, enemy: zoneEnemy(w, sea) };
      };

      it('the same flotilla at Tobruk sails for an Italian flotilla beyond SORTIE_KM, of its waters, weaker than it (the chase)', () => {
        const { w, dd, sea, p, enemy } = chaseCase(1);
        expect(enemy, 'an Italian ship there').toBeGreaterThan(0);
        expect(enemy).toBeLessThanOrEqual(p);
        greekTurn(w);
        expect(w.formations.cols.moving[dd], 'under way from Tobruk').toBe(1);
        expect(w.formations.cols.targetCell[dd], 'for the far Italian flotilla').toBe(sea);
      });

      it('an Italian flotilla beyond SORTIE_KM stronger than Greece\'s navy of those waters is not chased: the flotilla keeps its station', () => {
        const { w, dd, p, enemy } = chaseCase(Number.MAX_SAFE_INTEGER);
        expect(enemy).toBeGreaterThan(p);
        greekTurn(w);
        expect(w.formations.cols.moving[dd]).toBe(0);
      });
    });

    // PLAN 7.35d2c, ADR-550: a standing enemy warfleet in reach, of the fleet's basin, whose zone the
    // fleets together can win, is a target, wherever it stands; before, only enemy ports were, and a
    // fleet at no enemy port (on station at a partner's or a neutral's) was never sought. An Italian
    // fleet is put in open water nearer the Greek fleet than every Italian port: the open sea's
    // nearest zone to it with no Italian ship, its seed cell not by an Italian port's water.
    describe('seeks the enemy\'s warfleets, not only its ports (PLAN 7.35d2c)', () => {
      const ports = (w: World): number[] => w.ports.flatMap((p, i) => (portSeaOf(w)[i]! >= 0 && w.cells.controller[p.cell] === ITA ? [portSeaOf(w)[i]!] : []));
      /** A water cell nearer (x, y) than every Italian port's water but those (x, y) stands by, by none of them, in a zone with no Italian ship, of (x, y)'s basin, more than `AT_PORT_CELLS` from it. */
      const openWater = (w: World, x: number, y: number): number => {
        const z = seaOf(w);
        const { basin, ocean } = basinOf(w);
        const mine = basinAt(w, x, y);
        const italian = ports(w);
        const room = w.atSize(AT_PORT_CELLS);
        // The ports it stands by aside (Tobruk's own water): the sortie test passes over them.
        const by = (p: number): boolean => Math.abs((p % W) + 0.5 - x) <= room && Math.abs(Math.floor(p / W) + 0.5 - y) <= room;
        const nearestPort = Math.min(...italian.filter((p) => !by(p)).map((p) => seaKm(w, x, y, ...at(p))));
        let best = Infinity;
        let cell = -1;
        for (let zone = 1; zone < z.seedCell.length; zone++) {
          const s = z.seedCell[zone]!;
          if (s < 0 || z.closed[zone] === 1 || (basin[zone] || ocean) !== mine || zoneEnemy(w, s) > 0) continue;
          if (Math.abs((s % W) + 0.5 - x) <= room && Math.abs(Math.floor(s / W) + 0.5 - y) <= room) continue;
          if (italian.some((p) => Math.abs((p % W) - (s % W)) <= room && Math.abs(Math.floor(p / W) - Math.floor(s / W)) <= room)) continue;
          const d = seaKm(w, x, y, ...at(s));
          if (d < nearestPort && d < best) [best, cell] = [d, s];
        }
        expect(cell, 'open water nearer than every Italian port').toBeGreaterThanOrEqual(0);
        return cell;
      };

      it('a Greek flotilla on station at Tobruk sails for an Italian destroyer flotilla in open water nearer than every Italian port, not for an Italian port', () => {
        const { w, wing, water } = setup();
        noBombers(w, wing);
        const tobruk = water('Tobruk');
        const dd = addFleet(w, GRE, 'destroyer_flotilla', ...at(tobruk));
        const sea = openWater(w, ...at(tobruk));
        const ita = addFleet(w, ITA, 'destroyer_flotilla', ...at(sea));
        expect(zoneEnemy(w, sea)).toBe(fleetPower(w, ita));
        greekTurn(w);
        expect(w.formations.cols.moving[dd], 'under way from Tobruk').toBe(1);
        expect(w.formations.cols.targetCell[dd], 'for the Italian flotilla').toBe(sea);
      });

      it('Greece\'s fleet at Athens sorties for an Italian destroyer flotilla in open water nearer than every Italian port', () => {
        const { w, wing } = setup();
        noBombers(w, wing);
        const c = w.formations.cols;
        const athens = own({ world: w } as Sim, GRE).filter((f) => c.moving[f] === 0);
        expect(athens.length, 'a Greek warfleet in port').toBeGreaterThan(0);
        const g = athens[0]!;
        const sea = openWater(w, c.x[g]!, c.y[g]!);
        addFleet(w, ITA, 'destroyer_flotilla', ...at(sea));
        greekTurn(w);
        expect(c.moving[g], 'under way from its port').toBe(1);
        expect(c.targetCell[g], 'for the Italian flotilla').toBe(sea);
      });

      it('an Italian battle squadron there, stronger than Greece\'s fleets together, is no target: the flotilla at Tobruk does not sail for it', () => {
        const { w, wing, water } = setup();
        noBombers(w, wing);
        const tobruk = water('Tobruk');
        const dd = addFleet(w, GRE, 'destroyer_flotilla', ...at(tobruk));
        const sea = openWater(w, ...at(tobruk));
        addFleet(w, ITA, 'battle_squadron', ...at(sea));
        const together = own({ world: w } as Sim, GRE).reduce((s, f) => s + (seaKm(w, w.formations.cols.x[f]!, w.formations.cols.y[f]!, ...at(sea)) <= SORTIE_KM ? fleetPower(w, f) : 0), 0);
        expect(zoneEnemy(w, sea)).toBeGreaterThan(together);
        greekTurn(w);
        expect(w.formations.cols.targetCell[dd] === sea && w.formations.cols.moving[dd] === 1, 'not for the squadron').toBe(false);
      });
    });
  });

  // PLAN 7.35b4c2: a forward base is one with an enemy port in reach that is not empty water under
  // the enemy's naval bombers (no sortie goes there, ADR-544: a fleet staged there would stand).
  it('the United Kingdom at war with Italy: its far fleets do not stage to a base whose Italian ports in reach are all empty under Italy\'s naval bombers', () => {
    /** The goals of the British fleets with no Italian port within SORTIE_KM at the UK's turn, Italy's naval bombers over `cover`'s ports or none; and the Italian ports in reach of the first goal. */
    const run = (cover: number[]): { goals: number[]; inReach: number[]; w: World } => {
      const s = new Sim({ scenario: '1938', seed: 4611, assets: assets1938(W) });
      const w = s.world;
      const c = w.formations.cols;
      expect(declareWar(w, ENG, ITA, true)).not.toBeNull();
      w.nations.cols.aiOff[ITA] = 1;
      // Italy's ships off East Africa sent to Taranto: its ports there are empty water.
      const taranto = w.ports.find((p) => p.name === 'Taranto')!;
      for (const f of own(s, ITA)) if (c.y[f]! > taranto.y + 40) [c.x[f], c.y[f]] = [taranto.x, taranto.y];
      // A naval bomber group of Italy's at the airbase nearest each port's water of `cover`.
      for (const t of cover) {
        let best = Infinity;
        let base = -1;
        w.airbases.forEach((a, i) => {
          const d = seaKm(w, ...w.cellPoint(a.cell), (t % W) + 0.5, Math.floor(t / W) + 0.5);
          if (d < best) [best, base] = [d, i];
        });
        const wing = addFleet(w, ITA, 'naval_bomber_group', ...w.cellPoint(w.airbases[base]!.cell));
        w.wingBase.set(wing, base + 1);
        expect(navalBombers(w, ENG).some((b) => seaKm(w, b.x, b.y, (t % W) + 0.5, Math.floor(t / W) + 0.5) <= b.r), `bombers over ${t}`).toBe(true);
      }
      const enemy = enemyWaters(w, ENG);
      const far = own(s, ENG).filter((f) => Math.min(...enemy.map((e) => kmTo(w, c.x[f]!, c.y[f]!, e))) > SORTIE_KM);
      expect(far.length).toBeGreaterThan(0);
      let d = w.tick / 24;
      while ((d + ENG) % STAGGER !== 0) d++;
      w.tick = d * 24;
      navalAi(w);
      const goals = far.filter((f) => c.moving[f] === 1).map((f) => c.targetCell[f]!);
      expect(goals.length).toBeGreaterThan(0);
      const g = goals[0]!;
      const inReach = enemy.filter((e) => kmTo(w, (g % W) + 0.5, Math.floor(g / W) + 0.5, e) <= SORTIE_KM);
      return { goals, inReach, w };
    };
    const name = (w: World, cell: number): string => w.ports[portSeaOf(w).indexOf(cell)]?.name ?? `cell ${cell}`;
    const before = run([]);
    // The first base's Italian ports in reach, all empty.
    expect(before.inReach.length).toBeGreaterThan(0);
    for (const t of before.inReach) expect(navalPower(before.w).get(seaOf(before.w).zoneOf[t]!)?.get(ITA) ?? 0, name(before.w, t)).toBe(0);
    const after = run(before.inReach);
    process.stderr.write(`ENG–ITA far fleets: without bombers to ${[...new Set(before.goals.map((g) => name(before.w, g)))].join(', ')} (in reach ${before.inReach.map((t) => name(before.w, t)).join(', ')}); with them to ${[...new Set(after.goals.map((g) => name(after.w, g)))].join(', ')}\n`);
    expect(after.goals).not.toContain(before.goals[0]);
  });

  it('at peace a fleet away from its ports sails home', () => {
    const s = new Sim({ scenario: '1938', seed: 4604, assets: assets1938(W) });
    const w = s.world;
    expect(declareWar(w, ENG, ITA, true)).not.toBeNull();
    s.step(7 * 24);
    const away = own(s, ENG).filter((f) => w.formations.cols.moving[f] === 1);
    expect(away.length).toBeGreaterThan(0);
    const war = w.wars.list.find((x) => x.sides.flat().includes(ENG))!;
    makePeace(w, war);
    s.step(30 * 24);
    // Home, or on the way: a port of its bloc's is home (`plan`; since PLAN 7.35b2 the Far East
    // fleets stage to Muscat, Oman's, within reach of Italy's East Africa).
    const homeOrSailing = away.filter((f) => !w.formations.has(f) || w.formations.cols.moving[f] === 1 || w.ports.some((p) => w.cells.controller[p.cell] !== 0 && blocOf(w, w.cells.controller[p.cell]!) === blocOf(w, ENG) &&Math.abs(Math.floor(w.formations.cols.x[f]!) - (p.cell % W)) <= 4 && Math.abs(Math.floor(w.formations.cols.y[f]!) - Math.floor(p.cell / W)) <= 4));
    expect(homeOrSailing.length).toBe(away.length);
  });
});
