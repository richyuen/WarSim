import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { FREE_ABOVE, INTEGRATION_RATE, puppetTier, TRIBUTE } from '../../src/sim/systems/puppets';
import { assets1938 } from '../helpers/earth';
import { eventKinds as kinds, nationId, runEvents as run } from '../helpers/sim1938';

// PLAN 1.18: puppets with autonomy; create / release / integrate / revolt. AT: a test per
// transition.

const W = SIZE_1938.w;
const [GER, ITA, ALB, AUT, HUN] = ['GER', 'ITA', 'ALB', 'AUT', 'HUN'].map(nationId) as [number, number, number, number, number];
/** Ticks from tick 0 to 00:00 on day 1 of month m+1 (1938 is not a leap year). */
const MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const toMonth = (m: number): number => 24 * MONTHS.slice(0, m).reduce((a, b) => a + b, 0) + 1;


describe('puppets (PLAN 1.18)', () => {
  it('the 1938 puppets start with their autonomy; tiers follow autonomy', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const nc = s.world.nations.cols;
    expect(nc.overlord[ALB]).toBe(ITA);
    expect(nc.autonomy[ALB]).toBe(NATIONS_1938.find((n) => n.tag === 'ALB')!.overlord!.autonomy);
    expect([puppetTier(10), puppetTier(50), puppetTier(80)]).toEqual(['satellite', 'puppet', 'vassal']);
  });

  it('create: God Mode makes a puppet that pays tribute each month', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const nc = s.world.nations.cols;
    s.command({ kind: 'createPuppet', overlord: GER, subject: AUT, autonomy: 40 });
    const ev = run(s, 1); // tick 0 = 1 January: the monthly assessment runs after the command
    expect(kinds(ev, EventKind.PuppetCreated)).toEqual([[AUT, GER]]);
    expect(nc.overlord[AUT]).toBe(GER);
    // Tribute on 1 February: compare against a twin without the puppet.
    const twin = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    run(twin, 1);
    const [gA, gT] = [nc.gold[AUT]!, twin.world.nations.cols.gold[AUT]!];
    expect(gA).toBeLessThan(gT); // already paid on 1 January
    const income = nc.income[AUT]!;
    const before = nc.gold[GER]! - twin.world.nations.cols.gold[GER]!;
    expect(before).toBeCloseTo(TRIBUTE * (1 - 40 / 100) * income, 6);
  });

  it('release: freeing a puppet is immediate and free', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const twin = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) }); // ALB stays a puppet
    s.command({ kind: 'releasePuppet', subject: ALB });
    const ev = run(s, 1);
    run(twin, 1);
    expect(kinds(ev, EventKind.PuppetReleased)).toEqual([[ALB, ITA]]);
    expect(s.world.nations.cols.overlord[ALB]).toBe(0);
    // No fee; and the 1 January tribute the twin paid stays home.
    const autonomy0 = NATIONS_1938.find((n) => n.tag === 'ALB')!.overlord!.autonomy; // before the month's drift
    const tribute = TRIBUTE * (1 - autonomy0 / 100) * twin.world.nations.cols.income[ALB]!;
    expect(s.world.nations.cols.gold[ALB]! - twin.world.nations.cols.gold[ALB]!).toBeCloseTo(tribute, 6);
  });

  it('leaves freely above autonomy 90', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'setAutonomy', subject: ALB, value: FREE_ABOVE + 1 });
    const ev = run(s, 1);
    expect(kinds(ev, EventKind.PuppetReleased)).toContainEqual([ALB, ITA]);
    expect(s.world.nations.cols.overlord[ALB]).toBe(0);
  });

  it('integrate: a low-autonomy satellite is absorbed with its land and army', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    s.command({ kind: 'createPuppet', overlord: GER, subject: HUN, autonomy: 0 });
    const hunCells = w.cells.owner.reduce((n, o) => n + (o === HUN ? 1 : 0), 0);
    const gerCells = w.cells.owner.reduce((n, o) => n + (o === GER ? 1 : 0), 0);
    const hunDivs = w.formations.ids().filter((id) => w.formations.cols.nation[id] === HUN).length;
    expect(hunDivs).toBeGreaterThan(0);
    // 100 / (INTEGRATION_RATE × ~1) months at autonomy ≈ 0 (it drifts up 0.25 a month).
    const months = Math.ceil(100 / (INTEGRATION_RATE * 0.9));
    let ev: number[][] = [];
    for (let m = 0; m < months + 2 && w.nations.cols.living[HUN] === 1; m++) ev = ev.concat(run(s, 24 * 31));
    expect(kinds(ev, EventKind.PuppetIntegrated)).toEqual([[HUN, GER]]);
    expect(w.nations.cols.living[HUN]).toBe(0);
    expect(w.cells.owner.reduce((n, o) => n + (o === GER ? 1 : 0), 0)).toBe(gerCells + hunCells);
    expect(w.cells.controller.some((c) => c === HUN)).toBe(false);
    // Its divisions now serve the overlord (none destroyed by the integration itself).
    expect(w.formations.ids().filter((id) => w.formations.cols.nation[id] === HUN)).toEqual([]);
  });

  it('revolt: a disloyal puppet with a voice declares a war of independence', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'setPuppetLoyalty', subject: ALB, value: 5 });
    const ev = run(s, 1);
    expect(kinds(ev, EventKind.PuppetRevolt)).toEqual([[ALB, ITA]]);
    expect(kinds(ev, EventKind.WarDeclared)).toContainEqual([ALB, ITA]);
    expect(s.world.nations.cols.overlord[ALB]).toBe(0);
    expect(s.world.wars.atWar(ALB, ITA)).toBe(true);
  });

  it('a voiceless satellite (autonomy < 10) cannot revolt however disloyal', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.command({ kind: 'setAutonomy', subject: ALB, value: 5 });
    s.command({ kind: 'setPuppetLoyalty', subject: ALB, value: 0 });
    const ev = run(s, toMonth(1));
    expect(kinds(ev, EventKind.PuppetRevolt)).toEqual([]);
    expect(s.world.nations.cols.overlord[ALB]).toBe(ITA);
  });

  it('a crushing peace makes the loser a puppet', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    for (const n of [GER, AUT]) {
      w.alliances.leave(n);
      w.alliances.guarantees = w.alliances.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
    }
    s.command({ kind: 'declareWar', attacker: GER, defender: AUT });
    run(s, 24); // occupy right before the 00:00 assessment at tick 24
    // Half of Austria (score 100), Vienna held, so Austria survives to sign.
    let vienna = -1;
    w.cities.forEach((id) => {
      if (w.cities.cols.capitalOf[id] === AUT) vienna = w.cities.cols.cell[id]!;
    });
    const aut: number[] = [];
    w.cells.owner.forEach((o, c) => o === AUT && c !== vienna && aut.push(c));
    for (const c of aut.slice(0, Math.ceil(aut.length / 2))) w.setController(c, GER);
    const ev = run(s, 1);
    expect(kinds(ev, EventKind.PuppetCreated)).toEqual([[AUT, GER]]);
    expect(w.nations.cols.overlord[AUT]).toBe(GER);
  });

  it('no revolt or release in the first months of 1938 except autonomy > 90 leavers', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const ev = run(s, toMonth(3));
    expect(kinds(ev, EventKind.PuppetRevolt)).toEqual([]);
    for (const [p] of kinds(ev, EventKind.PuppetReleased)) expect(NATIONS_1938[p! - 1]!.overlord!.autonomy).toBeGreaterThanOrEqual(FREE_ABOVE);
  });
});
