import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { seaSide } from '../../src/shared/history';
import { NATIONS_1938, PORTS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { AVOID_RATIO, fleetPower, SORTIE_KM } from '../../src/sim/ai/naval';
import { equipFormation } from '../../src/sim/systems/elements';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { navalPower } from '../../src/sim/systems/seaControl';
import { portSeaOf, seaOf, type World } from '../../src/sim/world';
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
    s.step(7 * 24);
    const sailed = ships.filter((f) => w.formations.has(f) && (w.formations.cols.x[f] !== at.get(f)![0] || w.formations.cols.y[f] !== at.get(f)![1]));
    expect(sailed.length).toBeGreaterThan(0);
    let battle = -1;
    for (let d = 7; d < 60 && battle < 0; d++) {
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
    // Home, or on the way.
    const homeOrSailing = away.filter((f) => !w.formations.has(f) || w.formations.cols.moving[f] === 1 || w.ports.some((p) => w.cells.controller[p.cell] === ENG && Math.abs(Math.floor(w.formations.cols.x[f]!) - (p.cell % W)) <= 4 && Math.abs(Math.floor(w.formations.cols.y[f]!) - Math.floor(p.cell / W)) <= 4));
    expect(homeOrSailing.length).toBe(away.length);
  });
});
