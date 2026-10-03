import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { cellOf } from '../../src/sim/data/terrain';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 1.32a: the new God Mode commands (rename, spawn revolt, income bonus, forced collapse) and
// the owned-cell counts they exposed as stale (now maintained by World.setOwner).

const { w: W, h: H } = SIZE_1938;
const [GER, POL, YUG] = ['GER', 'POL', 'YUG'].map(nationId) as number[];

function recount(w: World): Map<number, number> {
  const m = new Map<number, number>();
  for (const o of w.cells.owner) if (o !== 0) m.set(o, (m.get(o) ?? 0) + 1);
  return m;
}

function expectCountsMatch(w: World): void {
  const counts = recount(w);
  w.nations.forEach((n) => expect(w.nations.cols.cells[n], `nation ${n}`).toBe(counts.get(n) ?? 0));
}

describe('God Mode commands (PLAN 1.32a)', () => {
  it('rename survives save/load and an empty name restores the scenario name', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'renameNation', nation: GER!, name: '  Greater Ostmark ' });
    s.step(1);
    expect(s.world.names.get(GER!)).toBe('Greater Ostmark');
    const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    t.load(s.save());
    expect(t.world.names.get(GER!)).toBe('Greater Ostmark');
    expect(t.hash()).toBe(s.hash());
    t.command({ kind: 'renameNation', nation: GER!, name: '' });
    t.step(1);
    expect(t.world.names.has(GER!)).toBe(false);
  });

  it('spawn revolt takes the province from its holder; counts stay exact', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const [x, y] = cellOf(21.0, 52.23, W, H);
    const p = s.world.cells.province[Math.floor(y) * W + Math.floor(x)]!;
    const polBefore = s.world.nations.cols.cells[POL!]!;
    const created = s.world.nations.highWater;
    s.command({ kind: 'spawnRevolt', province: p });
    s.step(1);
    expect(s.world.nations.highWater).toBe(created + 1);
    const rebel = created;
    expect(s.world.nations.cols.living[rebel]).toBe(1);
    expect(s.world.cells.owner[Math.floor(y) * W + Math.floor(x)]).toBe(rebel);
    expect(s.world.nations.cols.cells[POL!]).toBe(polBefore - s.world.nations.cols.cells[rebel]!);
    expectCountsMatch(s.world);
  });

  it('income bonus is clamped to ±100', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'setIncomeBonus', nation: GER!, value: 250 });
    s.step(1);
    expect(s.world.nations.cols.incomeBonus[GER!]).toBe(100);
  });

  it('a forced collapse (Kill) ends the nation and splits all its land', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const before = s.world.nations.cols.cells[YUG!]!;
    const created = s.world.nations.highWater;
    s.command({ kind: 'collapseNation', nation: YUG! });
    s.step(1);
    const nc = s.world.nations.cols;
    expect(nc.living[YUG!]).toBe(0);
    expect(nc.cells[YUG!]).toBe(0);
    let land = 0;
    for (let n = created; n < s.world.nations.highWater; n++) land += nc.cells[n]!;
    expect(s.world.nations.highWater - created).toBeGreaterThanOrEqual(2);
    expect(land).toBe(before);
    expectCountsMatch(s.world);
  });

  it('applyNow (God UI while paused) is replay-identical to applying at the next step', () => {
    const a = new Sim({ scenario: '1938', seed: 3, assets: assets1938(W) });
    const b = new Sim({ scenario: '1938', seed: 3, assets: assets1938(W) });
    a.step(30);
    b.step(30);
    const cmd = { kind: 'declareWar', attacker: GER!, defender: POL! } as const;
    a.command(cmd);
    a.applyNow();
    b.command(cmd);
    expect(a.world.commandLog.at(-1)!.tick).toBe(30);
    a.step(48);
    b.step(48);
    expect(b.world.commandLog.at(-1)!.tick).toBe(30);
    expect(a.hash()).toBe(b.hash());
  }, 120_000);

  it('owned-cell counts match the owner grid after two months of AI wars', () => {
    const s = new Sim({ scenario: '1938', seed: 7, assets: assets1938(W) });
    s.step(24 * 60);
    expectCountsMatch(s.world);
  }, 120_000);
});

// PLAN 1.33b: player diplomacy is refusable (unlike God commands).
describe('player diplomacy (PLAN 1.33b)', () => {
  const [SWI, LIT] = ['SWI', 'LIT'].map(nationId) as number[];

  it('a peace offer is refused at an even score and accepted once the offering side leads', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'declareWar', attacker: POL!, defender: LIT! });
    s.step(1);
    const war = s.world.wars.list.find((w) => w.sides[0].includes(POL!) && w.sides[1].includes(LIT!))!;
    expect(war).toBeTruthy();
    s.command({ kind: 'offerPeace', war: war.id, from: POL! });
    s.step(1);
    expect(s.world.wars.list.includes(war)).toBe(true); // refused
    war.score = 40; // the attackers (Poland) lead
    s.command({ kind: 'offerPeace', war: war.id, from: POL! });
    s.step(1);
    expect(s.world.wars.atWar(POL!, LIT!)).toBe(false);
  });

  it('a side fighting to the death never accepts', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'declareWar', attacker: POL!, defender: LIT! });
    s.step(1);
    const war = s.world.wars.list.find((w) => w.sides[0].includes(POL!))!;
    war.score = 80;
    war.fightToDeath[1] = true;
    s.command({ kind: 'offerPeace', war: war.id, from: POL! });
    s.step(1);
    expect(s.world.wars.atWar(POL!, LIT!)).toBe(true);
  });

  it('an alliance proposal is accepted by an unallied neighbour and refused by an enemy', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    expect(s.world.alliances.allianceOf(SWI!)).toBeUndefined();
    s.command({ kind: 'proposeAlliance', from: POL!, to: SWI! });
    s.step(1);
    expect(s.world.alliances.allied(POL!, SWI!)).toBe(true);
    s.command({ kind: 'declareWar', attacker: POL!, defender: LIT! });
    s.step(1);
    s.command({ kind: 'proposeAlliance', from: POL!, to: LIT! });
    s.step(1);
    expect(s.world.alliances.allied(POL!, LIT!)).toBe(false);
  });
});

// Review after PLAN 1.33: player control is sim state, so a load keeps it (the AI-off flag was
// saved while the player link lived only in the UI, leaving an AI-less nation after a reload).
describe('player control state', () => {
  it('setPlayer turns AI off, switching restores the previous one, and save/load keeps it', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const nc = s.world.nations.cols;
    s.command({ kind: 'setPlayer', nation: POL! });
    s.step(1);
    expect(s.world.settings.player).toBe(POL);
    expect(nc.aiOff[POL!]).toBe(1);
    s.command({ kind: 'setPlayer', nation: GER! });
    s.step(1);
    expect(nc.aiOff[POL!]).toBe(0);
    expect(nc.aiOff[GER!]).toBe(1);
    const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    t.load(s.save());
    expect(t.world.settings.player).toBe(GER);
    expect(t.hash()).toBe(s.hash());
    t.command({ kind: 'setPlayer', nation: 0 });
    t.step(1);
    expect(t.world.settings.player).toBe(0);
    expect(t.world.nations.cols.aiOff[GER!]).toBe(0);
  });
});
