import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, RULES_1938, SIZE_1938, TEMPLATES_1938, UNIT_IDS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex, equipFormation, settleFormation } from '../../src/sim/systems/elements';
import { findSeaBattles, nextRange, seaKm } from '../../src/sim/systems/navalCombat';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 4.3a: detection, contact and gunnery by range. AT: a battleship line beats a light
// cruiser line at range: it sinks them, and takes no hit while the range is beyond theirs.

const { w: W } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const template = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);
const unit = (u: string): number => UNIT_IDS_1938.indexOf(u);
const GER = id('GER');
const ENG = id('ENG');

/** A 1938 world with the AI off and Germany at war with the United Kingdom. */
function atWar(): Sim {
  const s = new Sim({ scenario: '1938', seed: 4301, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  expect(declareWar(s.world, GER, ENG, true)).not.toBeNull();
  return s;
}

/** A fleet of `tpl` for `nation` at (x, y) in cells, keeping only the ships of `keep` (all when left out). */
function fleet(world: World, nation: number, tpl: string, x: number, y: number, keep?: string): number {
  const f = world.formations;
  const fid = f.create();
  f.cols.nation[fid] = nation;
  f.cols.x[fid] = x;
  f.cols.y[fid] = y;
  f.cols.template[fid] = template(tpl);
  f.cols.supply[fid] = 1;
  f.cols.org[fid] = 1;
  equipFormation(world, fid, template(tpl));
  if (keep !== undefined) {
    for (const e of elementIndex(world).get(fid)!) if (world.elements.cols.unit[e] !== unit(keep)) world.elements.cols.strength[e] = 0;
    settleFormation(world, fid);
  }
  expect(world.afloat(fid)).toBe(true);
  return fid;
}

/** Open water in the middle of the North Atlantic, and the cells east of it `km` away on its row. */
function openSea(world: World, km: number): { x: number; y: number; x2: number } {
  const [cx, cy] = cellOf(-32, 47, W, SIZE_1938.h).map(Math.floor) as [number, number];
  const g = navOf(world).grid;
  return { x: cx + 0.5, y: cy + 0.5, x2: cx + 0.5 + km / g.kx[cy]! };
}

const ships = (world: World, fid: number, u: string): number => (world.formations.has(fid) ? (elementIndex(world).get(fid) ?? []).filter((e) => world.elements.cols.unit[e] === unit(u) && world.elements.cols.strength[e]! > 0).length : 0);
const hp = (world: World, fid: number): number => {
  if (!world.formations.has(fid)) return 0;
  const ec = world.elements.cols;
  return (elementIndex(world).get(fid) ?? []).reduce((s, e) => s + (ec.strength[e]! - ec.wound[e]!) * RULES_1938.units[ec.unit[e]!]!.hpPerUnit, 0);
};

describe('the range of a sea battle (PLAN 4.3a)', () => {
  it('beyond both reaches both close; between them the shorter closes by what its pace has over the other\'s; within both it stays', () => {
    // BB line reach 32, 50 km/h; CL line reach 18, 59 km/h.
    expect(nextRange(200, 32, 50, 18, 59)).toBe(91);
    expect(nextRange(60, 32, 50, 18, 59)).toBe(32);
    expect(nextRange(28, 32, 50, 18, 59)).toBe(19);
    expect(nextRange(19, 32, 50, 18, 59)).toBe(18);
    expect(nextRange(18, 32, 50, 18, 59)).toBe(18);
    expect(nextRange(10, 32, 50, 18, 59)).toBe(10);
    // The sides the other way round: the same.
    expect(nextRange(28, 18, 59, 32, 50)).toBe(19);
    // A shorter reach that is slower cannot close: the longer holds the range.
    expect(nextRange(28, 32, 60, 18, 50)).toBe(28);
    // A side with no gun is closed on by the other to its reach, and no further.
    expect(nextRange(28, 0, 30, 18, 59)).toBe(18);
    expect(nextRange(12, 0, 30, 18, 59)).toBe(12);
  });
});

describe('detection and contact (PLAN 4.3a)', () => {
  it('a fleet sees an enemy within its best ship\'s detection less the enemy\'s stealth; submarines are seen closer', () => {
    const s = atWar();
    const w = s.world;
    const near = openSea(w, 25);
    const dd = fleet(w, ENG, 'destroyer_flotilla', near.x, near.y);
    // A German cruiser squadron 25 km off: the destroyers see 30 × (1 − 0.04) = 28.8 km.
    const ca = fleet(w, GER, 'cruiser_squadron', near.x2, near.y);
    expect(seaKm(w, near.x, near.y, near.x2, near.y)).toBeCloseTo(25, 6);
    let battles = findSeaBattles(w);
    expect(battles.map((b) => b.fleets)).toEqual([[dd, ca].sort((a, b) => a - b)]);
    expect(battles[0]!.km).toBeCloseTo(25, 6);
    expect([w.formations.cols.engaged[dd], w.formations.cols.engaged[ca]]).toEqual([1, 1]);
    // A submarine flotilla in its place, 25 km off: seen at 30 × (1 − 0.40) = 18 km, and it sees 12 × 0.92.
    w.formations.cols.x[ca] = near.x2 + 10;
    const ss = fleet(w, GER, 'submarine_flotilla', near.x2, near.y);
    battles = findSeaBattles(w);
    expect(battles).toEqual([]);
    const at = openSea(w, 15);
    w.formations.cols.x[ss] = at.x2;
    expect(findSeaBattles(w).map((b) => b.fleets)).toEqual([[dd, ss].sort((a, b) => a - b)]);
    // Two fleets of nations at peace are in no battle; nor two with no gun between them.
    const FRA = id('FRA');
    const fr = fleet(w, FRA, 'destroyer_flotilla', at.x2, at.y);
    expect(findSeaBattles(w).flatMap((b) => b.fleets)).not.toContain(fr);
  });
});

describe('gunnery by range: the AT (PLAN 4.3a)', () => {
  /** Four battleships against four light cruisers, `km` apart; hours until one side is gone, with what each side had each hour. */
  function fight(km: number): { hours: number; bbHit: number[]; clLeft: number[]; bbLeft: number; ranges: number[] } {
    const s = atWar();
    const w = s.world;
    const sea = openSea(w, km);
    const bb = fleet(w, GER, 'battle_squadron', sea.x, sea.y, 'battleship');
    const cl1 = fleet(w, ENG, 'cruiser_squadron', sea.x2, sea.y, 'cruiser_light');
    const cl2 = fleet(w, ENG, 'cruiser_squadron', sea.x2, sea.y, 'cruiser_light');
    expect([ships(w, bb, 'battleship'), ships(w, cl1, 'cruiser_light') + ships(w, cl2, 'cruiser_light')]).toEqual([4, 4]);
    const full = hp(w, bb);
    const bbHit: number[] = [];
    const clLeft: number[] = [];
    const ranges: number[] = [];
    let hours = 0;
    while (hours < 48 && w.formations.has(bb) && (w.formations.has(cl1) || w.formations.has(cl2))) {
      s.step(1);
      hours++;
      bbHit.push(full - hp(w, bb));
      clLeft.push(ships(w, cl1, 'cruiser_light') + ships(w, cl2, 'cruiser_light'));
      ranges.push(w.seaRange.get(bb) ?? NaN);
    }
    return { hours, bbHit, clLeft, bbLeft: ships(w, bb, 'battleship'), ranges };
  }

  it('from 24 km the battleships sink the cruisers, and take no hit until the cruisers have closed to their 18 km', () => {
    // 24 km: the cruisers see the battleships (25 × 0.98 = 24.5 km); the battleships would see
    // the cruisers at 18 × 0.95 = 17.1 km. Contact is by either side.
    const r = fight(24);
    process.stderr.write(`BB line against CL line from 24 km: ${r.hours} h; ranges ${r.ranges.map((x) => x.toFixed(0)).join(' ')}; cruisers left ${r.clLeft.join(' ')}; battleships' hit points lost ${r.bbHit.map((x) => x.toFixed(0)).join(' ')}; battleships left ${r.bbLeft}\n`);
    expect(r.clLeft[r.clLeft.length - 1]).toBe(0);
    expect(r.bbLeft).toBe(4);
    // The first hour at 24 km, beyond the light cruisers' 18 km: no hit taken.
    expect(r.ranges[0]).toBeCloseTo(24, 6);
    expect(r.bbHit[0]).toBe(0);
    // Then they close by 9 km an hour (59 against 50) to their 18 km, and both fire.
    expect(r.ranges[1]).toBe(18);
    expect(r.bbHit[r.bbHit.length - 1]).toBeGreaterThan(0);
  });

  it('within the cruisers\' reach from the first hour, the battleships take more: the range is what spared them', () => {
    const far = fight(24);
    const near = fight(15);
    expect(near.bbLeft).toBe(4);
    expect(near.clLeft[near.clLeft.length - 1]).toBe(0);
    expect(near.bbHit[0]).toBeGreaterThan(0);
    expect(near.bbHit[near.bbHit.length - 1]).toBeGreaterThan(far.bbHit[far.bbHit.length - 1]!);
  });

  it('a ship sunk is its element\'s end; a fleet with none left is gone, and its range with it', () => {
    const s = atWar();
    const w = s.world;
    const sea = openSea(w, 20);
    const bb = fleet(w, GER, 'battle_squadron', sea.x, sea.y);
    const dd = fleet(w, ENG, 'destroyer_flotilla', sea.x2, sea.y);
    const ends: number[] = [];
    let hours = 0;
    while (w.formations.has(dd) && hours < 48) {
      s.step(1, (world) => {
        const ev = world.out.events;
        for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.ElementDestroyed) ends.push(ev[i + 2]!);
        ev.length = 0;
      });
      hours++;
    }
    expect(w.formations.has(dd)).toBe(false);
    expect(ends.length).toBeGreaterThanOrEqual(8);
    expect(w.seaRange.has(dd)).toBe(false);
    // The battle is over: the squadron holds no range and is not engaged the hour after.
    s.step(1);
    expect(w.seaRange.size).toBe(0);
    expect(w.formations.cols.engaged[bb]).toBe(0);
  });

  it('a save in the middle of a sea battle loads to the same state and goes on the same', () => {
    const s = atWar();
    const w = s.world;
    const sea = openSea(w, 24);
    fleet(w, GER, 'battle_squadron', sea.x, sea.y);
    fleet(w, ENG, 'cruiser_squadron', sea.x2, sea.y);
    s.step(2);
    expect(w.seaRange.size).toBe(2);
    const bytes = s.save();
    const t = new Sim({ scenario: '1938', seed: 4301, assets: assets1938(W) });
    t.load(bytes);
    expect(t.hash()).toBe(s.hash());
    expect([...t.world.seaRange]).toEqual([...w.seaRange]);
    s.step(3);
    t.step(3);
    expect(t.hash()).toBe(s.hash());
  });
});

describe('torpedoes and the screen (PLAN 4.3b)', () => {
  /** The volleys of an hour: [shooter's unit id, target's unit id, damage in ships]. */
  function volleys(s: Sim): [string, string, number][] {
    const out: [string, string, number][] = [];
    s.step(1, (world) => {
      const fr = world.out.fires;
      // The target's unit is read before the hour's losses are settled: by the shooter's table.
      for (let i = 0; i < fr.length; i += 10) out.push([UNIT_IDS_1938[fr[i + 4]!]!, UNIT_IDS_1938[world.elements.has(fr[i + 3]!) ? world.elements.cols.unit[fr[i + 3]!]! : 0]!, fr[i + 5]!]);
      fr.length = 0;
      world.out.events.length = 0;
    });
    return out;
  }

  it('a torpedo has no armour against it: a destroyer\'s on a battleship is 40 × 2 / 2,000 of a ship, its gun 6 × 0.5 × 2 / 2,000; beyond 10 km only the gun', () => {
    for (const [km, torpedoes] of [[8, true], [11, false]] as const) {
      const s = atWar();
      const w = s.world;
      const sea = openSea(w, km);
      fleet(w, GER, 'battle_squadron', sea.x, sea.y, 'battleship');
      fleet(w, ENG, 'destroyer_flotilla', sea.x2, sea.y);
      const v = volleys(s).filter(([from]) => from === 'destroyer');
      expect(v.length, `${km} km`).toBeGreaterThan(0);
      for (const [, to] of v) expect(to).toBe('battleship');
      const kinds = [...new Set(v.map(([, , d]) => d.toFixed(6)))].sort();
      expect(kinds, `${km} km`).toEqual(torpedoes ? [(0.003).toFixed(6), (0.04).toFixed(6)] : [(0.003).toFixed(6)]);
    }
  });

  it('no gun or torpedo is aimed at a submarine; destroyers\' depth charges are, whatever the range', () => {
    const s = atWar();
    const w = s.world;
    const sea = openSea(w, 12);
    fleet(w, GER, 'submarine_flotilla', sea.x, sea.y);
    fleet(w, ENG, 'battle_squadron', sea.x2, sea.y);
    const v = volleys(s);
    // Hits on the submarines are the destroyers' only, of their depth charges: 10 × 2 / 100.
    const onSubs = v.filter(([, to]) => to === 'submarine');
    expect(onSubs.length).toBeGreaterThan(0);
    for (const [from, , d] of onSubs) {
      expect(from).toBe('destroyer');
      expect(d).toBeCloseTo(0.2, 9);
    }
    // The submarines' torpedoes reach at 12 km, beyond their 6: they close submerged.
    expect(v.some(([from, , d]) => from === 'submarine' && d > 0.01)).toBe(true);
  });

  it('the AT: a submarine flotilla\'s hits on a battle squadron\'s larger ships fall with its destroyers', () => {
    /** The hit points the squadron's ships but its destroyers lose in `hours`, and the submarines it sinks. */
    function attack(screened: boolean, hours: number): { lost: number; subsLeft: number } {
      const s = atWar();
      const w = s.world;
      const sea = openSea(w, 12);
      const ss = fleet(w, GER, 'submarine_flotilla', sea.x, sea.y);
      const bs = fleet(w, ENG, 'battle_squadron', sea.x2, sea.y);
      if (!screened) {
        for (const e of elementIndex(w).get(bs)!) if (w.elements.cols.unit[e] === unit('destroyer')) w.elements.cols.strength[e] = 0;
        settleFormation(w, bs);
      }
      const big = (): number => {
        const ec = w.elements.cols;
        return (elementIndex(w).get(bs) ?? []).filter((e) => ec.unit[e] !== unit('destroyer')).reduce((sum, e) => sum + (ec.strength[e]! - ec.wound[e]!) * RULES_1938.units[ec.unit[e]!]!.hpPerUnit, 0);
      };
      const before = big();
      s.step(hours);
      return { lost: before - big(), subsLeft: ships(w, ss, 'submarine') };
    }
    const bare = attack(false, 3);
    const screened = attack(true, 3);
    process.stderr.write(`a submarine flotilla on a battle squadron, 3 hours: its larger ships lose ${screened.lost.toFixed(0)} hit points with its 8 destroyers, ${bare.lost.toFixed(0)} with none; submarines left ${screened.subsLeft} and ${bare.subsLeft}\n`);
    expect(bare.lost).toBeGreaterThan(0);
    // A full screen (8 destroyers to 8 larger ships) takes 0.6 of each torpedo, and the
    // destroyers draw some of the torpedoes and sink submarines: well under half.
    expect(screened.lost).toBeLessThan(0.5 * bare.lost);
    // With no destroyer nothing hunts the submarines.
    expect(bare.subsLeft).toBe(8);
    expect(screened.subsLeft).toBeLessThan(8);
  });
});
