import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import unitsLand from '../../data/units/land.json';
import unitsSea from '../../data/units/sea.json';
import en from '../../src/ui/i18n/en.json';
import { Refusal, type Command } from '../../src/shared/commands';
import { EventKind } from '../../src/shared/events';
import { validateDataSet } from '../../src/sim/data/schemas';
import { ECONOMY_TABLES_1938, NATIONS_1938, RULES_1938, SIZE_1938, TEMPLATES_1938, TEMPLATES_LAND, TEMPLATES_SEA, UNIT_IDS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { PRODUCTION_COST_SCALE, queueFormation, SHIP_TIME_SCALE } from '../../src/sim/systems/production';
import { Domain } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { runEvents } from '../helpers/sim1938';

// PLAN 4.2a: the ship types and the fleet templates in the scenario's rules. AT: the land
// templates and units keep their indices; a sea template holds sea units only; an order to
// build one and a spawn of one are refused.

const SEA = ['battle_squadron', 'carrier_group', 'cruiser_squadron', 'destroyer_flotilla', 'submarine_flotilla', 'transport_group'];
const SHIPS = ['destroyer', 'cruiser_light', 'cruiser_heavy', 'battleship', 'carrier', 'submarine', 'transport'];
const template = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);
const GBR = NATIONS_1938.findIndex((n) => n.tag === 'ENG') + 1;

function readTree(dir: string, base = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) Object.assign(out, readTree(path.join(dir, e.name), rel));
    else if (e.name.endsWith('.json')) out[rel] = JSON.parse(fs.readFileSync(path.join(dir, e.name), 'utf8'));
  }
  return out;
}

describe('ship types and fleet templates in the rules (PLAN 4.2a)', () => {
  it("the land templates and units keep their indices: the sea's stand after them", () => {
    // A formation and an order are saved with their template's index, an element with its unit's.
    expect(TEMPLATES_1938.slice(0, TEMPLATES_LAND.length)).toEqual(TEMPLATES_LAND);
    expect(TEMPLATES_1938.slice(TEMPLATES_LAND.length).map((t) => t.id)).toEqual(SEA);
    expect(TEMPLATES_SEA.map((t) => t.id)).toEqual(SEA);
    expect(RULES_1938.templates).toHaveLength(TEMPLATES_1938.length);
    expect(UNIT_IDS_1938.slice(0, unitsLand.types.length)).toEqual(unitsLand.types.map((u) => u.id));
    expect(UNIT_IDS_1938.slice(unitsLand.types.length)).toEqual(SHIPS);
    expect(RULES_1938.units).toHaveLength(UNIT_IDS_1938.length);
    for (const t of SEA) expect((en as Record<string, string>)[`template.${t}`], t).toMatch(/\S/);
  });

  it('a template is of one domain: a land template has no ship, a fleet nothing else', () => {
    const sea = new Set(SHIPS);
    RULES_1938.templates.forEach((rule, i) => {
      const id = TEMPLATES_1938[i]!.id;
      const ships = rule.elements.filter((e) => sea.has(UNIT_IDS_1938[e.unit]!)).length;
      expect(rule.domain, id).toBe(i < TEMPLATES_LAND.length ? Domain.land : Domain.sea);
      expect(ships, id).toBe(rule.domain === Domain.sea ? rule.elements.length : 0);
    });
    // Each of the seven ship types is in a template, one ship to an element.
    const used = new Set(TEMPLATES_SEA.flatMap((t) => t.elements.map((e) => e.type)));
    expect([...used].sort()).toEqual([...SHIPS].sort());
    for (const u of RULES_1938.units.slice(unitsLand.types.length)) expect(u.size).toBe(1);
  });

  it('a fleet has the pace of its slowest ship, and the cost, days, crew and upkeep of its ships', () => {
    const units = new Map(unitsSea.types.map((u) => [u.id, u]));
    for (const t of TEMPLATES_SEA) {
      const i = template(t.id);
      const rule = RULES_1938.templates[i]!;
      const sum = (of: (u: (typeof unitsSea.types)[number]) => number): number => t.elements.reduce((s, e) => s + of(units.get(e.type)!) * e.count, 0);
      expect(rule.speedKmh, t.id).toBe(Math.min(...t.elements.map((e) => units.get(e.type)!.stats.speed_kmh)));
      expect(rule.gold, t.id).toBeCloseTo(PRODUCTION_COST_SCALE * sum((u) => u.cost.gold), 9);
      expect(rule.manpower, t.id).toBe(sum((u) => u.cost.manpower));
      // Its slowest ship's own days since PLAN 4.2e (ADR-252); by the land's scale, 3 ×, before.
      expect(rule.days, t.id).toBe(SHIP_TIME_SCALE * Math.max(...t.elements.map((e) => units.get(e.type)!.cost.days)));
      expect(rule.fuel, t.id).toBeCloseTo(sum((u) => u.stats.fuelPerHour), 9);
      expect(ECONOMY_TABLES_1938.templateUpkeep[i], t.id).toBeCloseTo(sum((u) => u.upkeep.gold), 9);
      expect(ECONOMY_TABLES_1938.templateStrength[i], t.id).toBe(sum((u) => u.cost.manpower));
      expect(ECONOMY_TABLES_1938.templateArmour[i], t.id).toBe(0);
    }
    // The battle line at the battleship's 50 km/h, the flotilla at the destroyer's 65.
    expect(RULES_1938.templates[template('battle_squadron')]!.speedKmh).toBe(50);
    expect(RULES_1938.templates[template('destroyer_flotilla')]!.speedKmh).toBe(65);
    expect(RULES_1938.templates[template('transport_group')]!.speedKmh).toBe(30);
  });

  it('a fleet is not spawned (on land), and is built only by a nation with a port (PLAN 4.2e)', () => {
    const s = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
    const w = s.world;
    w.settings.aiEnabled = false;
    const nc = w.nations.cols;
    expect(GBR).toBeGreaterThan(0);
    nc.gold[GBR] = 1e7;
    nc.manpower[GBR] = 1e7;
    const formations = w.formations.count;
    const elements = w.elements.count;
    // Switzerland has no port a ship reaches: refused. (Until PLAN 4.2e every nation was.)
    const SWI = NATIONS_1938.findIndex((n) => n.tag === 'SWI') + 1;
    nc.gold[SWI] = 1e7;
    nc.manpower[SWI] = 1e7;
    for (const t of SEA) {
      w.out.events.length = 0;
      expect(queueFormation(w, SWI, template(t)), t).toBe(0);
      expect(w.out.events.filter((v, i) => i % 6 === 1 && v === EventKind.ProductionRejected), t).toHaveLength(1);
    }
    expect(nc.gold[SWI]).toBe(1e7);
    expect(w.production.count).toBe(0);
    // A land template is built as before.
    expect(queueFormation(w, GBR, template('infantry_div'))).toBeGreaterThan(0);
    // The spawn, at London: refused, and nothing made.
    const send = (cmd: Command): { applied: number; refused: number[] } => {
      s.command(cmd);
      const ev = runEvents(s, 1);
      return { applied: ev.filter((e) => e[1] === EventKind.CommandApplied).length, refused: ev.filter((e) => e[1] === EventKind.CommandRefused).map((e) => e[3]!) };
    };
    const [x, y] = [nc.capitalX[GBR]!, nc.capitalY[GBR]!];
    for (const t of SEA) expect(send({ kind: 'spawnFormation', nation: GBR, x, y, strength: 0, template: template(t) }), t).toEqual({ applied: 0, refused: [Refusal.NotOfLand] });
    expect(w.formations.count).toBe(formations);
    expect(w.elements.count).toBe(elements);
    expect(send({ kind: 'spawnFormation', nation: GBR, x, y, strength: 0, template: template('infantry_div') })).toEqual({ applied: 1, refused: [] });
    expect(w.formations.count).toBe(formations + 1);
  });

  it('the data set refuses a template of two domains, and a fleet in the land order of battle', () => {
    const data = readTree(path.resolve(import.meta.dirname, '../../data'));
    expect(validateDataSet(data)).toEqual([]);
    const mixed = structuredClone(data['templates/sea.json']) as { templates: { elements: { type: string; count: number }[] }[] };
    mixed.templates[5]!.elements.push({ type: 'infantry', count: 4 });
    expect(validateDataSet({ ...data, 'templates/sea.json': mixed })).toEqual(["templates/sea.json: templates[5].elements[1].type: 'infantry' is a land unit in a sea template"]);
    const oob = structuredClone(data['scenarios/1938/oob.json']) as { groups: { template: string }[] };
    oob.groups[3]!.template = 'destroyer_flotilla';
    expect(validateDataSet({ ...data, 'scenarios/1938/oob.json': oob })).toEqual(["scenarios/1938/oob.json: groups[3].template: 'destroyer_flotilla' is no land template: the groups of this file are placed on land"]);
  });
});
