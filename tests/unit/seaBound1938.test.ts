import { describe, expect, it } from 'vitest';
import { EventKind, RejectReason } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { assets1938 } from '../helpers/earth';
import { addDivision } from '../helpers/sim1938';

// PLAN 4.9b (the critic's R4-B2): a player's order over the sea from inland was refused with
// nothing on the screen; the critic's two orders by hand (to the port, then over the sea) were
// the only way. The order now marches to the nearest port with transports, embarks there and
// sails.

const { w: W, h: H } = SIZE_1938;
const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const [ENG, GER] = [id('ENG'), id('GER')];
const at = (lon: number, lat: number): [number, number] => cellOf(lon, lat, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];
const COAST = at(8.7, 53.87); // Cuxhaven

/** Britain at war with Germany alone, the AI off, a British division in Birmingham (inland; London has transports of its own). */
function inland(): { s: Sim; div: number } {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  s.world.settings.aiEnabled = false;
  for (const war of [...s.world.wars.list]) s.world.wars.end(war);
  s.world.wars.start([ENG], [GER], 0);
  return { s, div: addDivision(s.world, ENG, ...at(-1.9, 52.48)) };
}

/** Steps until `div` is aboard, at most `hours`: the hour it embarked, -1 for never; and the refusals' reasons. */
function untilAboard(s: Sim, div: number, hours: number): { hour: number; refused: number[] } {
  const refused: number[] = [];
  for (let h = 0; h < hours; h++) {
    s.step(1, (w) => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && ev[i + 2] === div) refused.push(ev[i + 4]!);
      ev.length = 0;
    });
    if (s.world.embarked.has(div)) return { hour: s.world.tick, refused };
  }
  return { hour: -1, refused };
}

describe('a player\'s order over the sea from inland (PLAN 4.9b)', () => {
  it('Birmingham to the German coast: marches to a port with transports, embarks there and sails', () => {
    const { s, div } = inland();
    s.command({ kind: 'moveFormation', id: div, x: COAST[0], y: COAST[1] });
    s.step(1);
    expect(s.world.formations.cols.moving[div], 'on the march').toBe(1);
    expect(s.world.seaBound.has(div)).toBe(true);
    const r = untilAboard(s, div, 24 * 10);
    expect(r.refused).toEqual([]);
    expect(r.hour, 'aboard within ten days').toBeGreaterThan(0);
    const e = s.world.embarked.get(div)!;
    expect(s.world.formations.cols.moving[e.fleet], 'the transports under way').toBe(1);
    const tc = Math.floor(COAST[1]) * W + Math.floor(COAST[0]);
    expect(e.target).toBe(tc);
    expect(s.world.seaBound.has(div)).toBe(false);
  });

  it('a save loaded on the march embarks at the same hour, in the same state', () => {
    const { s, div } = inland();
    s.command({ kind: 'moveFormation', id: div, x: COAST[0], y: COAST[1] });
    s.step(6);
    const t = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    t.load(s.save());
    expect(t.world.seaBound.get(div)).toBe(s.world.seaBound.get(div));
    const a = untilAboard(s, div, 24 * 10);
    const b = untilAboard(t, div, 24 * 10);
    expect(b.hour).toBe(a.hour);
    expect(a.hour).toBeGreaterThan(0);
    expect(t.hash()).toBe(s.hash());
  });

  it('another order on the march ends the order over the sea', () => {
    const { s, div } = inland();
    s.command({ kind: 'moveFormation', id: div, x: COAST[0], y: COAST[1] });
    s.step(2);
    const [bx, by] = at(-2.24, 53.48); // Manchester
    s.command({ kind: 'moveFormation', id: div, x: bx, y: by });
    s.step(1);
    expect(s.world.seaBound.has(div)).toBe(false);
    expect(untilAboard(s, div, 24 * 5).hour).toBe(-1);
  });

  it('with no transports anywhere it is refused, and says why', () => {
    const { s, div } = inland();
    for (const f of [...s.world.formations.ids()]) if (s.world.isFleet(f) && s.world.formations.cols.nation[f] === ENG) destroyFormation(s.world, f);
    s.command({ kind: 'moveFormation', id: div, x: COAST[0], y: COAST[1] });
    const r = untilAboard(s, div, 2);
    expect(r.hour).toBe(-1);
    expect(r.refused.length).toBe(1);
    expect([RejectReason.NoPort, RejectReason.NoTransports]).toContain(r.refused[0]);
    expect(s.world.seaBound.has(div)).toBe(false);
  });
});
