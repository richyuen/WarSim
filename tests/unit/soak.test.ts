import { describe, expect, it } from 'vitest';
import { Sim } from '../../src/sim/sim';
import { EventKind } from '../../src/shared/events';
import { findNotFinite, runSoak, TICKS_PER_DAY } from '../../tools/soak/soak';

// PLAN 7.2a: the soak's twins on the toy world, its clock a day of the wall per simulated day.

function clocked(): { now: () => number; tick: () => void } {
  let t = 0;
  return { now: () => t, tick: () => void t++ };
}

function firstFormation(sim: Sim): number {
  let first = -1;
  sim.world.formations.forEach((id) => {
    if (first < 0) first = id;
  });
  return first;
}

/** A formation's strength in the toy world moved by one: a state the other twin does not have. */
function part(sim: Sim): void {
  const f = sim.world.formations;
  const first = firstFormation(sim);
  f.cols.strength[first] = f.cols.strength[first]! + 1;
}

describe('the soak (PLAN 7.2a)', () => {
  it('runs its time with a save and load each interval, and plays the game an untouched Sim plays', async () => {
    const c = clocked();
    const r = await runSoak({ scenario: 'toy', seed: 3, durationMs: 200, intervalMs: 50, now: c.now, onDay: c.tick });
    expect(r.failure).toBeUndefined();
    expect(r.ok).toBe(true);
    expect(r.ticks).toBe(200 * TICKS_PER_DAY);
    expect(r.saves.map((s) => s.tick)).toEqual([50, 100, 150, 200].map((d) => d * TICKS_PER_DAY));
    for (const s of r.saves) expect(s.gzipBytes).toBeLessThan(s.rawBytes);
    const plain = new Sim({ scenario: 'toy', seed: 3 });
    plain.step(200 * TICKS_PER_DAY);
    expect(r.finalHash).toBe(plain.hash());
  });

  it('a twin parted in a day is caught at the end of that day, comparing every day', async () => {
    const c = clocked();
    let days = 0;
    const r = await runSoak({
      scenario: 'toy',
      seed: 3,
      durationMs: 200,
      intervalMs: 50,
      compareDays: 1,
      now: c.now,
      onDay: (_a, b) => {
        c.tick();
        if (++days === 77) part(b);
      },
    });
    expect(r.ok).toBe(false);
    expect(r.apartAt).toBe(77 * TICKS_PER_DAY);
    expect(r.failure).toMatch(new RegExp(`^tick ${77 * TICKS_PER_DAY}: twin A [0-9a-f]{8}, twin B [0-9a-f]{8}$`));
    expect(r.saves).toHaveLength(1);
  });

  it('by default the hashes are compared each 30 days: a twin parted on day 77 is caught on day 90', async () => {
    const c = clocked();
    let days = 0;
    const r = await runSoak({
      scenario: 'toy',
      seed: 3,
      durationMs: 200,
      intervalMs: 1000,
      now: c.now,
      onDay: (_a, b) => {
        c.tick();
        if (++days === 77) part(b);
      },
    });
    expect(r.ok).toBe(false);
    expect(r.apartAt).toBe(90 * TICKS_PER_DAY);
  });

  it('the hashes are compared at the end too', async () => {
    const c = clocked();
    let days = 0;
    const r = await runSoak({
      scenario: 'toy',
      seed: 3,
      durationMs: 200,
      intervalMs: 1000,
      now: c.now,
      onDay: (_a, b) => {
        c.tick();
        if (++days === 199) part(b);
      },
    });
    expect(r.apartAt).toBe(200 * TICKS_PER_DAY);
  });

  it('a twin parted by its load is caught at the load', async () => {
    const c = clocked();
    let loads = 0;
    const r = await runSoak({
      scenario: 'toy',
      seed: 3,
      durationMs: 200,
      intervalMs: 50,
      now: c.now,
      onDay: c.tick,
      afterLoad: (b) => {
        if (++loads === 2) part(b);
      },
    });
    expect(r.ok).toBe(false);
    expect(r.apartAt).toBe(100 * TICKS_PER_DAY);
    expect(r.failure).toMatch(/^after the load of save 2 at tick 2400: /);
  });

  it('an exception fails the soak with its tick and message', async () => {
    const c = clocked();
    const r = await runSoak({
      scenario: 'toy',
      seed: 3,
      durationMs: 200,
      intervalMs: 50,
      now: c.now,
      onDay: (a) => {
        c.tick();
        if (a.tick === 30 * TICKS_PER_DAY) throw new Error('a broken rule');
      },
    });
    expect(r.ok).toBe(false);
    expect(r.failure).toMatch(/^tick 720: Error: a broken rule/);
  });
});

describe('the soak looks for NaN, infinity and undefined each day (PLAN 7.2b)', () => {
  it('a NaN or an infinity in a float column is found, with its section and index', () => {
    const sim = new Sim({ scenario: 'toy', seed: 3 });
    sim.step(5 * TICKS_PER_DAY);
    expect(findNotFinite(sim)).toBeUndefined();
    const id = firstFormation(sim);
    sim.world.formations.cols.org[id] = NaN;
    expect(findNotFinite(sim)).toEqual({ section: 'formations.org', index: id, value: NaN });
    sim.world.formations.cols.org[id] = 0.5;
    sim.world.formations.cols.x[id] = -Infinity;
    expect(findNotFinite(sim)).toEqual({ section: 'formations.x', index: id, value: -Infinity });
  });

  it("an undefined in the history's rows is found, a NaN in its tick, kind, a or b too, a global event's NaN place is not", () => {
    const sim = new Sim({ scenario: 'toy', seed: 3 });
    const h = sim.world.history;
    h.record(10, EventKind.WarDeclared, 1, 2, NaN, NaN);
    expect(findNotFinite(sim)).toBeUndefined();
    const at = h.rows.length;
    h.record(11, EventKind.PeaceSigned, 1, undefined as unknown as number, 3, 4);
    expect(findNotFinite(sim)).toEqual({ section: 'history.rows', index: at + 3, value: undefined });
    h.rows[at + 3] = NaN;
    expect(findNotFinite(sim)).toEqual({ section: 'history.rows', index: at + 3, value: NaN });
    h.rows[at + 3] = 2;
    h.rows[at] = 0 / 0;
    expect(findNotFinite(sim)).toEqual({ section: 'history.rows', index: at, value: NaN });
  });

  it('a NaN put in a twin fails the soak at the end of that day, before any hash is compared', async () => {
    const c = clocked();
    let days = 0;
    let id = -1;
    const r = await runSoak({
      scenario: 'toy',
      seed: 3,
      durationMs: 200,
      intervalMs: 50,
      now: c.now,
      onDay: (_a, b) => {
        c.tick();
        if (++days === 77) b.world.formations.cols.org[(id = firstFormation(b))] = NaN;
      },
    });
    expect(r.ok).toBe(false);
    expect(r.apartAt).toBeUndefined();
    expect(r.notFinite).toEqual({ section: 'formations.org', index: id, value: NaN });
    expect(r.failure).toBe(`tick ${77 * TICKS_PER_DAY}: twin B has NaN in formations.org[${id}]`);
  });
});
