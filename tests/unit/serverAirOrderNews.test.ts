import { describe, expect, it } from 'vitest';
import { RejectReason } from '../../src/shared/events';
import type { FromWorker, OrderNews } from '../../src/shared/protocol';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import type { World } from '../../src/sim/world';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';
import { addDivision } from '../helpers/sim1938';
import { orderNewsText } from '../../src/ui/orderNewsText';

// PLAN 5.8v3: a player's order of a wing, and a paradrop, refused is told as a march's is
// (PLAN 4.9c), with its reason; given, nothing is told and it is forgotten after its hour.

const { w: W, h: H } = SIZE_1938;
const GER = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
const at = (lon: number, lat: number): [number, number] => cellOf(lon, lat, W, H).map((v) => Math.floor(v) + 0.5) as [number, number];

function server(): { s: SimServer; w: World; news: OrderNews[]; run: (hours: number) => void; ordered: () => number } {
  const news: OrderNews[] = [];
  const s = new SimServer((m: FromWorker) => {
    if (m.type === 'orderNews') news.push(m.news);
  });
  s.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed: 1, assets: assets1938(W) } }, 0);
  const w = s.sim!.world;
  w.settings.aiEnabled = false;
  const drain = (x: World): void => (s as unknown as { drainEvents(w: World): void }).drainEvents(x);
  return { s, w, news, run: (hours) => s.sim!.step(hours, drain), ordered: () => (s as unknown as { ordered: Map<number, unknown> }).ordered.size };
}

describe('a wing\'s order and a paradrop told (PLAN 5.8v3)', () => {
  it('a fighter group\'s strike beyond its range: refused, OutOfRange; one in range: nothing told, forgotten', () => {
    const { s, w, news, run, ordered } = server();
    const fighter = [...w.wingBase].find(([id, b]) => w.formations.cols.nation[id] === GER && b > 0 && TEMPLATES_1938[w.formations.cols.template[id]!]!.id === 'fighter_group')![0];
    s.handle({ type: 'cmd', cmd: { kind: 'wingMission', id: fighter, mission: 'strike', x: at(37.6, 55.75)[0], y: at(37.6, 55.75)[1], nation: GER } }, 1);
    run(1);
    expect(news).toHaveLength(1);
    expect(news[0]).toMatchObject({ kind: 'refused', id: fighter, nation: GER, reason: RejectReason.OutOfRange });
    expect(ordered()).toBe(0);
    s.handle({ type: 'cmd', cmd: { kind: 'wingMission', id: fighter, mission: 'patrol', x: at(13.4, 52.5)[0], y: at(13.4, 52.5)[1], nation: GER } }, 2);
    run(2);
    expect(news).toHaveLength(1);
    expect(w.wingMission.get(fighter)?.kind).toBe('patrol');
    expect(ordered()).toBe(0);
  });

  it('a paradrop of a brigade at no airbase: refused, NoAirlift, with its words', () => {
    const { s, w, news, run } = server();
    const brigade = addDivision(w, GER, ...at(10.0, 51.0), TEMPLATES_1938.findIndex((t) => t.id === 'garrison_brigade'));
    s.handle({ type: 'cmd', cmd: { kind: 'paradrop', id: brigade, x: at(13.4, 52.5)[0], y: at(13.4, 52.5)[1], nation: GER } }, 1);
    run(1);
    expect(news).toHaveLength(1);
    expect(news[0]).toMatchObject({ kind: 'refused', id: brigade, reason: RejectReason.NoAirlift });
    // The reasons of a wing's order and a paradrop in the page's words, not their keys.
    for (const reason of [RejectReason.OutOfRange, RejectReason.NoBase, RejectReason.NoAirlift]) {
      const text = orderNewsText({ ...news[0]!, reason }, 'A fighter group');
      expect(text, String(reason)).toMatch(/^A fighter group: not done: [a-z]/);
      expect(text, String(reason)).not.toContain('order.why');
    }
  });
});
