import { describe, expect, it } from 'vitest';
import { Refusal, type Command } from '../../src/shared/commands';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { REVIVAL_COOLDOWN } from '../../src/sim/systems/revival';
import { navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId, runEvents } from '../helpers/sim1938';

// PLAN 2.17d (the critic's R2-B8): Revive 30 days after a Kill did nothing, and the panel said
// "there is nothing here to do it with". Two causes: the cooldown after a death, and the Kill
// itself, which made the nations it founded the core of the dead nation's land (France kept a
// core on 25 of 170 provinces, none of them in France).

const assets = assets1938(SIZE_1938.w);
const [FRA, ETH] = [nationId('FRA'), nationId('ETH')];

/** Sends `cmd`, steps a tick and returns the command events: how many applied, and the reasons of those refused. */
function send(s: Sim, cmd: Command): { applied: number; refused: number[] } {
  s.command(cmd);
  const ev = runEvents(s, 1);
  return { applied: ev.filter((e) => e[1] === EventKind.CommandApplied).length, refused: ev.filter((e) => e[1] === EventKind.CommandRefused).map((e) => e[3]!) };
}

/** Province ids whose centre cell `n` owns. */
function heldProvinces(w: World, n: number): number[] {
  const g = navOf(w).graph;
  const out: number[] = [];
  for (let p = 1; p < w.provinces.count; p++) if ((g.centre[p] ?? -1) >= 0 && w.cells.owner[g.centre[p]!] === n) out.push(p);
  return out;
}

describe('Revive after a God Mode Kill (PLAN 2.17d)', () => {
  it('a killed nation keeps a core on the land it had one on, is refused before its cooldown with that reason, and returns on its land after it', () => {
    const s = new Sim({ scenario: '1938', seed: 99, assets });
    const w = s.world;
    const nc = (): World['nations']['cols'] => w.nations.cols;
    const cores = w.provinces.provincesOf(FRA).filter((p) => heldProvinces(w, FRA).includes(p));
    expect(cores.length, 'provinces France holds and has a core on').toBeGreaterThan(50);
    const cells = nc().cells[FRA]!;
    let paris = 0;
    w.cities.forEach((ci) => {
      if (w.cities.cols.capitalOf[ci] === FRA) paris = w.cities.cols.cell[ci]!;
    });
    const born = w.nations.highWater;

    expect(send(s, { kind: 'collapseNation', nation: FRA })).toEqual({ applied: 1, refused: [] });
    expect(nc().living[FRA]).toBe(0);
    const heir = w.cells.owner[paris]!;
    const kept = new Set(w.provinces.provincesOf(FRA));
    expect(cores.filter((p) => !kept.has(p)), 'provinces France has lost its core on').toEqual([]);

    // 30 days later, as the critic did: refused, and the reason is the cooldown.
    s.step(24 * 30);
    const owners = w.cells.owner.slice();
    expect(send(s, { kind: 'reviveNation', nation: FRA })).toEqual({ applied: 0, refused: [Refusal.Cooldown] });
    expect(nc().living[FRA]).toBe(0);
    expect(w.cells.owner).toEqual(owners);

    // The first hour it may: France returns on the land it has a core on.
    expect(nc().revivalAt[FRA]).toBe(REVIVAL_COOLDOWN); // killed at tick 0
    w.tick = REVIVAL_COOLDOWN - 1;
    expect(send(s, { kind: 'reviveNation', nation: FRA }).refused).toEqual([Refusal.Cooldown]);
    expect(w.tick).toBe(REVIVAL_COOLDOWN);
    expect(send(s, { kind: 'reviveNation', nation: FRA })).toEqual({ applied: 1, refused: [] });
    expect(nc().living[FRA]).toBe(1);
    expect(w.cells.owner[paris], 'the old capital’s cell').toBe(FRA);
    const centre = navOf(w).graph.centre;
    expect(cores.filter((p) => w.cells.owner[centre[p]!] !== FRA), 'provinces of its core that it does not hold').toEqual([]);
    expect(nc().cells[FRA]! / cells, 'the share of its cells it has again').toBeGreaterThan(0.95);
    // No nation the Kill founded keeps a cell of a province France has a core on, nor one outside
    // any province: the heir had 22 of those (slivers of coast) and lived on them without a
    // province (PLAN 2.17d2). One lives on, on land it took in Morocco.
    const core = new Set(w.provinces.provincesOf(FRA));
    const left = new Map<number, number>();
    let outside = 0;
    w.cells.owner.forEach((o, c) => {
      if (o < born || o === FRA) return;
      left.set(o, (left.get(o) ?? 0) + 1);
      if (w.cells.province[c] === 0) outside++;
      else expect(core.has(w.cells.province[c]!), `nation ${o} owns a cell of province ${w.cells.province[c]}, of France's core`).toBe(false);
    });
    expect(outside, 'cells outside any province that a nation the Kill founded owns').toBe(0);
    expect(heir, 'the nation founded on Paris').toBeGreaterThanOrEqual(born);
    expect([nc().living[heir], nc().cells[heir]], 'the heir, left without a province: alive, cells').toEqual([0, 0]);
    expect(nc().cells[FRA], 'every cell it had, the slivers of coast among them').toBe(cells);
    console.log(`France: ${cells} cells, ${cores.length} core provinces held; after the Kill and the revival ${nc().cells[FRA]} cells; founded nations left: ${JSON.stringify([...left])}`);
    // Alive now: a second Revive says so.
    expect(send(s, { kind: 'reviveNation', nation: FRA })).toEqual({ applied: 0, refused: [Refusal.Alive] });
  });

  it('the reason is the one that holds', () => {
    const s = new Sim({ scenario: '1938', seed: 99, assets });
    const nc = s.world.nations.cols;
    expect(send(s, { kind: 'reviveNation', nation: 9999 }).refused).toEqual([Refusal.NoNation]);
    expect(send(s, { kind: 'reviveNation', nation: FRA }).refused).toEqual([Refusal.Alive]);
    // Ethiopia, dead at the start with claims on Italian East Africa.
    nc.revivalsLeft[ETH] = 0;
    expect(send(s, { kind: 'reviveNation', nation: ETH }).refused).toEqual([Refusal.NoRevivals]);
    nc.revivalsLeft[ETH] = 1;
    s.world.provinces.claims = s.world.provinces.claims.filter(([, n]) => n !== ETH);
    expect(send(s, { kind: 'reviveNation', nation: ETH }).refused).toEqual([Refusal.NoCoreLand]);
    expect(nc.living[ETH]).toBe(0);

    // A world without provinces has no core land: that is the reason, not a count never used.
    const toy = new Sim({ scenario: 'toy', seed: 7 });
    toy.command({ kind: 'collapseNation', nation: 2 });
    toy.step(1);
    expect(toy.world.nations.cols.living[2]).toBe(0);
    expect(send(toy, { kind: 'reviveNation', nation: 2 }).refused).toEqual([Refusal.NoCoreLand]);
  });
});
