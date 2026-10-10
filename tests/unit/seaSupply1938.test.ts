import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, PORTS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { seaControlOf } from '../../src/sim/systems/seaControl';
import { seaLinked, zoneLinks } from '../../src/sim/systems/seaSupply';
import { blocOf } from '../../src/sim/systems/supply';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, portSeaOf, seaOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision } from '../helpers/sim1938';

// PLAN 4.4c: supply over sea. AT: an overseas formation loses supply when the lane is cut: a
// British division on Malta, fed by Malta's cities while a way by sea joins Malta's port to a
// port of Britain, goes dry when Italy holds the sea about Malta.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const ENG = id('ENG');
const ITA = id('ITA');
const sim = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 4403, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  return s;
};
const compAt = (w: World, lon: number, lat: number): { comp: number; x: number; y: number } => {
  const [x, y] = cellOf(lon, lat, W, H).map(Math.floor) as [number, number];
  return { comp: navOf(w).grid.component[y * W + x]!, x: x + 0.5, y: y + 0.5 };
};
/** The zones of the water of the ports of the British bloc on component `comp` (owned and held by a member). */
const portZones = (w: World, comp: number): number[] => {
  const water = portSeaOf(w);
  const z = seaOf(w);
  const out = new Set<number>();
  w.ports.forEach((p, i) => {
    const ctl = w.cells.controller[p.cell]!;
    if (navOf(w).grid.component[p.cell] === comp && ctl !== 0 && w.cells.owner[p.cell] === ctl && blocOf(w, ctl) === ENG && water[i]! >= 0) out.add(z.zoneOf[water[i]!]!);
  });
  return [...out];
};

describe('supply over sea (PLAN 4.4c)', () => {
  it('the AT: a British division on Malta is fed while the sea is open, and goes dry when Italy holds the zone of Malta\'s ports', () => {
    const s = sim();
    const w = s.world;
    const malta = compAt(w, 14.45, 35.9);
    expect(malta.comp).not.toBe(compAt(w, -0.1, 51.5).comp);
    const zones = portZones(w, malta.comp);
    expect(zones.length).toBeGreaterThan(0);
    expect(declareWar(w, ITA, ENG, true)).not.toBeNull();
    const div = addDivision(w, ENG, malta.x, malta.y);
    // The first day's sea control: Italy's fleets hold the zones about Malta's (Malta's own is
    // Britain's), and every way from a British home port to it goes through one.
    s.step(1);
    expect(zones.every((z) => seaControlOf(w).holder[z] === ENG)).toBe(true);
    expect(seaLinked(w, ENG)).not.toContain(malta.comp);
    // The sea open (nobody holds a zone) until the next day's sea control.
    const sc = seaControlOf(w);
    sc.holder.fill(0);
    expect(seaLinked(w, ENG)).toContain(malta.comp);
    s.step(12 - w.tick + 1); // the refresh of hour 12
    const cell = Math.floor(malta.y) * W + Math.floor(malta.x);
    expect(w.cells.supply[cell]).toBe(ENG);
    expect(w.formations.cols.supply[div]).toBe(1);
    // Italy holds the zones of Malta's ports: the refresh of hour 24 leaves Malta out.
    for (const z of zones) sc.holder[z] = ITA;
    s.step(24 - w.tick + 1);
    expect(w.cells.supply[cell]).toBe(0);
    s.step(8);
    expect(w.formations.cols.supply[div]).toBe(0);
    // The sea open again (no sea control runs again until hour 48): fed after the refresh of hour 36.
    sc.holder.fill(0);
    s.step(36 - w.tick + 8);
    expect(w.cells.supply[cell]).toBe(ENG);
    expect(w.formations.cols.supply[div]).toBe(1);
  });

  it('a zone held on one way is not a cut where another way is open; the whole sea held cuts every land of ports but home', () => {
    const s = sim();
    const w = s.world;
    const malta = compAt(w, 14.45, 35.9);
    expect(declareWar(w, ITA, ENG, true)).not.toBeNull();
    s.step(1);
    const sc = seaControlOf(w);
    // The zone of Gibraltar's water: the Mediterranean has the way by Suez too.
    const gib = w.ports.findIndex((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === 'Gibraltar');
    const gibZone = seaOf(w).zoneOf[portSeaOf(w)[gib]!]!;
    sc.holder.fill(0);
    sc.holder[gibZone] = ITA;
    expect(seaLinked(w, ENG)).toContain(malta.comp);
    // Every zone held by Italy: Malta is cut; home is not (Britain's island, and the land of
    // most British cities, India's); nor is a land of British cities with no British port.
    const open = seaLinked(w, ENG);
    sc.holder.fill(ITA);
    sc.holder[0] = 0;
    const cut = seaLinked(w, ENG);
    expect(cut).not.toContain(malta.comp);
    expect(cut).toContain(compAt(w, -0.1, 51.5).comp);
    expect(cut).toContain(compAt(w, 77.2, 28.6).comp);
    const portless = open.filter((c) => portZones(w, c).length === 0);
    for (const c of portless) expect(cut).toContain(c);
    process.stderr.write(`British lands fed: ${open.length} with the sea open, ${cut.length} with every zone held (${portless.length} of them with no British port)\n`);
  });

  it('the zones a passage joins are joined: Suez joins the Mediterranean to the Red Sea', () => {
    const w = sim().world;
    const links = zoneLinks(w);
    const z = seaOf(w);
    const at = (lon: number, lat: number): number => z.zoneOf[cellOf(lon, lat, W, H).map(Math.floor).reduce((x, y) => y * W + x)]!;
    const north = at(32.2, 31.6);
    const south = at(32.6, 29.6);
    expect(north).not.toBe(0);
    expect(south).not.toBe(0);
    expect(z.adj[north]!.includes(south)).toBe(false);
    expect(links[north]).toContain(south);
  });

  it('at the start of 1938 no bloc has a city cut off by sea, Brazil (its capital\'s cell a patch of its own) among them', () => {
    const w = sim().world;
    const comp = navOf(w).grid.component;
    const linked = new Map<number, Set<number>>();
    const cut: string[] = [];
    w.cities.forEach((c) => {
      const cell = w.cities.cols.cell[c]!;
      const ctl = w.cells.controller[cell]!;
      if (ctl === 0 || w.cells.owner[cell] !== ctl || comp[cell] === 0) return;
      const b = blocOf(w, ctl);
      if (!linked.has(b)) linked.set(b, new Set(seaLinked(w, b)));
      if (!linked.get(b)!.has(comp[cell]!)) cut.push(NATIONS_1938[b - 1]!.tag);
    });
    expect(cut).toEqual([]);
    const BRA = id('BRA');
    const rio = w.nations.cols;
    expect(comp[Math.floor(rio.capitalY[BRA]!) * W + Math.floor(rio.capitalX[BRA]!)]).not.toBe(compAt(w, -47.9, -15.8).comp);
  });
});
