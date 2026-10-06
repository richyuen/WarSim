import { describe, expect, it } from 'vitest';
import unitsLand from '../../data/units/land.json';
import en from '../../src/ui/i18n/en.json';
import { EventKind } from '../../src/shared/events';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, NATIONS_1938, RULES_1938, SIZE_1938, TEMPLATES_LAND, UNIT_IDS_1938 } from '../../src/sim/scenario1938';
import { economicAi, RESERVE_MONTHS } from '../../src/sim/ai/economic';
import { Sim } from '../../src/sim/sim';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { destroyFormation, elementIndex } from '../../src/sim/systems/elements';
import { PRODUCTION_COST_SCALE, queueFormation, TRAIN_TIME_SCALE } from '../../src/sim/systems/production';
import { grantTechs, knowsTechs, techMask } from '../../src/sim/tech';
import { Mobility } from '../../src/sim/nav/grid';
import { assets1938 } from '../helpers/earth';

// PLAN 3.1c: templates for what the tech gate holds back. AT: the heavy template is refused in
// 1938 and built once `armor_heavy_1` is known (the AT of PLAN 3.1); its cost, days and upkeep.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const template = (t: string): number => TEMPLATES_LAND.findIndex((x) => x.id === t);
const tech = (t: string): number => RULES_1938.techs.findIndex((x) => x.id === t);
const PANZER = template('panzer_div');
const PANZER_2 = template('panzer_div_2');
const HEAVY = template('heavy_panzer_div');
const MECH = template('mech_div');
const MBT = template('mbt_div');
const NEW = ['panzer_div_2', 'heavy_panzer_div', 'mech_div', 'mbt_div'];
const sim1938 = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
  s.world.settings.aiEnabled = false;
  return s;
};
const needs = (t: number, name: string): boolean => {
  const [a, b] = techMask([tech(name)]);
  const have = RULES_1938.templates[t]!.techs;
  return (have[0] & a) >>> 0 === a && (have[1] & b) >>> 0 === b;
};

describe('armour templates (PLAN 3.1c)', () => {
  it('the four templates stand after the fifteen of 1938, each with a name, and ask for the techs of their units', () => {
    // After: a formation and an order are saved with the index of their template.
    expect(TEMPLATES_LAND.slice(0, 15).map((t) => t.id)).toEqual(['infantry_div', 'infantry_div_square', 'infantry_div_cadre', 'infantry_div_colonial', 'light_infantry_div', 'mountain_div', 'motorised_div', 'panzer_div', 'light_mech_div', 'tank_brigade', 'tank_corps', 'rifle_div_soviet', 'cavalry_div', 'cavalry_brigade', 'garrison_brigade']);
    expect(TEMPLATES_LAND.slice(15).map((t) => t.id)).toEqual(NEW);
    for (const t of NEW) expect((en as Record<string, string>)[`template.${t}`], t).toMatch(/\S/);
    expect(needs(PANZER_2, 'armor_medium_2')).toBe(true);
    expect(needs(PANZER_2, 'armor_heavy_1')).toBe(false);
    expect(needs(HEAVY, 'armor_heavy_1')).toBe(true);
    expect(needs(HEAVY, 'armor_mbt')).toBe(false);
    expect(needs(MECH, 'mechanisation')).toBe(true);
    expect(needs(MECH, 'armor_medium_1')).toBe(false);
    expect(needs(MBT, 'armor_mbt')).toBe(true);
    // Each has the unit it is named for.
    const has = (t: number, unit: string): boolean => RULES_1938.templates[t]!.elements.some((e) => UNIT_IDS_1938[e.unit] === unit);
    expect(has(PANZER_2, 'tank_medium_2')).toBe(true);
    expect(has(HEAVY, 'tank_heavy')).toBe(true);
    expect(has(MECH, 'infantry_mechanised')).toBe(true);
    expect(has(MBT, 'tank_mbt')).toBe(true);
    // No infantry on foot in them: they move on tracks, the heavy division at the heavy tank's pace.
    for (const t of [PANZER_2, HEAVY, MECH, MBT]) expect(RULES_1938.templates[t]!.mobility, TEMPLATES_LAND[t]!.id).toBe(Mobility.tracked);
    expect(RULES_1938.templates[HEAVY]!.speedKmh).toBe(9);
  });

  it('the heavy division: its cost, days and upkeep are those of its units', () => {
    const units = new Map(unitsLand.types.map((u) => [u.id, u]));
    const els = TEMPLATES_LAND[HEAVY]!.elements;
    const sum = (of: (u: (typeof unitsLand.types)[number]) => number): number => els.reduce((s, e) => s + of(units.get(e.type)!) * e.count, 0);
    const rule = RULES_1938.templates[HEAVY]!;
    expect(rule.gold).toBeCloseTo(PRODUCTION_COST_SCALE * sum((u) => u.cost.gold), 9);
    expect(rule.manpower).toBe(sum((u) => u.cost.manpower));
    expect(rule.days).toBe(TRAIN_TIME_SCALE * 110); // the heavy tank is the longest in the making
    expect(ECONOMY_TABLES_1938.templateUpkeep[HEAVY]).toBeCloseTo(sum((u) => u.upkeep.gold), 9);
    // Dearer to raise and to keep than the armoured division of 1938, and than the one of 1941.
    for (const t of [PANZER, PANZER_2]) {
      expect(rule.gold).toBeGreaterThan(RULES_1938.templates[t]!.gold);
      expect(ECONOMY_TABLES_1938.templateUpkeep[HEAVY]!).toBeGreaterThan(ECONOMY_TABLES_1938.templateUpkeep[t]!);
    }
    expect(RULES_1938.templates[PANZER_2]!.gold).toBeGreaterThan(RULES_1938.templates[PANZER]!.gold);
    expect(RULES_1938.templates[MBT]!.gold).toBeGreaterThan(rule.gold);
  });

  it('the heavy division is refused in 1938, to Germany with a full treasury, and built once the heavy tank is known', () => {
    const sim = sim1938();
    const twin = sim1938();
    const w = sim.world;
    const nc = w.nations.cols;
    const GER = id('GER');
    const rule = RULES_1938.templates[HEAVY]!;
    for (const s of [sim, twin]) {
      s.world.nations.cols.gold[GER] = 1e6;
      s.world.nations.cols.manpower[GER] = 1e7;
    }
    w.out.events.length = 0;
    expect(queueFormation(w, GER, HEAVY)).toBe(0);
    expect(w.out.events.filter((v, i) => i % 6 === 1 && v === EventKind.ProductionRejected)).toHaveLength(1);
    expect(nc.gold[GER]).toBe(1e6);
    expect(w.production.count).toBe(0);
    // The heavy tank alone is not the division: its other units are not known either.
    grantTechs(w, GER, techMask([tech('armor_heavy_1')]));
    expect(queueFormation(w, GER, HEAVY)).toBe(0);
    grantTechs(w, GER, rule.techs);
    expect(queueFormation(w, GER, HEAVY)).not.toBe(0);
    expect(nc.gold[GER]).toBeCloseTo(1e6 - rule.gold, 6);
    expect(nc.manpower[GER]).toBeCloseTo(1e7 - rule.manpower, 6);
    // It arrives after its days, at full strength, heavy tanks among its elements, and is paid for monthly.
    const before = new Set(w.formations.ids());
    sim.step(rule.days * 24); // the ticks 0 to days × 24 − 1: it is ready at 00:00 of the day after
    expect(w.formations.ids().filter((f) => !before.has(f))).toEqual([]);
    sim.step(1);
    twin.step(rule.days * 24 + 1);
    const made = w.formations.ids().filter((f) => !before.has(f));
    expect(made).toHaveLength(1);
    const f = made[0]!;
    expect(w.formations.cols.template[f]).toBe(HEAVY);
    expect(w.formations.cols.strength[f]).toBe(ECONOMY_TABLES_1938.templateStrength[HEAVY]);
    const heavies = (elementIndex(w).get(f) ?? []).filter((e) => UNIT_IDS_1938[w.elements.cols.unit[e]!] === 'tank_heavy');
    expect(heavies).toHaveLength(TEMPLATES_LAND[HEAVY]!.elements.find((e) => e.type === 'tank_heavy')!.count);
    // The twin, which ordered nothing, is richer by the order, and after the first of the next
    // month (day 330 is 27 November) by a month of its upkeep.
    expect(twin.world.nations.cols.gold[GER]! - nc.gold[GER]!).toBeCloseTo(rule.gold, 4);
    sim.step(5 * 24);
    twin.step(5 * 24);
    const upkeep = UPKEEP_SCALE * ECONOMY_TABLES_1938.templateUpkeep[HEAVY]!;
    expect(upkeep).toBeGreaterThan(0);
    expect(twin.world.nations.cols.gold[GER]! - nc.gold[GER]!).toBeCloseTo(rule.gold + upkeep, 4);
  });

  it('the armour order of the economic AI is the best armoured division it knows and can pay for', () => {
    expect(BUILD_MIX_1938.armour).toEqual([MBT, HEAVY, PANZER_2, PANZER]);
    const order = (grant: number[], gold?: (income: number) => number): number | undefined => {
      const sim = sim1938();
      const w = sim.world;
      const nc = w.nations.cols;
      const GER = id('GER');
      w.settings.aiEnabled = true;
      w.nations.forEach((n) => (nc.aiOff[n] = n === GER ? 0 : 1));
      for (const f of w.formations.ids()) if (w.formations.cols.nation[f] === GER) destroyFormation(w, f);
      nc.manpower[GER] = 1e7;
      nc.builds[GER] = 2; // a rich nation at war: its third order is armour
      w.wars.set(GER, id('LUX'), true);
      for (const t of grant) grantTechs(w, GER, RULES_1938.templates[t]!.techs);
      nc.gold[GER] = gold ? gold(Math.max(0, monthlyAccounts(w, ECONOMY_TABLES_1938).gross[GER]!)) : 1e7;
      economicAi(ECONOMY_TABLES_1938, BUILD_MIX_1938)(w);
      return w.production.ids().map((r) => w.production.cols.template[r]!)[0];
    };
    // 1938: Germany knows the medium tank and nothing after it.
    expect(knowsTechs(sim1938().world, id('GER'), RULES_1938.templates[PANZER]!.techs)).toBe(true);
    expect(order([])).toBe(PANZER);
    expect(order([PANZER_2])).toBe(PANZER_2);
    expect(order([PANZER_2, HEAVY])).toBe(HEAVY);
    expect(order([HEAVY])).toBe(HEAVY);
    expect(order([MBT])).toBe(MBT);
    // The mechanised division is not armour: knowing it changes nothing.
    expect(order([MECH])).toBe(PANZER);
    // Short of the price of the best with its reserve, it orders the best it has the gold for,
    // not infantry.
    const price = (t: number): number => RULES_1938.templates[t]!.gold;
    expect(price(HEAVY)).toBeGreaterThan(price(PANZER_2));
    expect(order([PANZER_2, HEAVY], (income) => price(PANZER_2) + RESERVE_MONTHS * income + 1)).toBe(PANZER_2);
    expect(order([PANZER_2, HEAVY], (income) => price(PANZER) + RESERVE_MONTHS * income + 1)).toBe(PANZER);
    expect(order([PANZER_2, HEAVY], (income) => price(BUILD_MIX_1938.infantry) + RESERVE_MONTHS * income + 1)).toBe(BUILD_MIX_1938.infantry);
  });
});
