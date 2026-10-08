import { describe, expect, it } from 'vitest';
import type { FormationDetail, FromWorker } from '../../src/shared/protocol';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { contactsOf, deployOf, elementIndex, slotCount } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';
import { INF_DIV, nationId } from '../helpers/sim1938';

// PLAN 3.11b (critic R3-B3): a formation in contact that stands a line or more behind its own
// side's front has no enemy in a close view of its block (seed 4242, day 21: 54 of 151 at
// 6 m/px, 5 at 20), and its panel had no way to where it fights. The answer to `formation` now
// says where that is: the middle between its block and the block of the enemy it faces, and
// how far apart the two stand.

const W = SIZE_1938.w;
const GER = nationId('GER');
const POL = nationId('POL');

function ask(server: SimServer, replies: FromWorker[], id: number): FormationDetail {
  const reqId = 5000 + replies.length;
  server.handle({ type: 'formation', reqId, id }, 0);
  const r = replies.find((m) => m.type === 'reply' && m.reqId === reqId);
  if (!r || r.type !== 'reply' || !r.bytes) throw new Error('no reply with bytes');
  return JSON.parse(new TextDecoder().decode(r.bytes)) as FormationDetail;
}

const block = (w: World, f: number): [number, number] => {
  const d = deployOf(w, f, slotCount(w, f, elementIndex(w).get(f)?.length ?? 0))!;
  return [d.x, d.y];
};

describe('the worker\'s answer to `formation` says where a formation in contact fights (PLAN 3.11b)', () => {
  it('the middle between its block and the block of the enemy it faces, and how far apart they stand; none out of contact', () => {
    const replies: FromWorker[] = [];
    const server = new SimServer((msg) => replies.push(msg));
    server.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed: 99, assets: assets1938(W) } }, 0);
    const w = server.sim!.world;
    const { owner, w: cw, h: ch } = w.cells;
    // Two German cells with a Polish one east of them, land all the way.
    let site: [number, number] | null = null;
    for (let y = 1; y < ch - 1 && !site; y++) for (let x = 2; x < cw - 3 && !site; x++) if (owner[y * cw + x - 1] === GER && owner[y * cw + x] === GER && owner[y * cw + x + 1] === POL && [-0.5, 0, 0.5, 1, 1.5].every((d) => w.onLand(x + d, y + 0.5))) site = [x + 0.5, y + 0.5];
    expect(site).not.toBeNull();
    const [sx, sy] = site!;
    server.handle({ type: 'cmd', cmd: { kind: 'setSetting', key: 'aiEnabled', value: false } }, 0);
    // A German division and a Polish one a cell apart, and a second German one behind the first, 1.4 cells from the Pole.
    server.handle({ type: 'cmd', cmd: { kind: 'spawnFormation', nation: GER, x: sx, y: sy, strength: 0, template: INF_DIV } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'spawnFormation', nation: POL, x: sx + 1, y: sy, strength: 0, template: INF_DIV } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'spawnFormation', nation: GER, x: sx - 0.4, y: sy, strength: 0, template: INF_DIV } }, 0);
    server.handle({ type: 'step', reqId: 2, n: 1 }, 0);
    const [front, pol, rear] = w.formations.ids().slice(-3) as [number, number, number];
    const fc = w.formations.cols;
    expect([fc.nation[front], fc.nation[pol], fc.nation[rear]]).toEqual([GER, POL, GER]);

    // At peace: no contact, and no fight to go to.
    expect([fc.engaged[front], fc.engaged[pol], fc.engaged[rear]]).toEqual([0, 0, 0]);
    for (const f of [front, pol, rear]) expect(ask(server, replies, f).fight, `formation ${f} at peace`).toBeNull();

    server.handle({ type: 'cmd', cmd: { kind: 'declareWar', attacker: GER, defender: POL } }, 0);
    server.handle({ type: 'step', reqId: 3, n: 2 }, 0);
    expect([fc.engaged[front], fc.engaged[pol], fc.engaged[rear]]).toEqual([1, 1, 1]);
    const contacts = contactsOf(w);
    expect([contacts.get(front), contacts.get(pol), contacts.get(rear)]).toEqual([pol, front, pol]);

    const hash = server.sim!.hash();
    const far: number[] = [];
    for (const f of [front, pol, rear]) {
      const d = ask(server, replies, f);
      const enemy = contacts.get(f)!;
      const [ax, ay] = block(w, f);
      const [bx, by] = block(w, enemy);
      expect(d.engaged).toBe(true);
      expect(d.fight, `formation ${f}`).not.toBeNull();
      expect(d.fight!.enemy).toBe(enemy);
      // The panel's own place is its block's (PLAN 3.11a); the fight is half way to the enemy's block.
      expect([d.x, d.y]).toEqual([ax, ay]);
      expect(d.fight!.x).toBeCloseTo((ax + bx) / 2, 9);
      expect(d.fight!.y).toBeCloseTo((ay + by) / 2, 9);
      expect(d.fight!.span[0]).toBeCloseTo(Math.abs(bx - ax), 9);
      expect(d.fight!.span[1]).toBeCloseTo(Math.abs(by - ay), 9);
      far.push(Math.hypot(...d.fight!.span));
    }
    // The pair stand front to front, under a quarter of a cell between their blocks' middles; the one behind is a line further off.
    expect(far[0]).toBeGreaterThan(0.05);
    expect(far[0]).toBeLessThan(0.25);
    expect(far[1]).toBeCloseTo(far[0]!, 9);
    expect(far[2]).toBeGreaterThan(far[0]! + 0.1);
    // Asking changes nothing.
    expect(server.sim!.hash()).toBe(hash);
    expect(replies.filter((r) => r.type === 'error')).toEqual([]);
  }, 120_000);
});
