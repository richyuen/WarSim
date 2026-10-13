import { describe, expect, it } from 'vitest';
import { EventKind, RejectReason } from '../../src/shared/events';
import { airbaseRoom } from '../../src/sim/data/airbases';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { basePlace, kmFromBase, orderMission, orderRebase, wingAircraft, wingRange } from '../../src/sim/systems/air';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.1e, the AT of 5.1: a wing's range is the least range of its aircraft, from its base (an
// airbase, or a carrier, which moves with its fleet); a mission beyond it is refused with its
// reason; a wing rebases to its side's airbase or carrier in range with room; saved.

const [GER, USA] = ['GER', 'USA'].map(nationId) as [number, number];
const at = (lon: number, lat: number): [number, number] => cellOf(lon, lat, SIZE_1938.w, SIZE_1938.h);
const template = (w: World, id: number): string => TEMPLATES_1938[w.formations.cols.template[id]!]!.id;
const wingOf = (w: World, nation: number, t: string, onCarrier = false): number =>
  [...w.wingBase].find(([id, b]) => w.formations.cols.nation[id] === nation && template(w, id) === t && b < 0 === onCarrier)![0];
const rejections = (w: World): number[] => {
  const out: number[] = [];
  for (let i = 0; i < w.out.events.length; i += 6) if (w.out.events[i + 1] === EventKind.MoveRejected) out.push(w.out.events[i + 4]!);
  w.out.events.length = 0;
  return out;
};
const sim = (): Sim => new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });

describe('a wing\'s range from its base (PLAN 5.1e)', () => {
  const s = sim();
  const w = s.world;
  const c = w.formations.cols;

  it('the least range of its aircraft: a fighter group 800 km, a strategic bomber group 3,000', () => {
    expect(wingRange(w, wingOf(w, GER, 'fighter_group'))).toBe(800);
    const heavy = [...w.wingBase.keys()].find((id) => template(w, id) === 'strategic_bomber_group')!;
    expect(wingRange(w, heavy)).toBe(3000);
  });

  it('a mission within range is kept; one beyond it is refused, OutOfRange, and the last one stands', () => {
    w.out.events.length = 0;
    const fighter = wingOf(w, GER, 'fighter_group');
    const prague = at(14.4, 50.1);
    const madrid = at(-3.7, 40.4);
    expect(kmFromBase(w, fighter, ...prague)).toBeLessThan(800);
    expect(kmFromBase(w, fighter, ...madrid)).toBeGreaterThan(800);
    expect(orderMission(w, fighter, 'patrol', ...prague)).toBe(0);
    expect(w.wingMission.get(fighter)).toEqual({ kind: 'patrol', x: prague[0], y: prague[1] });
    expect(orderMission(w, fighter, 'strike', ...madrid)).toBe(RejectReason.OutOfRange);
    expect(w.wingMission.get(fighter)).toEqual({ kind: 'patrol', x: prague[0], y: prague[1] });
    expect(rejections(w)).toEqual([RejectReason.OutOfRange]);
    // A land formation is no wing.
    const division = [...w.formations.ids()].find((id) => c.nation[id] === GER && !w.offLand(id))!;
    expect(orderMission(w, division, 'strike', ...prague)).toBe(RejectReason.NotLand);
    expect(w.wingMission.has(division)).toBe(false);
    // A strategic bomber group reaches what a fighter group does not.
    const heavy = [...w.wingBase.keys()].find((id) => template(w, id) === 'strategic_bomber_group')!;
    const [hx, hy] = basePlace(w, w.wingBase.get(heavy)!)!;
    const far = w.airbases.map((b) => w.cellPoint(b.cell)).find((p) => {
      const km = kmFromBase(w, heavy, ...p);
      return km > 1500 && km < 3000;
    })!;
    expect(far).toBeDefined();
    expect(orderMission(w, heavy, 'strike', ...far)).toBe(0);
    expect(w.wingMission.get(heavy)!.kind).toBe('strike');
    expect([c.x[heavy], c.y[heavy]]).toEqual([hx, hy]);
    rejections(w);
  });

  it('a carrier wing\'s range is from its fleet, wherever the fleet is', () => {
    const wing = [...w.wingBase].find(([, b]) => b < 0)![0];
    const fleet = -w.wingBase.get(wing)!;
    const [fx, fy] = [c.x[fleet]!, c.y[fleet]!];
    expect(kmFromBase(w, wing, fx, fy)).toBe(0);
    expect(orderMission(w, wing, 'strike', fx, fy)).toBe(0);
    // The fleet sails off a quarter of the world along its row: the old place is out of the wing's range.
    c.x[fleet] = (fx + w.cells.w / 4) % w.cells.w;
    expect(kmFromBase(w, wing, fx, fy)).toBeGreaterThan(wingRange(w, wing));
    expect(orderMission(w, wing, 'strike', fx, fy)).toBe(RejectReason.OutOfRange);
    c.x[fleet] = fx;
    rejections(w);
  });
});

describe('rebasing (PLAN 5.1e)', () => {
  it('to its own airbase in range with room: there at once, its mission ended', () => {
    const w = sim().world;
    const c = w.formations.cols;
    const fighter = wingOf(w, GER, 'fighter_group');
    const from = w.wingBase.get(fighter)!;
    const to = w.airbases.findIndex((b, i) => i + 1 !== from && w.cells.controller[b.cell] === GER && kmFromBase(w, fighter, ...w.cellPoint(b.cell)) < 800) + 1;
    expect(to).toBeGreaterThan(0);
    // Room for it there: clear the base of what else is at it.
    for (const [id, b] of w.wingBase) if (b === to) w.wingBase.set(id, from);
    orderMission(w, fighter, 'patrol', c.x[fighter]!, c.y[fighter]!);
    const [tx, ty] = w.cellPoint(w.airbases[to - 1]!.cell);
    expect(orderRebase(w, fighter, tx, ty)).toBe(0);
    expect(w.wingBase.get(fighter)).toBe(to);
    expect([c.x[fighter], c.y[fighter]]).toEqual([tx, ty]);
    expect(w.wingMission.has(fighter)).toBe(false);
  });

  it('refused: a full airbase or another side\'s is NoBase; one of its own beyond its range is OutOfRange', () => {
    const w = sim().world;
    const c = w.formations.cols;
    w.out.events.length = 0;
    const fighter = wingOf(w, GER, 'fighter_group');
    const from = w.wingBase.get(fighter)!;
    const to = w.airbases.findIndex((b, i) => i + 1 !== from && w.cells.controller[b.cell] === GER && kmFromBase(w, fighter, ...w.cellPoint(b.cell)) < 800) + 1;
    const base = w.airbases[to - 1]!;
    // Fill it: German wings moved there until no fighter group fits.
    let used = 0;
    for (const [id, b] of w.wingBase) if (b === to) used += wingAircraft(w, c.template[id]!);
    for (const [id, b] of w.wingBase) {
      if (used + wingAircraft(w, c.template[fighter]!) > airbaseRoom(base)) break;
      if (id === fighter || b === to || b < 0) continue;
      w.wingBase.set(id, to);
      used += wingAircraft(w, c.template[id]!);
    }
    expect(orderRebase(w, fighter, ...w.cellPoint(base.cell))).toBe(RejectReason.NoBase);
    // A French airbase, at peace.
    const paris = w.airbases.find((b) => b.name === 'Le Bourget')!;
    expect(orderRebase(w, fighter, ...w.cellPoint(paris.cell))).toBe(RejectReason.NoBase);
    // Nothing there at all.
    expect(orderRebase(w, fighter, ...at(-30, 0))).toBe(RejectReason.NoBase);
    // An American fighter group: March Field is the other side of the continent from Langley.
    const yank = [...w.wingBase].find(([id, b]) => c.nation[id] === USA && template(w, id) === 'fighter_group' && b > 0 && w.airbases[b - 1]!.name !== 'March Field')![0];
    const march = w.airbases.find((b) => b.name === 'March Field')!;
    expect(kmFromBase(w, yank, ...w.cellPoint(march.cell))).toBeGreaterThan(800);
    expect(orderRebase(w, yank, ...w.cellPoint(march.cell))).toBe(RejectReason.OutOfRange);
    expect(w.wingBase.get(fighter)).toBe(from);
    expect(rejections(w)).toEqual([RejectReason.NoBase, RejectReason.NoBase, RejectReason.NoBase, RejectReason.OutOfRange]);
  });

  it('to a carrier of its nation\'s with a deck free', () => {
    const w = sim().world;
    const c = w.formations.cols;
    const [wing, base] = [...w.wingBase].find(([, b]) => b < 0)!;
    const fleet = -base;
    const nation = c.nation[wing]!;
    // A land-based wing of the same nation within range of the fleet, its carrier's decks freed of one.
    const other = [...w.wingBase].find(([id, b]) => b > 0 && c.nation[id] === nation && kmFromBase(w, id, c.x[fleet]!, c.y[fleet]!) < wingRange(w, id));
    expect(other).toBeDefined();
    const [id] = other!;
    expect(orderRebase(w, id, c.x[fleet]!, c.y[fleet]!)).toBe(RejectReason.NoBase); // its decks are full
    w.wingBase.set(wing, w.wingBase.get(id)!);
    expect(orderRebase(w, id, c.x[fleet]!, c.y[fleet]!)).toBe(0);
    expect(w.wingBase.get(id)).toBe(-fleet);
  });
});

describe('orders by command, and saved (PLAN 5.1e)', () => {
  it('a wing\'s mission by its nation\'s command; another nation\'s is refused; a save loads it, the same game', () => {
    const s = sim();
    const w = s.world;
    const fighter = wingOf(w, GER, 'fighter_group');
    const prague = at(14.4, 50.1);
    s.command({ kind: 'wingMission', id: fighter, mission: 'strike', x: prague[0], y: prague[1], nation: USA });
    s.step(1);
    expect(w.wingMission.has(fighter)).toBe(false);
    s.command({ kind: 'wingMission', id: fighter, mission: 'strike', x: prague[0], y: prague[1], nation: GER });
    s.step(1);
    expect(w.wingMission.get(fighter)).toEqual({ kind: 'strike', x: prague[0], y: prague[1] });
    const u = sim();
    u.load(s.save());
    expect([...u.world.wingMission]).toEqual([...w.wingMission]);
    expect(u.hash()).toBe(s.hash());
    s.step(24);
    u.step(24);
    expect(u.hash()).toBe(s.hash());
  });
});
