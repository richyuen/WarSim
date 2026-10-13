import { describe, expect, it } from 'vitest';
import unitsAir from '../../data/units/air.json';
import unitsLand from '../../data/units/land.json';
import unitsSea from '../../data/units/sea.json';
import en from '../../src/ui/i18n/en.json';
import { Refusal, type Command } from '../../src/shared/commands';
import { EventKind } from '../../src/shared/events';
import { NATIONS_1938, RULES_1938, SIZE_1938, TEMPLATES_1938, TEMPLATES_AIR, TEMPLATES_LAND, TEMPLATES_SEA, UNIT_IDS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { queueFormation } from '../../src/sim/systems/production';
import { Domain } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { runEvents } from '../helpers/sim1938';

// PLAN 5.1b: the aircraft types and six air wing templates in the scenario's rules, after the
// sea's. A wing is a formation of an air template; none exists yet: an order to build one and a
// spawn of one are refused, as a fleet's were before PLAN 4.2b.

const AIR = ['fighter_group', 'tactical_bomber_group', 'strategic_bomber_group', 'close_support_group', 'naval_bomber_group', 'air_transport_group'];
const template = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);

describe('air wing templates in the rules (PLAN 5.1b)', () => {
  it('the land\'s and the sea\'s templates and units keep their indices: the air\'s stand after them', () => {
    const before = TEMPLATES_LAND.length + TEMPLATES_SEA.length;
    expect(TEMPLATES_1938.slice(0, before).map((t) => t.id)).toEqual([...TEMPLATES_LAND, ...TEMPLATES_SEA].map((t) => t.id));
    expect(TEMPLATES_1938.slice(before).map((t) => t.id)).toEqual(AIR);
    expect(TEMPLATES_AIR.map((t) => t.id)).toEqual(AIR);
    const units = unitsLand.types.length + unitsSea.types.length;
    expect(UNIT_IDS_1938.slice(0, units)).toEqual([...unitsLand.types, ...unitsSea.types].map((u) => u.id));
    expect(UNIT_IDS_1938.slice(units)).toEqual(unitsAir.types.map((u) => u.id));
    expect(RULES_1938.units).toHaveLength(UNIT_IDS_1938.length);
    expect(RULES_1938.templates).toHaveLength(TEMPLATES_1938.length);
    for (const t of AIR) expect((en as Record<string, string>)[`template.${t}`], t).toMatch(/\S/);
  });

  it('an air template is of aircraft alone, each wing type in one, and its range the least of its aircraft\'s', () => {
    for (const t of AIR) {
      const rule = RULES_1938.templates[template(t)]!;
      expect(rule.domain, t).toBe(Domain.air);
      for (const e of rule.elements) expect(RULES_1938.units[e.unit]!.domain, t).toBe(Domain.air);
    }
    const classes = new Set(TEMPLATES_AIR.flatMap((t) => t.elements.map((e) => unitsAir.types.find((u) => u.id === e.type)!.class)));
    expect([...classes].sort()).toEqual(['bomber_str', 'bomber_tac', 'cas', 'fighter', 'naval_bomber', 'transport_air']);
    // A fighter group reaches 800 km, a strategic bomber group 3,000 (the units' data).
    const range = (t: string): number => Math.min(...RULES_1938.templates[template(t)]!.elements.map((e) => RULES_1938.units[e.unit]!.rangeKm));
    expect(range('fighter_group')).toBe(800);
    expect(range('strategic_bomber_group')).toBe(3000);
  });

  it('no wing is built or spawned yet: the order and the spawn are refused, nothing is made', () => {
    const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
    const w = s.world;
    w.settings.aiEnabled = false;
    const ger = NATIONS_1938.findIndex((n) => n.tag === 'GER') + 1;
    w.nations.cols.gold[ger] = 1e7;
    w.nations.cols.manpower[ger] = 1e7;
    for (const t of AIR) {
      w.out.events.length = 0;
      expect(queueFormation(w, ger, template(t)), t).toBe(0);
      expect(w.out.events.filter((v, i) => i % 6 === 1 && v === EventKind.ProductionRejected), t).toHaveLength(1);
    }
    expect(w.production.count).toBe(0);
    const formations = w.formations.count;
    const send = (cmd: Command): number[] => {
      s.command(cmd);
      return runEvents(s, 1).filter((e) => e[1] === EventKind.CommandRefused).map((e) => e[3]!);
    };
    const [x, y] = [w.nations.cols.capitalX[ger]!, w.nations.cols.capitalY[ger]!];
    for (const t of AIR) expect(send({ kind: 'spawnFormation', nation: ger, x, y, strength: 0, template: template(t) }), t).toEqual([Refusal.NotOfLand]);
    expect(w.formations.count).toBe(formations);
  });
});
