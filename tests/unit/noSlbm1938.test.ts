import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Refusal } from '../../src/shared/commands';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { launchNuke } from '../../src/sim/systems/nuclear';
import { assets1938 } from '../helpers/earth';
import { nationId, runEvents } from '../helpers/sim1938';

// PLAN 7.13c (critic run 7, naval: "SLBMs deliver nothing"): decided out of the tech tree (ADR-479,
// after ADR-434). A warhead goes by strategic bomber or by ballistic missile from the land; no
// tech, unit or template launches one from the sea, and a nation whose only force near the target
// is submarines cannot strike.

const { w: W, h: H } = SIZE_1938;
const [GER] = ['GER'].map(nationId) as [number];
type Row = { id: string; nameKey: string; class?: string; domain?: string; mobility?: string };
const rows = (dir: string, key: 'types' | 'techs'): Row[] =>
  readdirSync(path.resolve('data', dir))
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => (JSON.parse(readFileSync(path.resolve('data', dir, f), 'utf8')) as Record<string, Row[]>)[key] ?? []);
const SEA_LAUNCH = /slbm|sub(marine)?[_ -]?launched|sea[_ -]?launched|polaris|trident/i;

describe('no submarine-launched missile (PLAN 7.13c, ADR-479)', () => {
  it('the data: the only missile is of the land and the air; no tech, unit or template of a sea launch', () => {
    const units = rows('units', 'types');
    const techs = rows('tech', 'techs');
    expect(units.length).toBeGreaterThan(10);
    expect(techs.length).toBeGreaterThan(10);
    const missiles = units.filter((u) => u.class === 'nuke_missile');
    expect(missiles.map((u) => u.id)).toEqual(['ballistic_missile']);
    for (const m of missiles) expect([m.domain, m.mobility]).toEqual(['air', 'air']);
    for (const r of [...units, ...techs, ...TEMPLATES_1938.map((t) => ({ id: t.id, nameKey: (t as unknown as { nameKey: string }).nameKey }))]) expect(`${r.id} ${r.nameKey}`).not.toMatch(SEA_LAUNCH);
  });

  it('a nation with warheads whose only force by the target is submarines cannot launch', () => {
    const s = new Sim({ scenario: '1938', seed: 3, assets: assets1938(W) });
    s.command({ kind: 'setSetting', key: 'aiEnabled', value: false });
    const subs = TEMPLATES_1938.findIndex((t) => t.id === 'submarine_flotilla');
    const [tx, ty] = cellOf(-0.12, 51.5, W, H); // London
    // Four German submarine flotillas in the Thames estuary and off Dover.
    for (const [lon, lat] of [[1.2, 51.5], [1.5, 51.1], [1.6, 51.6], [1.0, 51.3]] as const) {
      const [x, y] = cellOf(lon, lat, W, H);
      s.command({ kind: 'spawnFleet', nation: GER, x: x + 0.5, y: y + 0.5, template: subs });
    }
    runEvents(s, 1);
    const w = s.world;
    let near = 0;
    w.formations.forEach((id) => {
      if (w.formations.cols.nation[id] === GER && w.formations.cols.template[id] === subs && Math.hypot(w.formations.cols.x[id]! - tx, w.formations.cols.y[id]! - ty) < 12) near++;
    });
    expect(near).toBe(4);
    w.warheads.set(GER, { stock: 3, paid: 0 });
    // Germany has no strategic bomber in 1938 and knows no missile: by neither means.
    expect(launchNuke(w, GER, tx + 0.5, ty + 0.5, false)).toBe(Refusal.NoDelivery);
    expect(launchNuke(w, GER, tx + 0.5, ty + 0.5, true)).toBe(Refusal.NoDelivery);
    expect(w.warheads.get(GER)!.stock).toBe(3);
  }, 300_000);
});
