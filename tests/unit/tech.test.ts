import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, NATIONS_1938, RULES_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { economicAi } from '../../src/sim/ai/economic';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { queueFormation } from '../../src/sim/systems/production';
import { spawnRebels } from '../../src/sim/systems/revolts';
import { grantTechs, knowsTechs, techClosure, techMask } from '../../src/sim/tech';
import { navOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 3.1a: what a nation knows is state, and production asks for it. AT: a nation with a full
// treasury is refused the template whose techs it lacks, and gets it once it knows them.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const template = (t: string): number => TEMPLATES_LAND.findIndex((x) => x.id === t);
const tech = (t: string): number => RULES_1938.techs.findIndex((x) => x.id === t);
const PANZER = template('panzer_div');
const sim1938 = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
  s.world.settings.aiEnabled = false;
  return s;
};
const events = (sim: Sim, kind: number): number =>
  sim.world.out.events.reduce((n, v, i) => n + (i % 6 === 1 && v === kind ? 1 : 0), 0);

describe('techs (PLAN 3.1a)', () => {
  it('every tech has a bit, and a template asks for the techs of its units and what leads to them', () => {
    expect(RULES_1938.techs.length).toBeGreaterThan(30);
    expect(RULES_1938.techs.length).toBeLessThanOrEqual(64);
    const need = RULES_1938.templates[PANZER]!.techs;
    for (const t of ['armor_light_1', 'armor_medium_1', 'motorisation', 'artillery_2', 'artillery_1']) {
      expect(knowsMask(need, techMask([tech(t)])), t).toBe(true);
    }
    expect(knowsMask(need, techMask([tech('armor_heavy_1')]))).toBe(false);
    expect(RULES_1938.templates[template('infantry_div_cadre')]!.techs).toEqual([0, 0]);
    // The closure goes down the prerequisites.
    expect(knowsMask(techClosure(RULES_1938.techs, [tech('armor_mbt')]), techMask([tech('armor_light_1'), tech('armor_heavy_1')]))).toBe(true);
  });

  it('1938: a nation knows what was known before 1938, what its army fields and what the scenario gives it', () => {
    const w = sim1938().world;
    const knows = (tag: string, t: string): boolean => knowsTechs(w, id(tag), techMask([tech(t)]));
    // Before 1938: everybody.
    for (const tag of ['GER', 'MON', 'LUX']) for (const t of ['armor_light_1', 'motorisation', 'anti_tank_guns']) expect(knows(tag, t), `${tag} ${t}`).toBe(true);
    // The medium tank of 1938: Germany fields it, the scenario gives it to four more.
    for (const tag of ['GER', 'SOV', 'FRA', 'ENG', 'JAP']) expect(knows(tag, 'armor_medium_1'), tag).toBe(true);
    for (const tag of ['MON', 'LUX', 'IRE']) expect(knows(tag, 'armor_medium_1'), tag).toBe(false);
    // Nobody is ahead of the calendar by more than its own army is.
    const year = 1938;
    w.nations.forEach((n) => {
      RULES_1938.techs.forEach((t, i) => {
        if (t.year <= year || !knowsTechs(w, n, techMask([i]))) return;
        const fielded = [...new Set(formationsOf(w, n).map((f) => w.formations.cols.template[f]!))].some((tp) => knowsMask(RULES_1938.templates[tp]!.techs, techMask([i])));
        expect(fielded, `${NATIONS_1938[n - 1]!.tag} knows ${t.id} (${t.year})`).toBe(true);
      });
      expect(knowsTechs(w, n, techMask([tech('armor_heavy_1')]))).toBe(false);
    });
    // Every nation can build what the AI falls back on.
    w.nations.forEach((n) => expect(knowsTechs(w, n, RULES_1938.templates[BUILD_MIX_1938.infantry]!.techs)).toBe(true));
  });

  it('a template is refused to the nation that lacks its techs, however rich, and built once it knows them', () => {
    const sim = sim1938();
    const w = sim.world;
    const nc = w.nations.cols;
    const LUX = id('LUX');
    const rule = RULES_1938.templates[PANZER]!;
    nc.gold[LUX] = 1e6;
    nc.manpower[LUX] = 1e6;
    w.out.events.length = 0;
    expect(queueFormation(w, LUX, PANZER)).toBe(0);
    expect(events(sim, EventKind.ProductionRejected)).toBe(1);
    expect(nc.gold[LUX]).toBe(1e6);
    expect(w.production.count).toBe(0);
    // The command takes the same way.
    sim.command({ kind: 'queueFormation', nation: LUX, template: PANZER });
    sim.step(1);
    expect(w.production.count).toBe(0);
    // Germany knows them.
    expect(queueFormation(w, id('GER'), PANZER)).not.toBe(0);
    // And Luxembourg, once it does.
    grantTechs(w, LUX, rule.techs);
    const gold = nc.gold[LUX]!; // the step charged a month
    expect(queueFormation(w, LUX, PANZER)).not.toBe(0);
    expect(nc.gold[LUX]).toBe(gold - rule.gold);
  });

  it('what a nation knows is saved, loaded and hashed', () => {
    const sim = sim1938();
    const w = sim.world;
    const LUX = id('LUX');
    const before = sim.hash();
    grantTechs(w, LUX, techMask([tech('armor_heavy_1')]));
    expect(sim.hash()).not.toBe(before);
    const twin = sim1938();
    twin.load(sim.save());
    expect(knowsTechs(twin.world, LUX, techMask([tech('armor_heavy_1')]))).toBe(true);
    expect(twin.hash()).toBe(sim.hash());
  });

  it('a nation founded in a revolt knows what the nation it left knew', () => {
    const w = sim1938().world;
    const GER = id('GER');
    const { owner, province } = w.cells;
    const g = navOf(w).graph;
    let p = 0;
    for (let q = 1; q < w.provinces.count && p === 0; q++) if ((g.centre[q] ?? -1) >= 0 && owner[g.centre[q]!] === GER && province[g.centre[q]!] === q) p = q;
    const rebels = spawnRebels(w, [p], GER);
    expect(rebels).toBeGreaterThan(NATIONS_1938.length);
    expect(knowsTechs(w, rebels, RULES_1938.templates[PANZER]!.techs)).toBe(true);
    expect([w.nations.cols.tech0[rebels], w.nations.cols.tech1[rebels]]).toEqual([w.nations.cols.tech0[GER], w.nations.cols.tech1[GER]]);
  });

  it('the economic AI orders what it can build: a rich nation at war without the medium tank trains infantry on its third order', () => {
    const run = (withTech: boolean): number[] => {
      const sim = sim1938();
      const w = sim.world;
      const nc = w.nations.cols;
      const USA = id('USA');
      w.settings.aiEnabled = true;
      w.nations.forEach((n) => (nc.aiOff[n] = n === USA ? 0 : 1));
      // No army to pay, the money and the men, a war, and the third order next.
      for (const f of formationsOf(w, USA)) destroyFormation(w, f);
      nc.gold[USA] = 1e7;
      nc.manpower[USA] = 1e7;
      nc.builds[USA] = 2;
      w.wars.set(USA, id('MEX'), true);
      expect(knowsTechs(w, USA, RULES_1938.templates[PANZER]!.techs)).toBe(false);
      if (withTech) grantTechs(w, USA, RULES_1938.templates[PANZER]!.techs);
      economicAi(ECONOMY_TABLES_1938, BUILD_MIX_1938)(w);
      return w.production.ids().map((r) => w.production.cols.template[r]!);
    };
    const without = run(false);
    expect(without[0]).toBe(BUILD_MIX_1938.infantry);
    expect(without).not.toContain(PANZER);
    expect(run(true)[0]).toBe(PANZER);
  });
});

function knowsMask(have: readonly [number, number], need: readonly [number, number]): boolean {
  return (have[0] & need[0]) >>> 0 === need[0] && (have[1] & need[1]) >>> 0 === need[1];
}

function formationsOf(w: Sim['world'], n: number): number[] {
  const out: number[] = [];
  w.formations.forEach((f) => {
    if (w.formations.cols.nation[f] === n) out.push(f);
  });
  return out;
}
