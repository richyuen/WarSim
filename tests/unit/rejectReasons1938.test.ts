import { describe, expect, it } from 'vitest';
import { EventKind, RejectReason } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, PORTS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { orderMove } from '../../src/sim/systems/movement';
import { assets1938 } from '../helpers/earth';
import { addDivision } from '../helpers/sim1938';

// PLAN 4.9a (the critic's R4-B2): `MoveRejected` said nothing of why, so the page could not
// say it. Each refusal now carries its reason in the event's x (y stays NaN: no place).

const { w: W, h: H } = SIZE_1938;
const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const [ENG, GER, FRA, POL] = [id('ENG'), id('GER'), id('FRA'), id('POL')];
const at = (lon: number, lat: number): [number, number] => cellOf(lon, lat, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];

/** The 1938 world, the AI off, with only the war `a` against `d` (or none). */
function world(war?: [number, number]): Sim {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  for (const w of [...s.world.wars.list]) s.world.wars.end(w);
  if (war) s.world.wars.start([war[0]], [war[1]], 0);
  return s;
}

/** Orders formation `f` to (lon, lat) and steps an hour: the reasons of its refusals then. */
function refused(s: Sim, f: number, lon: number, lat: number): number[] {
  const [x, y] = at(lon, lat);
  s.command({ kind: 'moveFormation', id: f, x, y });
  const out: number[] = [];
  s.step(1, (w) => {
    const ev = w.out.events;
    for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && ev[i + 2] === f) out.push(ev[i + 4]!);
    ev.length = 0;
  });
  return out;
}

/** The AI's order (`orderMove` without `byPort`): the reasons of its refusals, at once. */
function refusedAi(s: Sim, f: number, lon: number, lat: number): number[] {
  const ev = s.world.out.events;
  ev.length = 0;
  const [x, y] = at(lon, lat);
  orderMove(s.world, f, x, y);
  const out: number[] = [];
  for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && ev[i + 2] === f) out.push(ev[i + 4]!);
  ev.length = 0;
  return out;
}

const fleetAt = (s: Sim, nation: number): number => {
  let fleet = 0;
  s.world.formations.forEach((f) => {
    if (fleet === 0 && s.world.isFleet(f) && s.world.formations.cols.nation[f] === nation) fleet = f;
  });
  return fleet;
};

const portsmouth = (s: Sim): [number, number] => s.world.cellPoint(s.world.ports.find((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === 'Portsmouth')!.cell);

describe('a refused order says why (PLAN 4.9a)', () => {
  it('by land: no way round a nation outside the war; a march barred on its way', () => {
    const s = world([FRA, id('POR')]);
    const f = addDivision(s.world, FRA, ...at(2.35, 48.86));
    expect(refused(s, f, -8.6, 41.15)).toEqual([RejectReason.NoRoute]);
    // A German march into France; the cells ahead become Poland's (at peace) on the way.
    const t = world([GER, FRA]);
    const g = addDivision(t.world, GER, ...at(13.4, 52.5));
    expect(refused(t, g, 10.0, 48.8)).toEqual([]);
    const path = [...t.world.paths.get(g)!];
    for (const k of path.slice(4)) t.world.setController(k, POL);
    const seen: number[] = [];
    for (let h = 0; h < 24 * 20 && seen.length === 0; h++) {
      t.step(1, (w) => {
        const ev = w.out.events;
        for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && ev[i + 2] === g) seen.push(ev[i + 4]!);
        ev.length = 0;
      });
    }
    expect(seen[0]).toBe(RejectReason.Barred);
  });

  it('no formation of the order\'s kind: an id that is none', () => {
    const s = world();
    expect(refused(s, 60000, 2.35, 48.86)).toEqual([RejectReason.NotLand]);
  });

  it('over the sea: at no port, no transports with room, no water by the target, aboard', () => {
    const s = world([ENG, GER]);
    const inland = addDivision(s.world, ENG, ...at(-1.9, 52.48)); // Birmingham
    // The AI's order is refused; a player's marches to a port with transports (PLAN 4.9b).
    expect(refusedAi(s, inland, 2.35, 48.86)).toEqual([RejectReason.NoPort]);
    const [px, py] = portsmouth(s);
    const far = addDivision(s.world, ENG, px, py);
    expect(refused(s, far, 9.5, 51.3), 'Kassel: no water within reach').toEqual([RejectReason.NoLanding]);
    const div = addDivision(s.world, ENG, px, py);
    expect(refused(s, div, 1.86, 50.95), 'Calais: embarked').toEqual([]);
    expect(s.world.embarked.has(div)).toBe(true);
    expect(refused(s, div, 2.35, 48.86)).toEqual([RejectReason.Aboard]);
    // No British transports left at Portsmouth (to Hamburg: Calais is near enough to snap to a march to Dover).
    const t = world([ENG, GER]);
    for (const f of [...t.world.formations.ids()]) if (t.world.isFleet(f) && t.world.formations.cols.nation[f] === ENG) destroyFormation(t.world, f);
    const [qx, qy] = portsmouth(t);
    const none = addDivision(t.world, ENG, qx, qy);
    expect(refused(t, none, 10.0, 53.55)).toEqual([RejectReason.NoTransports]);
  });

  it('a fleet: to land that is no water and no port; to water no way leads to', () => {
    const s = world();
    const fleet = fleetAt(s, ENG);
    expect(refused(s, fleet, 9.5, 51.3), 'Kassel').toEqual([RejectReason.NotWater]);
    expect(refused(s, fleet, 50.5, 42.0), 'the Caspian').toEqual([RejectReason.NoSeaWay]);
  });

  it('the reason is in x, and y stays NaN: a refusal has no place', () => {
    const s = world();
    const f = addDivision(s.world, FRA, ...at(2.35, 48.86));
    const [x, y] = at(-1.9, 52.48);
    const ev = s.world.out.events;
    ev.length = 0;
    orderMove(s.world, f, x, y);
    let ys: number[] = [];
    for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && ev[i + 2] === f) ys = [ev[i + 4]!, ev[i + 5]!];
    expect(ys[0]).toBe(RejectReason.NoPort);
    expect(Number.isNaN(ys[1])).toBe(true);
  });
});
