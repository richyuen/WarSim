import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { Refusal } from '../../src/shared/commands';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { declareWar } from '../../src/sim/systems/war';
import { nukeBomber, nukeTargets, targetValue } from '../../src/sim/systems/nuclear';
import { knowsTechs, techMask } from '../../src/sim/tech';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.7: the rules the AI's strike demo brought. `grantTech` gives a tech and what it stands
// on; a strike retasks a bomber out on a sortie when none is free; the AI weighs the places where
// enemy formations are massed (twelve divisions at Reims are among its targets); a target's value
// is as likely as the warhead gets there.

const { w: W, h: H } = SIZE_1938;
const [FRA, GER] = ['FRA', 'GER'].map(nationId) as [number, number];
const sim = (): Sim => new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
const reims = cellOf(4.03, 49.26, W, H);
const berlin = cellOf(13.4, 52.52, W, H);

describe('the AI strike demo\'s rules (PLAN 6.7)', () => {
  it('grantTech: the tech and its prerequisites; an unknown tech refused', () => {
    const s = sim();
    const w = s.world;
    const techs = w.rules!.techs;
    const missiles = techs.findIndex((t) => t.id === 'ballistic_missiles');
    const bomb = techs.findIndex((t) => t.id === 'atomic_bomb');
    expect(knowsTechs(w, FRA, techMask([missiles]))).toBe(false);
    s.command({ kind: 'grantTech', nation: FRA, tech: 'ballistic_missiles' });
    s.command({ kind: 'grantTech', nation: FRA, tech: 'no_such_tech' });
    const refusals: number[] = [];
    s.step(1, (x: World) => {
      for (let i = 0; i < x.out.events.length; i += 6) if (x.out.events[i + 1] === EventKind.CommandRefused) refusals.push(x.out.events[i + 3]!);
      x.out.events.length = 0;
      x.out.fires.length = 0;
    });
    expect(knowsTechs(w, FRA, techMask([missiles]))).toBe(true);
    for (const p of techs[missiles]!.prereqs) expect(knowsTechs(w, FRA, techMask([p])), techs[p]!.id).toBe(true);
    expect(bomb).toBeGreaterThanOrEqual(0);
    expect(refusals).toContain(Refusal.NoSuch);
  });

  it('a bomber on a sortie is retasked for a warhead when none is free; a free one first', () => {
    const w = sim().world;
    const free = nukeBomber(w, FRA, ...berlin);
    expect(free).not.toBeNull();
    w.sorties.set(free!.wing, { bx: 0, by: 0, tx: 1, ty: 1, launch: 0, kmh: 300, km: 10, over: 0 });
    const busy = nukeBomber(w, FRA, ...berlin);
    expect(busy?.wing).toBe(free!.wing);
  });

  it('a target\'s value: as likely as the warhead gets there; massed divisions at Reims are worth more than one', () => {
    const s = sim();
    const w = s.world;
    s.step(1);
    const war = declareWar(w, GER, FRA, true)!;
    const inf = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
    s.command({ kind: 'spawnFormation', nation: GER, x: reims[0], y: reims[1], strength: 0, template: inf });
    s.step(1);
    const one = targetValue(w, FRA, war, 1, ...reims);
    for (let k = 0; k < 11; k++) s.command({ kind: 'spawnFormation', nation: GER, x: reims[0] + (k % 4) * 0.3, y: reims[1] + Math.floor(k / 4) * 0.3, strength: 0, template: inf });
    s.step(1);
    const twelve = targetValue(w, FRA, war, 1, ...reims);
    expect(twelve).toBeGreaterThan(one);
    // Among the places the AI weighs: Berlin, and the massed divisions (within a cell of Reims).
    const places = nukeTargets(w, FRA, war, 1);
    expect(places.some(([x, y]) => Math.hypot(x - berlin[0], y - berlin[1]) < 1)).toBe(true);
    expect(places.some(([x, y]) => Math.hypot(x - reims[0], y - reims[1]) < 1.5), JSON.stringify(places)).toBe(true);
    // By missile the warhead gets there: worth more than by bomber.
    const byBomber = targetValue(w, FRA, war, 1, ...berlin);
    s.command({ kind: 'grantTech', nation: FRA, tech: 'ballistic_missiles' });
    s.step(1);
    const byMissile = targetValue(w, FRA, war, 1, ...berlin);
    process.stderr.write(`Reims one ${one.toFixed(3)} twelve ${twelve.toFixed(3)}; Berlin by bomber ${byBomber.toFixed(3)} by missile ${byMissile.toFixed(3)}\n`);
    expect(byMissile).toBeGreaterThan(byBomber);
    expect(byMissile).toBe(1);
  });
});
