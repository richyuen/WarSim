import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, PORTS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex, equipFormation } from '../../src/sim/systems/elements';
import { CONTROL_DAYS, navalPower, seaHolder } from '../../src/sim/systems/seaControl';
import { declareWar } from '../../src/sim/systems/war';
import { portSeaOf, seaOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 4.4a: sea control per zone. AT: a zone with one navy's warships is that navy's from the
// next day; an enemy with half its power or more there contests it; with none of its ships
// there it keeps it for CONTROL_DAYS, then nobody holds it.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const template = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);
const GER = id('GER');
const ENG = id('ENG');
const sim = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 4401, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  return s;
};
const zoneAt = (w: World, lon: number, lat: number): { zone: number; x: number; y: number } => {
  const [x, y] = cellOf(lon, lat, W, H).map(Math.floor) as [number, number];
  return { zone: seaOf(w).zoneOf[y * W + x]!, x: x + 0.5, y: y + 0.5 };
};
const portZone = (w: World, name: string): number => {
  const i = w.ports.findIndex((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === name);
  return seaOf(w).zoneOf[portSeaOf(w)[i]!]!;
};
function fleet(w: World, nation: number, tpl: string, x: number, y: number): number {
  const f = w.formations;
  const fid = f.create();
  f.cols.nation[fid] = nation;
  f.cols.x[fid] = x;
  f.cols.y[fid] = y;
  f.cols.template[fid] = template(tpl);
  f.cols.supply[fid] = 1;
  f.cols.org[fid] = 1;
  equipFormation(w, fid, template(tpl));
  return fid;
}

describe('sea control (PLAN 4.4a)', () => {
  it('the zones of the start\'s bases are their navies\' from the first day: Scapa Flow\'s the United Kingdom\'s, Kiel\'s Germany\'s', () => {
    const s = sim();
    const w = s.world;
    expect(w.seaControl).toBeNull();
    s.step(1); // 00:00 of day 0 is the first tick
    expect(seaHolder(w, portZone(w, 'Scapa Flow'))).toBe(ENG);
    expect(seaHolder(w, portZone(w, 'Kiel'))).toBe(GER);
    expect(seaHolder(w, portZone(w, 'Yokosuka'))).toBe(id('JAP'));
    // A zone with no warship in it is nobody's: the middle of the South Pacific.
    expect(seaHolder(w, zoneAt(w, -130, -40).zone)).toBe(0);
    const held = [...w.seaControl!.holder].filter((h) => h !== 0).length;
    process.stderr.write(`zones held on the first day: ${held} of ${seaOf(w).count}\n`);
  });

  it('power is the hit points of armed ships: a transport group holds nothing', () => {
    const s = sim();
    const w = s.world;
    const sea = zoneAt(w, -130, -40);
    const tp = fleet(w, ENG, 'transport_group', sea.x, sea.y);
    expect(navalPower(w).get(sea.zone)).toBeUndefined();
    const dd = fleet(w, ENG, 'destroyer_flotilla', sea.x, sea.y);
    expect(navalPower(w).get(sea.zone)?.get(ENG)).toBe(8 * 150);
    s.step(1);
    expect(seaHolder(w, sea.zone)).toBe(ENG);
    void tp;
    void dd;
  });

  it('an enemy with half the holder\'s power contests the zone, one with less does not; at peace the larger navy holds it', () => {
    const s = sim();
    const w = s.world;
    const sea = zoneAt(w, -130, -40);
    fleet(w, ENG, 'cruiser_squadron', sea.x, sea.y); // 2 × 700 + 2 × 400 + 4 × 150 = 2,800
    const dd = fleet(w, GER, 'destroyer_flotilla', sea.x + 3, sea.y); // 1,200: less than half
    expect(declareWar(w, GER, ENG, true)).not.toBeNull();
    s.step(1);
    expect(seaHolder(w, sea.zone)).toBe(ENG);
    // A second flotilla: 2,400 of 2,800, contested.
    const dd2 = fleet(w, GER, 'destroyer_flotilla', sea.x + 3, sea.y);
    s.step(24);
    expect(seaHolder(w, sea.zone)).toBe(0);
    // The same two flotillas of a nation at peace with it, France's: the larger navy holds it.
    for (const f of [dd, dd2]) w.formations.cols.nation[f] = id('FRA');
    s.step(24);
    expect(seaHolder(w, sea.zone)).toBe(ENG);
  });

  it('with none of its ships there a zone stays its holder\'s for CONTROL_DAYS days, then nobody\'s', () => {
    const s = sim();
    const w = s.world;
    const sea = zoneAt(w, -130, -40);
    const dd = fleet(w, ENG, 'destroyer_flotilla', sea.x, sea.y);
    s.step(1);
    expect(seaHolder(w, sea.zone)).toBe(ENG);
    // Gone: held at each day's start up to the 14th, nobody's from the 14th's.
    w.formations.cols.x[dd] = zoneAt(w, -100, -55).x;
    w.formations.cols.y[dd] = zoneAt(w, -100, -55).y;
    expect(zoneAt(w, -100, -55).zone).not.toBe(sea.zone);
    for (let d = 1; d < CONTROL_DAYS; d++) {
      s.step(24);
      expect(seaHolder(w, sea.zone), `day ${d}`).toBe(ENG);
    }
    s.step(24);
    expect(seaHolder(w, sea.zone)).toBe(0);
  });

  it('a save holds the sea control: loaded, the same hash and the same days later', () => {
    const s = sim();
    s.step(3 * 24);
    expect(s.world.seaControl!.holder.some((h) => h !== 0)).toBe(true);
    const t = new Sim({ scenario: '1938', seed: 4401, assets: assets1938(W) });
    t.load(s.save());
    expect(t.hash()).toBe(s.hash());
    expect([...t.world.seaControl!.holder]).toEqual([...s.world.seaControl!.holder]);
    s.step(48);
    t.step(48);
    expect(t.hash()).toBe(s.hash());
  });

  it('every fleet of the start counts in the zone it stands in', () => {
    const w = sim().world;
    const power = navalPower(w);
    let total = 0;
    for (const m of power.values()) for (const p of m.values()) total += p;
    let ships = 0;
    w.formations.forEach((fid) => {
      if (!w.afloat(fid)) return;
      for (const e of elementIndex(w).get(fid) ?? []) {
        const u = w.rules!.units[w.elements.cols.unit[e]!]!;
        // A submarine holds no sea since PLAN 4.4d.
        if (u.cls !== 'ss' && (u.hard > 0 || u.torpedo > 0)) ships += u.hpPerUnit * w.elements.cols.strength[e]!;
      }
    });
    expect(total).toBe(ships);
  });
});
