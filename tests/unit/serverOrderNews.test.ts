import { describe, expect, it } from 'vitest';
import { RejectReason } from '../../src/shared/events';
import type { FromWorker, OrderNews } from '../../src/shared/protocol';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { destroyFormation } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';
import { addDivision } from '../helpers/sim1938';

// PLAN 4.9c (the critic's R4-B2): what became of a player's order of a formation reached no
// screen. The worker now tells it at once (`orderNews`): a refusal with its reason, a landing
// thrown back, troops ashore away from their target.

const { w: W, h: H } = SIZE_1938;
const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const [ENG, GER] = [id('ENG'), id('GER')];
const CUXHAVEN = cellOf(8.7, 53.87, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];

function server(seed: number): { server: SimServer; news: OrderNews[]; run: (hours: number) => void } {
  const news: OrderNews[] = [];
  const s = new SimServer((m: FromWorker) => {
    if (m.type === 'orderNews') news.push(m.news);
  });
  s.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed, assets: assets1938(W) } }, 0);
  const drain = (w: World): void => (s as unknown as { drainEvents(w: World): void }).drainEvents(w);
  return { server: s, news, run: (hours) => s.sim!.step(hours, drain) };
}

describe('the page is told what became of a player\'s order (PLAN 4.9c)', () => {
  it('a refusal, at once, with its reason; an order that is not a player\'s tells nothing', () => {
    const { server: s, news, run } = server(1);
    const w = s.sim!.world;
    for (const f of [...w.formations.ids()]) if (w.isFleet(f) && w.formations.cols.nation[f] === ENG) destroyFormation(w, f);
    const div = addDivision(w, ENG, ...(cellOf(-1.9, 52.48, W, H).map((v) => Math.floor(v) + 0.5) as [number, number]));
    // Not a player's (no nation named): no news.
    s.handle({ type: 'cmd', cmd: { kind: 'moveFormation', id: div, x: CUXHAVEN[0], y: CUXHAVEN[1] } }, 1);
    run(1);
    expect(news).toEqual([]);
    s.handle({ type: 'cmd', cmd: { kind: 'moveFormation', id: div, x: CUXHAVEN[0], y: CUXHAVEN[1], nation: ENG } }, 2);
    run(1);
    expect(news.length).toBe(1);
    expect(news[0]!.kind).toBe('refused');
    expect(news[0]!.id).toBe(div);
    expect([RejectReason.NoPort, RejectReason.NoTransports]).toContain(news[0]!.reason);
  });

  it('the critic\'s landing on seed 2207: thrown back off Cuxhaven, then ashore in England, both told', () => {
    const { server: s, news, run } = server(2207);
    s.handle({ type: 'cmd', cmd: { kind: 'setPlayer', nation: ENG } }, 1);
    // Britain played with every box of its AI unticked (ADR-759): the critic's case had its AI off.
    s.handle({ type: 'cmd', cmd: { kind: 'setPlayerAi', layers: 0 } }, 1);
    s.handle({ type: 'cmd', cmd: { kind: 'declareWar', attacker: ENG, defender: GER } }, 1);
    run(1);
    const div = 272;
    expect(s.sim!.world.formations.cols.nation[div]).toBe(ENG);
    s.handle({ type: 'cmd', cmd: { kind: 'moveFormation', id: div, x: CUXHAVEN[0], y: CUXHAVEN[1], nation: ENG } }, 2);
    run(3);
    // A second order while aboard is refused, and the voyage it left standing is told on (found by the AT's spec).
    const [kx, ky] = cellOf(9.5, 51.3, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];
    s.handle({ type: 'cmd', cmd: { kind: 'moveFormation', id: div, x: kx, y: ky, nation: ENG } }, 3);
    run(24 * 8);
    expect(news.map((n) => n.kind)).toEqual(['refused', 'repulsed', 'landedAway']);
    expect(news[0]!.reason).toBe(RejectReason.Aboard);
    news.shift();
    expect(news.every((n) => n.id === div && n.nation === ENG)).toBe(true);
    expect(news[1]!.x).toBeLessThan(CUXHAVEN[0] - 20);
  });
});
