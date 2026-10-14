import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import type { TickerRow } from '../../src/shared/history';
import { nukeStrike } from '../../src/shared/history';
import { newStrikes } from '../../src/shared/nukeAlert';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { NUKE_SHOCK, NUKE_SHOCK_DECAY, TABOO_AFTER, TABOO_RECOVERY } from '../../src/sim/systems/nuclear';
import type { World } from '../../src/sim/world';
import { historyText } from '../../src/ui/historyText';
import { historyRows } from '../../src/worker/historyRows';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.6a: God Mode's strike (`godNuke`): a burst at once, whatever the toggles, no nation's:
// its blast, fallout and shocks as any burst's, but no outrage and no grievance (God is struck
// back by no one). And which strikes a statistics message brings for the alert (`newStrikes`).

const { w: W, h: H } = SIZE_1938;
const GER = nationId('GER');
const berlin = cellOf(13.4, 52.52, W, H);

describe('God Mode\'s strike (PLAN 6.6a)', () => {
  it('bursts at once, nukes off or not: blast, fallout, the shock and the taboo; no outrage, no grievance; told as God\'s', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.nukesEnabled = false;
    const kinds: number[] = [];
    s.command({ kind: 'godNuke', x: berlin[0], y: berlin[1], thermonuclear: true });
    s.step(1, (x: World) => {
      for (let i = 0; i < x.out.events.length; i += 6) kinds.push(x.out.events[i + 1]!);
      x.out.events.length = 0;
      x.out.fires.length = 0;
    });
    expect(kinds).toContain(EventKind.NukeDetonated);
    expect(w.fallout.size).toBeGreaterThan(0);
    // Tick 0 is a day's first hour: the day's decay and recovery after the command's burst.
    expect(w.nukeShock.get(GER)).toBe(NUKE_SHOCK - NUKE_SHOCK_DECAY);
    expect(w.nukeTaboo).toBeCloseTo(TABOO_AFTER + TABOO_RECOVERY, 12);
    expect(w.nukeOutrage.size).toBe(0);
    expect(w.nukeGrievance.size).toBe(0);
    const rows = historyRows(w, (n) => `nation.${NATIONS_1938[n - 1]!.tag}`, () => '').filter((r) => r.kind === EventKind.NukeCasualties);
    expect(rows.length).toBe(1);
    expect(rows[0]!.a).toBe(0);
    expect(nukeStrike(rows[0]!.b)).toMatchObject({ nation: GER, yieldN: 2 });
    expect(historyText(rows[0]!)).toMatch(/^A bomb fell from the heavens on Germany: a hydrogen bomb, [\d,]+ dead$/);
  });
});

describe('the strikes a statistics message brings (PLAN 6.6a)', () => {
  const row = (i: number, kind: number): TickerRow => ({ i, tick: i, kind, a: 1, b: 2, x: 3, y: 4, an: '', bn: '', of: '' });
  const strike = EventKind.NukeCasualties;
  const war = EventKind.WarDeclared;
  it.each([
    ['a world\'s first message is its past', null, [row(1, strike)], [strike], [], false],
    ['a new strike row', { world: 7, i: 0 }, [row(0, war), row(1, strike)], [strike], [1], true],
    ['a strike seen already', { world: 7, i: 1 }, [row(1, strike)], [], [], false],
    ['a strike in the news alone (gone from the five rows)', { world: 7, i: 5 }, [row(5, war)], [war, strike], [], true],
    ['another world: its past', { world: 6, i: 9 }, [row(1, strike)], [strike], [], false],
    ['no strike', { world: 7, i: 0 }, [row(1, war)], [war], [], false],
  ] as const)('%s', (_, seen, rows, news, fresh, struck) => {
    const r = newStrikes(rows, 7, seen, news);
    expect(r.rows.map((x) => x.i)).toEqual(fresh);
    expect(r.struck).toBe(struck);
    expect(r.seen).toEqual({ world: 7, i: Math.max(seen && seen.world === 7 ? seen.i : -1, ...rows.map((x) => x.i)) });
  });
});
