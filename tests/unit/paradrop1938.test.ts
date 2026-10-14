import { describe, expect, it } from 'vitest';
import { EventKind, RejectReason } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { orderParadrop, PARA_MEN, PARA_ORG } from '../../src/sim/systems/airLift';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 5.8u2: the paradrop. A formation of infantry at an airbase of its nation is flown by its
// transport wings there, on the ground, the fewest whose lift its men take, to a land cell in
// their range of its side, an enemy's or no one's: it stands there at once, org at most PARA_ORG,
// an enemy's cell its; else refused with why.

const [GER, POL, SWE] = ['GER', 'POL', 'SWE'].map(nationId) as [number, number, number];
const template = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);
const tmpl = (w: World, id: number): string => TEMPLATES_1938[w.formations.cols.template[id]!]!.id;
const at = (lon: number, lat: number): [number, number] => cellOf(lon, lat, SIZE_1938.w, SIZE_1938.h).map((v) => Math.floor(v) + 0.5) as [number, number];
/** Germany and Poland at war; Germany's transport groups based at the first's airbase; a German garrison brigade there. */
function setup(t = 'garrison_brigade'): { s: Sim; w: World; brigade: number; wings: number[]; base: number } {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  w.settings.aiEnabled = false;
  w.wars.start([GER], [POL], 0);
  const wings = [...w.wingBase].filter(([id, b]) => w.formations.cols.nation[id] === GER && b > 0 && tmpl(w, id) === 'air_transport_group').map(([id]) => id).sort((a, b) => a - b);
  expect(wings).toHaveLength(2);
  const base = w.wingBase.get(wings[0]!)!;
  w.wingBase.set(wings[1]!, base);
  const [x, y] = w.cellPoint(w.airbases[base - 1]!.cell);
  const brigade = addDivision(w, GER, x, y, template(t));
  w.out.events.length = 0;
  return { s, w, brigade, wings, base };
}
const WARSAW = at(21.0, 52.2);
const rejections = (w: World): number[] => {
  const out: number[] = [];
  for (let i = 0; i < w.out.events.length; i += 6) if (w.out.events[i + 1] === EventKind.MoveRejected) out.push(w.out.events[i + 4]!);
  return out;
};

describe('the paradrop (PLAN 5.8u2)', () => {
  it('a German garrison brigade dropped at Warsaw by both transport groups: there at once, its org at most PARA_ORG, the cell German, the wings flying', () => {
    const { w, brigade, wings, base } = setup();
    const c = w.formations.cols;
    expect(c.strength[brigade]).toBe(3000);
    expect(48 * PARA_MEN).toBeGreaterThanOrEqual(3000);
    w.wingMission.set(wings[0]!, { kind: 'supply', x: 0, y: 0 });
    expect(orderParadrop(w, brigade, ...WARSAW)).toBe(0);
    const cell = Math.floor(WARSAW[1]) * w.cells.w + Math.floor(WARSAW[0]);
    expect([c.x[brigade], c.y[brigade]]).toEqual(w.cellPoint(cell));
    expect(c.org[brigade]).toBe(PARA_ORG);
    expect(w.cells.controller[cell]).toBe(GER);
    const [bx, by] = w.cellPoint(w.airbases[base - 1]!.cell);
    for (const g of wings) {
      expect(w.sorties.get(g)).toMatchObject({ bx, by, tx: c.x[brigade], ty: c.y[brigade], launch: w.tick, over: 0 });
      expect(w.wingMission.has(g)).toBe(false);
    }
    expect(w.out.events.filter((v, i) => i % 6 === 1 && v === EventKind.FormationLanded)).toHaveLength(1);
  });

  it('refused with why: a brigade of more men than the wings lift; a division with guns, a motorised one; a flying wing short; not at an airbase; water; a nation at peace; beyond their range', () => {
    // One transport group left at the base: 1,536 men, under the brigade's 3,000.
    const one = setup();
    one.w.wingBase.set(one.wings[1]!, one.base === 1 ? 2 : 1);
    expect(orderParadrop(one.w, one.brigade, ...WARSAW)).toBe(RejectReason.NoAirlift);
    // A division with guns is not of infantry alone; nor a motorised one.
    const div = setup('infantry_div');
    expect(orderParadrop(div.w, div.brigade, ...WARSAW)).toBe(RejectReason.NotLand);
    const mot = setup('motorised_div');
    expect(orderParadrop(mot.w, mot.brigade, ...WARSAW)).toBe(RejectReason.NotLand);
    const flying = setup();
    flying.w.sorties.set(flying.wings[1]!, { bx: 0, by: 0, tx: 1, ty: 0, launch: flying.w.tick, kmh: 300, km: 100, over: 0 });
    expect(orderParadrop(flying.w, flying.brigade, ...WARSAW)).toBe(RejectReason.NoAirlift);
    const away = setup();
    const ger = addDivision(away.w, GER, ...WARSAW, template('garrison_brigade'));
    expect(orderParadrop(away.w, ger, ...at(17.0, 52.5))).toBe(RejectReason.NoAirlift);
    const { w, brigade } = setup();
    expect(orderParadrop(w, brigade, ...at(18.0, 55.5))).toBe(RejectReason.NoLanding); // the Baltic
    expect(w.cells.controller[Math.floor(at(18.0, 59.3)[1]) * w.cells.w + Math.floor(at(18.0, 59.3)[0])]).toBe(SWE);
    expect(orderParadrop(w, brigade, ...at(18.0, 59.3))).toBe(RejectReason.NoRoute); // Stockholm, at peace
    expect(orderParadrop(w, brigade, ...at(37.6, 55.75))).toBe(RejectReason.NoRoute); // Moscow, at peace
    w.wars.start([GER], [nationId('SOV')], 0);
    expect(orderParadrop(w, brigade, ...at(49.0, 55.8))).toBe(RejectReason.OutOfRange); // Kazan, 2,000 km on
    expect(rejections(w)).toEqual([RejectReason.NoLanding, RejectReason.NoRoute, RejectReason.NoRoute, RejectReason.OutOfRange]);
    expect([w.formations.cols.x[brigade], w.formations.cols.y[brigade]]).toEqual(w.cellPoint(w.airbases[setup().base - 1]!.cell));
  });

  it('by command, of its nation\'s alone; saved, the same game', () => {
    const { s, w, brigade } = setup();
    s.command({ kind: 'paradrop', id: brigade, x: WARSAW[0], y: WARSAW[1], nation: POL });
    s.step(1);
    expect(w.formations.cols.x[brigade]).not.toBe(WARSAW[0]);
    s.command({ kind: 'paradrop', id: brigade, x: WARSAW[0], y: WARSAW[1], nation: GER });
    s.step(1);
    const cell = Math.floor(WARSAW[1]) * w.cells.w + Math.floor(WARSAW[0]);
    expect(Math.floor(w.formations.cols.x[brigade]!) + Math.floor(w.formations.cols.y[brigade]!) * w.cells.w).toBe(cell);
    const u = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    u.load(s.save());
    expect(u.hash()).toBe(s.hash());
  });
});
