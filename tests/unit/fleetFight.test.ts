import { describe, expect, it } from 'vitest';
import type { FormationDetail, FromWorker } from '../../src/shared/protocol';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { elementIndex, equipFormation, slotCount, slotPlace } from '../../src/sim/systems/elements';
import { declareWar } from '../../src/sim/systems/war';
import { navOf, type World } from '../../src/sim/world';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// PLAN 7.126: the panel of a fleet in a sea battle read "In contact" with no way to its fight
// (`enemyOf` pairs land formations alone; seed 5381, Germany on Poland, fleet 1199 on day 22).
// The answer to `formation` now gives a fleet in contact the nearest enemy fleet of its battle,
// and the box of the two fleets' ships, which the panel's button frames as a sea battle's row.

const W = SIZE_1938.w;
const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;
const tpl = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);

function fleet(world: World, n: number, t: string, x: number, y: number): number {
  const f = world.formations;
  const k = f.create();
  const c = f.cols;
  c.nation[k] = n;
  c.x[k] = x;
  c.y[k] = y;
  c.template[k] = tpl(t);
  c.supply[k] = 1;
  c.org[k] = 1;
  equipFormation(world, k, tpl(t));
  return k;
}

function ask(server: SimServer, replies: FromWorker[], f: number): FormationDetail {
  const reqId = 5000 + replies.length;
  server.handle({ type: 'formation', reqId, id: f }, 0);
  const r = replies.find((m) => m.type === 'reply' && m.reqId === reqId);
  if (!r || r.type !== 'reply' || !r.bytes) throw new Error('no reply with bytes');
  return JSON.parse(new TextDecoder().decode(r.bytes)) as FormationDetail;
}

describe('a fleet in a sea battle has a fight for its panel (PLAN 7.126)', () => {
  it('the nearest enemy fleet of its battle, and the box of the two fleets\' ships', () => {
    const replies: FromWorker[] = [];
    const server = new SimServer((msg) => replies.push(msg));
    server.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed: 4301, assets: assets1938(W) } }, 0);
    const w = server.sim!.world;
    w.settings.aiEnabled = false;
    // Past the first hour: the month's start lays up fleets the navy's budget does not keep.
    server.handle({ type: 'step', reqId: 9, n: 1 }, 0);
    // A German battle squadron in the North Atlantic, a British one 5 km east of it and a second 9 km west (none of them
    // loses half its ships in the battle's first hour, and breaks off).
    const [cx, cy] = cellOf(-32, 47, W, SIZE_1938.h).map(Math.floor) as [number, number];
    const km = 1 / navOf(w).grid.kx[cy]!;
    const ger = fleet(w, id('GER'), 'battle_squadron', cx + 0.5, cy + 0.5);
    const near = fleet(w, id('ENG'), 'battle_squadron', cx + 0.5 + 5 * km, cy + 0.5);
    const far = fleet(w, id('ENG'), 'battle_squadron', cx + 0.5 - 9 * km, cy + 0.5);
    // At peace: no contact, and no fight.
    server.handle({ type: 'step', reqId: 2, n: 1 }, 0);
    for (const f of [ger, near, far]) expect(ask(server, replies, f).fight, `fleet ${f} at peace`).toBeNull();

    declareWar(w, id('GER'), id('ENG'), true);
    server.handle({ type: 'step', reqId: 3, n: 1 }, 0);
    const c = w.formations.cols;
    expect([c.engaged[ger], c.engaged[near], c.engaged[far]]).toEqual([1, 1, 1]);
    expect(w.seaBattles.length).toBe(1);

    const d = ask(server, replies, ger);
    expect(d.engaged).toBe(true);
    expect(d.fight, 'the German fleet\'s fight').not.toBeNull();
    expect(d.fight!.sea).toBe(true);
    // The nearer of the two British fleets.
    expect(d.fight!.enemy).toBe(near);
    // Each British fleet's fight is the German one.
    expect(ask(server, replies, near).fight?.enemy).toBe(ger);
    expect(ask(server, replies, far).fight?.enemy).toBe(ger);

    // Every ship of the German fleet and of the British one it fights is in the box (the fleets stand on their slots: no deployment at sea).
    const box = d.fight!;
    const inBox = (x: number, y: number): boolean => Math.abs(x - box.x) <= box.span[0] / 2 + 1e-9 && Math.abs(y - box.y) <= box.span[1] / 2 + 1e-9;
    let ships = 0;
    for (const f of [ger, near]) {
      const list = elementIndex(w).get(f) ?? [];
      const slots = slotCount(w, f, list.length);
      for (const e of list) {
        const [x, y] = slotPlace(w, c.x[f]!, c.y[f]!, c.facing[f]!, w.elements.cols.slot[e]!, slots);
        expect(inBox(x, y), `ship ${e} of fleet ${f} at (${x.toFixed(3)}, ${y.toFixed(3)}) in the box about (${box.x.toFixed(3)}, ${box.y.toFixed(3)}), ${box.span.map((s) => s.toFixed(3)).join(' × ')}`).toBe(true);
        ships++;
      }
    }
    expect(ships).toBeGreaterThan(2);
    // No wider than the two fleets and their ships: the far British fleet, 9 km the other way, is not in it.
    expect(inBox(c.x[far]!, c.y[far]!)).toBe(false);
  });
});
