import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import type { TickerRow } from '../../src/shared/history';
import { NUKE_ALERT_HOURS, NUKE_ALERT_MIN_MS, NUKE_ALERTS_MAX, nextAlerts } from '../../src/shared/nukeAlert';
import type { FromWorker } from '../../src/shared/protocol';
import { cellOf } from '../../src/sim/data/terrain';
import { HISTORY_STRIDE } from '../../src/sim/history';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// PLAN 7.109a (the critic's run 13): of two AI strikes a day apart only the second had a banner,
// and at Max the pause came 155 game hours after the first, with the next statistics message. The
// worker stops its step at a strike's tick and, with the setting on, pauses there; each strike has
// a banner of its own. The scene of `nukeAlertTwo1938.spec.ts`: Germany at war with France and
// Poland, both fighting to the death with German divisions before their capitals, each armed.

const { w: W, h: H } = SIZE_1938;
const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const [FRA, GER, POL] = [id('FRA'), id('GER'), id('POL')];
const infantry = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

function scene(): Sim {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  s.command({ kind: 'setSetting', key: 'nukesEnabled', value: true });
  for (const [nation, at] of [
    [FRA, cellOf(4.03, 49.26, W, H)],
    [POL, cellOf(20.6, 52.3, W, H)],
  ] as const) {
    s.command({ kind: 'grantWarheads', nation, count: 1 });
    s.command({ kind: 'grantTech', nation, tech: 'ballistic_missiles' });
    s.command({ kind: 'declareWar', attacker: GER, defender: nation });
    for (let k = 0; k < 6; k++) s.command({ kind: 'spawnFormation', nation: GER, x: at[0] + (k % 3) * 0.4, y: at[1] + Math.floor(k / 3) * 0.4, strength: 0, template: infantry });
  }
  s.step(1);
  for (const nation of [FRA, POL]) s.command({ kind: 'setWarFightToDeath', war: s.world.wars.between(GER, nation)!.war.id, side: 1, value: true });
  s.step(1);
  return s;
}

function strikeTicks(s: Sim): number[] {
  const rows = s.world.history.rows;
  const out: number[] = [];
  for (let i = 0; i < rows.length; i += HISTORY_STRIDE) if (rows[i + 1] === EventKind.NukeCasualties) out.push(rows[i]!);
  return out;
}

function server(s: Sim, nukePause: boolean, speed: number | 'max'): SimServer {
  const srv = new SimServer((_m: FromWorker) => {});
  srv.sim = s;
  srv.handle({ type: 'nukePause', on: nukePause }, 0);
  srv.handle({ type: 'speed', speed }, 0);
  srv.handle({ type: 'pause', paused: false }, 0);
  return srv;
}

describe('the worker stops at a nuclear strike (PLAN 7.109a)', () => {
  it('at Max with the pause on: paused on the tick of each strike', () => {
    const s = scene();
    const srv = server(s, true, 'max');
    let now = 0;
    const pumpToPause = (): void => {
      for (let k = 0; k < 400 && srv.ticking && s.world.tick < 24 * 6; k++) srv.pump((now += 16), () => performance.now());
    };
    pumpToPause();
    expect(srv.ticking, 'paused').toBe(false);
    expect(strikeTicks(s), 'the first strike').toHaveLength(1);
    // A row has the hour it happened in; the world's tick is the next once that hour is stepped.
    expect(s.world.tick, 'at the end of its hour').toBe(strikeTicks(s)[0]! + 1);

    srv.handle({ type: 'pause', paused: false }, now);
    pumpToPause();
    expect(srv.ticking, 'paused again').toBe(false);
    const ticks = strikeTicks(s);
    expect(ticks, 'the second strike').toHaveLength(2);
    expect(ticks[1]! - ticks[0]!, 'a day apart at most').toBeLessThanOrEqual(24);
    expect(s.world.tick, 'at the end of its hour').toBe(ticks[1]! + 1);
  });

  it('at a fixed speed with the pause off: stops at the strike, the ticks owed still stepped after', () => {
    const s = scene();
    const start = s.world.tick;
    const srv = server(s, false, 256);
    srv.pump(0, () => 0);
    srv.pump(1000, () => 0); // 256 ticks owed
    const [first] = strikeTicks(s);
    expect(first, 'a strike').toBeDefined();
    expect(s.world.tick, 'stopped at the end of the hour of the strike').toBe(first! + 1);
    expect(srv.ticking, 'the game runs on').toBe(true);
    for (let k = 0; k < 4; k++) srv.pump(1000, () => 0); // no time passes: what is owed alone
    expect(s.world.tick, 'the 256 ticks stepped in all').toBe(start + 256);
  });
});

describe('each strike its alert (PLAN 7.109a)', () => {
  const row = (i: number, tick: number): TickerRow => ({ i, tick, kind: EventKind.NukeCasualties, a: 1, b: 2, x: 3, y: 4, an: '', bn: '', of: '' });
  it('two strikes in one message are two alerts; each goes after its own time; the newest kept', () => {
    const two = nextAlerts([], [row(1, 100), row(2, 124)], 130, 0);
    expect(two.map((a) => a.row.i)).toEqual([1, 2]);
    expect(nextAlerts(two, [], 131, 1000), 'nothing changed: the same').toBe(two);
    // The first's hours are up at 172, the second's at 196; both have had their seconds.
    expect(nextAlerts(two, [], 100 + NUKE_ALERT_HOURS, NUKE_ALERT_MIN_MS).map((a) => a.row.i)).toEqual([2]);
    expect(nextAlerts(two, [], 124 + NUKE_ALERT_HOURS, NUKE_ALERT_MIN_MS)).toEqual([]);
    const many = nextAlerts(two, [row(3, 130), row(4, 130), row(5, 131)], 131, 10);
    expect(many.map((a) => a.row.i)).toEqual([3, 4, 5].slice(-NUKE_ALERTS_MAX));
  });
});
