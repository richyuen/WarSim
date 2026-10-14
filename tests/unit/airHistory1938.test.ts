import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { seaSide } from '../../src/shared/history';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { HISTORY_STRIDE } from '../../src/sim/history';
import { AIR_ROWS } from '../../src/sim/systems/economy';
import type { AirTally } from '../../src/sim/world';
import { Sim } from '../../src/sim/sim';
import { historyText } from '../../src/ui/historyText';
import { historyRows, tickerRows } from '../../src/worker/historyRows';
import { assets1938 } from '../helpers/earth';

// PLAN 5.11a (the critic's R5-B1, third): no air event reached the history or the ticker. At a
// month's end the log has rows of the AIR_ROWS largest air wars of two nations, by the aircraft
// they lost (`AirWar`), and of the AIR_ROWS largest strikes of a nation on another, by what they
// took (`AirRaids`), from the month's tally (`world.airMonth`, state). Germany at war with
// Poland, seed 1, as `airFx1938`.

const id = (t: string): number => NATIONS_1938.findIndex((n) => n.tag === t) + 1;

/** The log's rows of a kind: [tick, a, b]. */
const rowsOf = (sim: Sim, kind: number): number[][] => {
  const r = sim.world.history.rows;
  const out: number[][] = [];
  for (let i = 0; i < r.length; i += HISTORY_STRIDE) if (r[i + 1] === kind) out.push([r[i]!, r[i + 2]!, r[i + 3]!]);
  return out;
};

describe('the air war in the history log (PLAN 5.11a)', () => {
  it('a month of war: rows of the air fights and the raids at its end, told; a save in the month carries its tally', () => {
    const sim = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    sim.command({ kind: 'declareWar', attacker: id('GER'), defender: id('POL') });
    sim.step(24 * 20);
    expect(sim.world.airMonth.length, 'a tally twenty days in').toBeGreaterThan(0);
    const saved = sim.save();
    // On to past the month's end, the tally as it was in its last hour kept.
    // (Its end: the hour the tally is cleared, a new month's fights after it in that hour.)
    let prev: AirTally[] = [];
    let ended: AirTally[] | null = null;
    for (let h = 0; h < 24 * 15; h++)
      sim.step(1, (w) => {
        if (ended === null && w.airMonth.length < prev.length) ended = prev;
        prev = w.airMonth.map((t) => ({ ...t }));
      });
    expect(ended, 'the month\'s end').not.toBeNull();
    const last: AirTally[] = ended!;
    const wars = rowsOf(sim, EventKind.AirWar);
    const raids = rowsOf(sim, EventKind.AirRaids);
    // All at one month's end, and the tally of the month gone with them.
    expect(new Set([...wars, ...raids].map((r) => r[0])).size).toBe(1);
    // The AIR_ROWS largest of each of the month's tally: the air wars by the aircraft lost, the
    // raids by what they took, the least first.
    const top = (fight: number): AirTally[] => last.filter((t) => t.fight === fight).sort((p, q) => (fight ? p.va + p.vb - q.va - q.vb : p.vb - q.vb) || p.a - q.a || p.b - q.b).slice(-AIR_ROWS);
    expect(wars.map(([, a, b]) => [seaSide(a!).nation, seaSide(b!).nation, seaSide(a!).ships, seaSide(b!).ships])).toEqual(top(1).map((t) => [t.a, t.b, Math.round(t.va), Math.round(t.vb)]));
    expect(raids.map(([, a, b]) => [a, seaSide(b!).nation, seaSide(b!).ships])).toEqual(top(0).map((t) => [t.a, t.b, Math.round(t.vb)]));
    expect([wars.length, raids.length]).toEqual([Math.min(AIR_ROWS, last.filter((t) => t.fight === 1).length), Math.min(AIR_ROWS, last.filter((t) => t.fight === 0).length)]);
    expect(wars.length, 'rows of air fights').toBeGreaterThan(0);
    // Germany's raids on Poland, among the month's largest.
    expect(raids.some(([, a, b]) => a === id('GER') && seaSide(b!).nation === id('POL')), 'Germany\'s raids on Poland').toBe(true);
    // Told by name, with their numbers.
    const told = historyRows(sim.world, (n) => `nation.${NATIONS_1938[n - 1]!.tag}`, () => '').filter((r) => r.kind === EventKind.AirWar || r.kind === EventKind.AirRaids).map(historyText);
    expect(told.find((s) => s.includes('fought in the air'))).toMatch(/^.+ and .+ fought in the air this month: .+ lost [\d,]+ aircraft, .+ [\d,]+$/);
    expect(told.find((s) => s.startsWith('Germany\'s air force struck Poland'))).toMatch(/: [\d,]+ men, guns and vehicles lost$/);
    // The ticker: one row of each, the month's largest (the last logged).
    const ticker = tickerRows(sim.world, (n) => `nation.${NATIONS_1938[n - 1]!.tag}`);
    const tickerAir = (kind: number): number[] => ticker.filter((r) => r.kind === kind).map((r) => r.b);
    expect(tickerAir(EventKind.AirWar)).toEqual([wars.at(-1)![2]]);
    expect(tickerAir(EventKind.AirRaids)).toEqual([raids.at(-1)![2]]);
    expect(ticker.find((r) => r.kind === EventKind.AirRaids)!.an, 'named in the ticker').not.toBe('');
    // The tally is state: the game saved in the month goes on to the same rows.
    const again = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    again.load(saved);
    expect(again.world.airMonth.length, 'the tally loaded').toBeGreaterThan(0);
    again.step(24 * 15);
    expect(rowsOf(again, EventKind.AirWar)).toEqual(wars);
    expect(rowsOf(again, EventKind.AirRaids)).toEqual(raids);
    expect(again.hash()).toBe(sim.hash());
    process.stderr.write(`air rows at the month's end: ${wars.length} air wars, ${raids.length} raids; ${told.slice(-2).join(' / ')}\n`);
  });
});
