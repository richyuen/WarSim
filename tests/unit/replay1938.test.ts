import { describe, expect, it } from 'vitest';
import type { Command } from '../../src/shared/commands';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// Review after PLAN 1.15–1.19 (SPEC §2.3, I1/I5 on the 1938 world): every diplomacy and God
// command added since 1.15 is in the command log, and replaying that log on a fresh world
// reproduces the run bit for bit; save → load → save is byte-identical with the JSON sections.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const [GER, POL, AUT, ITA, ALB, SOV, HUN] = ['GER', 'POL', 'AUT', 'ITA', 'ALB', 'SOV', 'HUN'].map(nationId) as number[];

const SCRIPT: [number, Command][] = [
  [0, { kind: 'setSetting', key: 'revoltMode', value: 'region' }],
  [5, { kind: 'declareWar', attacker: GER!, defender: POL! }],
  [6, { kind: 'paintControl', nation: GER!, x: cellOf(18.5, 52.5, W, H)[0], y: cellOf(18.5, 52.5, W, H)[1], r: 2 }],
  [30, { kind: 'createPuppet', overlord: GER!, subject: AUT!, autonomy: 20 }],
  [40, { kind: 'setUnity', alliance: 1, value: 15 }],
  [41, { kind: 'setPuppetLoyalty', subject: ALB!, value: 5 }],
  [50, { kind: 'setSuppression', nation: SOV!, level: 0.5 }],
  [51, { kind: 'setUnrest', province: 100, value: 95 }],
  [60, { kind: 'createAlliance', leader: HUN!, members: [], nameKey: 'alliance.test' }],
  [90, { kind: 'queueFormation', nation: ITA!, template: 0 }],
  [400, { kind: 'forcePeace', war: 3 }],
  [700, { kind: 'setSetting', key: 'winnerTakesAll', value: true }],
];
const TICKS = 24 * 70;

function scripted(seed: number): Sim {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(W) });
  let k = 0;
  for (let t = 0; t < TICKS; t++) {
    while (k < SCRIPT.length && SCRIPT[k]![0] === t) s.command(SCRIPT[k++]![1]);
    s.step(1);
  }
  return s;
}

describe('1938 command-log replay (review after PLAN 1.19)', () => {
  it('replaying the command log on a fresh world reproduces the run', () => {
    const a = scripted(12);
    expect(a.world.commandLog.length).toBe(SCRIPT.length);
    const b = new Sim({ scenario: '1938', seed: 12, assets: assets1938(W) });
    const log = [...a.world.commandLog];
    let k = 0;
    for (let t = 0; t < TICKS; t++) {
      while (k < log.length && log[k]!.tick === t) b.command(log[k++]!.cmd);
      b.step(1);
    }
    expect(b.hash()).toBe(a.hash());
  }, 120_000); // two 70-day AI runs

  it('save → load → save is byte-identical after diplomacy, puppets and revolts', () => {
    const a = scripted(13);
    const bytes = a.save();
    const b = new Sim({ scenario: '1938', seed: 0, assets: assets1938(W) });
    b.load(bytes);
    expect(Buffer.from(b.save()).equals(Buffer.from(bytes))).toBe(true);
  });
});
