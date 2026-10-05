import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { cellOf } from '../../src/sim/data/terrain';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { EventKind } from '../../src/shared/events';
import { KILL_STATES } from '../../src/sim/systems/revival';
import { eventKinds as kinds, nationId, runEvents as run } from '../helpers/sim1938';

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
    const had = recount(s.world);
    s.command({ kind: 'collapseNation', nation: YUG! });
    s.step(1);
    const nc = s.world.nations.cols;
    expect(nc.living[YUG!]).toBe(0);
    expect(nc.cells[YUG!]).toBe(0);
    let land = 0;
    for (let n = created; n < s.world.nations.highWater; n++) land += nc.cells[n]!;
    expect(s.world.nations.highWater - created).toBeGreaterThanOrEqual(2);
    // Since ADR-99 a piece of the land that founds nothing goes to its neighbour (here one cell
    // of an island, to Italy): the new nations and the neighbours hold all of it between them.
    let gained = 0;
    for (const [n, cells] of recount(s.world)) if (n < created && n !== YUG) gained += cells - (had.get(n) ?? 0);
    expect(land + gained).toBe(before);
    expect(land).toBeGreaterThan(before * 0.99);
    expectCountsMatch(s.world);
  });

  // PLAN 2.15a (ADR-99; critic R2-B6): a Kill of France founded 37 nations and left 38 wars.
  it(`a Kill founds at most ${KILL_STATES} nations, starts no war and leaves no land behind`, () => {
    for (const tag of ['FRA', 'YUG', 'ITA', 'LUX']) {
      const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
      const w = s.world;
      const c = nationId(tag)!;
      const living = (): Set<number> => {
        const l = new Set<number>();
        w.nations.forEach((n) => {
          if (w.nations.cols.living[n] === 1) l.add(n);
        });
        return l;
      };
      const before = living();
      const wars = new Set(w.wars.list.map((x) => x.id));
      const total = recount(w);
      s.command({ kind: 'collapseNation', nation: c });
      const ev = run(s, 1);
      const declared = kinds(ev, EventKind.WarDeclared);
      const after = living();
      const born = [...after].filter((n) => !before.has(n));
      // Italy's Kill also brings Ethiopia back and frees Albania: neither is a nation founded.
      const founded = born.filter((n) => w.nations.cols.origin[n] !== 0);
      expect(after.has(c), tag).toBe(false);
      expect(founded.length, `${tag}: nations founded`).toBeGreaterThanOrEqual(1);
      expect(founded.length, `${tag}: nations founded`).toBeLessThanOrEqual(KILL_STATES);
      expect(declared, `${tag}: wars declared`).toEqual([]);
      expect(w.wars.list.filter((x) => !wars.has(x.id)), `${tag}: new wars`).toEqual([]);
      expect(w.nations.cols.cells[c], `${tag}: cells left`).toBe(0);
      expect([...recount(w).values()].reduce((a, n) => a + n, 0), `${tag}: owned land`).toBe([...total.values()].reduce((a, n) => a + n, 0));
      for (const n of founded) expect(w.nations.cols.cells[n], `${tag}: nation ${n}`).toBeGreaterThan(0);
      // PLAN 2.15d: the history says a revolt of the nations born only (those founded, and
      // Ethiopia, which returns with its own "returned"); land that went to a nation already
      // there is land handed over ("Italy broke away from France" before).
      const gainers = [...before].filter((n) => n !== c && (recount(w).get(n) ?? 0) > (total.get(n) ?? 0)).sort((a, b) => a - b);
      const revolts = kinds(ev, EventKind.RevoltSpawned);
      const ceded = kinds(ev, EventKind.LandCeded);
      expect(revolts.map(([a]) => a).sort((a, b) => a! - b!), `${tag}: revolts`).toEqual([...born].sort((a, b) => a - b));
      expect(ceded.every(([, b]) => b === c), `${tag}: ceded by`).toBe(true);
      expect([...new Set(ceded.map(([a]) => a!))].filter((n) => before.has(n)).sort((a, b) => a - b), `${tag}: ceded to`).toEqual(gainers);
      expectCountsMatch(w);
      console.log(`Kill ${tag}: ${before.size} -> ${after.size} living, ${founded.length} founded (${founded.map((n) => w.nations.cols.cells[n]).join(', ')} cells), ${wars.size} -> ${w.wars.list.length} wars`);
    }
  }, 120_000);

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
