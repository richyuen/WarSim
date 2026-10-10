import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { maskLand } from '../../src/shared/landMask';
import { isLand, Terrain } from '../../src/shared/terrain';
import { placeFleets, type FleetGroup } from '../../src/sim/data/fleets';
import { validateDataSet } from '../../src/sim/data/schemas';
import { ECONOMY_TABLES_1938, FLEETS_1938, PORTS_1938, RULES_1938, SIZE_1938, START_ARMY_MONTHS, START_GOLD_MONTHS, TAGS_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { budgetOf } from '../../src/sim/ai/economic';
import { Sim } from '../../src/sim/sim';
import { STAT_FIELDS, STAT_STRIDE, statsSystem } from '../../src/sim/stats';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { elementIndex } from '../../src/sim/systems/elements';
import { knowsTechs } from '../../src/sim/tech';
import { Domain, laneOf, seaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { fleetsStand } from '../helpers/fleetsStand';
import { addDivision, nationId, runEvents } from '../helpers/sim1938';

// PLAN 4.2b: fleets in the 1938 order of battle, standing at their ports' water. AT: every
// rule that reads a formation leaves a fleet alone or is said to read it (the ten years are
// `tests/sweep/aiSweep*.test.ts`, with `fleetsStand` asked every day).

const { w: W, h: H } = SIZE_1938;
const sim = (seed = 1938): Sim => new Sim({ scenario: '1938', seed, assets: assets1938(W) });

function readTree(dir: string, base = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) Object.assign(out, readTree(path.join(dir, e.name), rel));
    else if (e.name.endsWith('.json')) out[rel] = JSON.parse(fs.readFileSync(path.join(dir, e.name), 'utf8'));
  }
  return out;
}

describe('placeFleets', () => {
  // 6 × 3: a sea of the two upper rows' first four cells, a lake of one cell, land elsewhere.
  //   ~ ~ ~ ~ # o
  //   ~ ~ ~ ~ # #
  //   # # # # # #
  const w = 6;
  const h = 3;
  const terrain = Uint8Array.from([0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2].map((t) => (t === 0 ? Terrain.Water : Terrain.Plains)));
  const tags = ['AAA', 'BBB'];
  const group = (nation: string, count: number, port: string): FleetGroup => ({ nation, template: 'destroyer_flotilla', count, port });
  const waterOf = new Map([['Base', 7], ['Lake', 5], ['Dry', 4], ['None', -1]]);

  it('the first of a group in its base’s water, the others in the water about it, no cell twice', () => {
    const r = placeFleets({ w, h, terrain, wrapX: false, tags, groups: [group('AAA', 3, 'Base'), group('BBB', 2, 'Base')], waterOf });
    expect(r.unplaced).toEqual([]);
    expect(r.fleets.map((f) => [f.nation, f.cell, f.group])).toEqual([[1, 7, 0], [1, 1, 0], [1, 6, 0], [2, 8, 1], [2, 0, 1]]);
    expect(new Set(r.fleets.map((f) => f.cell)).size).toBe(5);
    for (const f of r.fleets) expect(isLand(terrain[f.cell]!)).toBe(false);
  });

  it('a cell no fleet can stand in is passed over, and the flood goes on through it', () => {
    const r = placeFleets({ w, h, terrain, wrapX: false, tags, groups: [group('AAA', 2, 'Base')], waterOf, stands: (c) => c !== 7 && c !== 1 });
    expect(r.fleets.map((f) => f.cell)).toEqual([6, 8]);
  });

  it('water too small for the group, a base on land, a base with no water and an unknown nation: not placed', () => {
    const r = placeFleets({ w, h, terrain, wrapX: false, tags, groups: [group('AAA', 2, 'Lake'), group('AAA', 1, 'Dry'), group('AAA', 1, 'None'), group('AAA', 1, 'Nowhere'), group('CCC', 1, 'Base')], waterOf });
    expect(r.unplaced).toEqual([0, 1, 2, 3, 4]);
    expect(r.fleets.map((f) => f.cell)).toEqual([5]); // the lake's one cell took one
  });

  it('on a map that loops the flood goes over the seam', () => {
    const sea = new Uint8Array(w * h).fill(Terrain.Plains);
    sea[0] = sea[5] = Terrain.Water;
    const at = new Map([['Base', 0]]);
    expect(placeFleets({ w, h, terrain: sea, wrapX: true, tags, groups: [group('AAA', 2, 'Base')], waterOf: at }).fleets.map((f) => f.cell)).toEqual([0, 5]);
    expect(placeFleets({ w, h, terrain: sea, wrapX: false, tags, groups: [group('AAA', 2, 'Base')], waterOf: at }).unplaced).toEqual([0]);
  });
});

describe('the fleets of the 1938 start (PLAN 4.2b)', () => {
  it('every group’s fleets stand on water of the grid and of the fine mask, about their base, one to a cell, after the land’s formations', () => {
    const w = sim().world;
    const fc = w.formations.cols;
    const idx = elementIndex(w);
    const zones = seaOf(w);
    const lanes = laneOf(w);
    const want = FLEETS_1938.reduce((s, g) => s + g.count, 0);
    expect(want).toBe(197);
    const land = w.formations.count - want;
    const fleets: number[] = [];
    w.formations.forEach((id) => {
      if (w.afloat(id)) fleets.push(id);
      // The land's formations keep their ids: the fleets are the rows after them.
      expect(w.afloat(id), `formation ${id}`).toBe(id > land);
    });
    expect(fleets).toHaveLength(want);
    // In the file's order: the groups, each `count` times.
    const groups = FLEETS_1938.flatMap((g) => Array.from({ length: g.count }, () => g));
    const cells = new Set<number>();
    const baseCell = new Map<string, number>();
    w.ports.forEach((p, i) => {
      if (p.def >= 0 && lanes.portNode[i]! >= 0) baseCell.set(PORTS_1938.ports[p.def]!.name, lanes.cell[lanes.portNode[i]!]!);
    });
    const taken = new Set<string>();
    let ships = 0;
    let furthest = 0;
    fleets.forEach((id, k) => {
      const g = groups[k]!;
      const what = `${g.nation} ${g.template} at ${g.port} (formation ${id})`;
      const rule = RULES_1938.templates[fc.template[id]!]!;
      expect(TEMPLATES_1938[fc.template[id]!]!.id, what).toBe(g.template);
      expect(rule.domain, what).toBe(Domain.sea);
      expect(TAGS_1938[fc.nation[id]! - 1], what).toBe(g.nation);
      const cell = Math.floor(fc.y[id]!) * W + Math.floor(fc.x[id]!);
      expect(isLand(w.cells.terrain[cell]!), what).toBe(false);
      expect(maskLand(w.landMask!, W, H, fc.x[id]!, fc.y[id]!, w.settings.loopingMap), what).toBe(false);
      expect(zones.zoneOf[cell], `${what}: its water's zone`).toBeGreaterThan(0);
      expect(cells.has(cell), `${what}: a second fleet in cell ${cell}`).toBe(false);
      cells.add(cell);
      // About its base: the base's own water for the first there, and near it for the others.
      const base = baseCell.get(g.port)!;
      if (cell === base) taken.add(g.port);
      const dx = Math.abs((cell % W) - (base % W));
      furthest = Math.max(furthest, Math.min(dx, W - dx), Math.abs(Math.floor(cell / W) - Math.floor(base / W)));
      // Whole, in supply, its strength its crews; the ships of its template, one to an element.
      const els = idx.get(id)!;
      expect(els, what).toHaveLength(rule.elements.reduce((s, e) => s + e.count, 0));
      for (const e of els) expect(w.elements.cols.strength[e], what).toBe(1);
      expect(fc.strength[id], what).toBe(rule.manpower);
      expect([fc.supply[id], fc.org[id], fc.engaged[id], fc.moving[id]], what).toEqual([1, 1, 0, 0]);
      // Its nation knows what its ships need, and holds the base or is the overlord of who does.
      expect(knowsTechs(w, fc.nation[id]!, rule.techs), `${what}: the techs of its ships`).toBe(true);
      const port = w.ports.find((p) => p.def >= 0 && PORTS_1938.ports[p.def]!.name === g.port)!;
      const holder = w.cells.owner[port.cell]!;
      expect(holder === fc.nation[id] || w.nations.cols.overlord[holder] === fc.nation[id], `${what}: the base is held by ${TAGS_1938[holder - 1]}`).toBe(true);
      ships += els.length;
    });
    expect([...taken].sort()).toEqual([...new Set(FLEETS_1938.map((g) => g.port))].sort());
    expect(furthest).toBeLessThanOrEqual(3);
    expect(ships).toBe(1786);
    process.stderr.write(`fleets of the 1938 start: ${fleets.length} in ${FLEETS_1938.length} groups at ${taken.size} bases, ${ships} ships, the furthest ${furthest} cells from its base's water\n`);
  });

  it('a navy is paid from the first month, and the treasury of the start counts it', () => {
    const w = sim().world;
    const fc = w.formations.cols;
    const acc = monthlyAccounts(w, ECONOMY_TABLES_1938);
    const navy = new Float64Array(w.nations.highWater);
    w.formations.forEach((id) => {
      if (w.afloat(id)) navy[fc.nation[id]!]! += UPKEEP_SCALE * ECONOMY_TABLES_1938.templateUpkeep[fc.template[id]!]!;
    });
    const eng = nationId('ENG');
    const sov = nationId('SOV');
    expect(navy[eng]!).toBeCloseTo(258.65, 2);
    // What the nation pays is its army's upkeep and its navy's.
    let army = 0;
    w.formations.forEach((id) => {
      if (fc.nation[id] === eng && !w.afloat(id)) army += UPKEEP_SCALE * ECONOMY_TABLES_1938.templateUpkeep[fc.template[id]!]!;
    });
    expect(acc.upkeep[eng]!).toBeCloseTo(army + navy[eng]!, 6);
    // No navy takes more than a quarter of its nation's income.
    w.nations.forEach((n) => expect(navy[n]! / Math.max(1, acc.gross[n]!), TAGS_1938[n - 1]).toBeLessThan(0.25));
    // The Soviet Union is short each month with its army alone, more with its fleets: it begins with a year of that.
    const { balance, need } = budgetOf(w, sov, acc);
    expect(need - balance).toBeGreaterThan(navy[sov]!);
    expect(w.nations.cols.gold[sov]).toBe(Math.max(START_GOLD_MONTHS * acc.gross[sov]!, START_ARMY_MONTHS * (need - balance)));
    // The men of the statistics are the army's: no fleet's crews among them.
    let men = 0;
    let crews = 0;
    w.formations.forEach((id) => {
      if (fc.nation[id] !== eng) return;
      if (w.afloat(id)) crews += fc.strength[id]!;
      else men += fc.strength[id]!;
    });
    expect(crews).toBeGreaterThan(100_000);
    statsSystem(w);
    const rows = w.stats.rows;
    let row = -1;
    for (let i = 0; i < rows.length; i += STAT_STRIDE) if (rows[i + 1] === eng) row = i;
    expect(rows[row + STAT_FIELDS.indexOf('men')]).toBe(men);
  });

  it('60 days: no rule of the land touches a fleet; an order to march is rejected; a bankrupt nation’s army deserts and is sent home, its fleets stand', () => {
    const s = sim(99);
    const w = s.world;
    const fc = w.formations.cols;
    const fleets = fleetsStand(w);
    expect(fleets.start).toBe(197);
    // A Chinese division on the shore beside a Japanese fleet (the two are at war from the start): no contact.
    const jap = nationId('JAP');
    const chi = nationId('CHI');
    expect(w.wars.atWar(jap, chi)).toBe(true);
    let fleet = 0;
    let shore = -1;
    w.formations.forEach((id) => {
      if (fleet !== 0 || !w.afloat(id) || fc.nation[id] !== jap) return;
      const cell = Math.floor(fc.y[id]!) * W + Math.floor(fc.x[id]!);
      for (const n of [cell - 1, cell + 1, cell - W, cell + W]) {
        if (isLand(w.cells.terrain[n]!)) {
          fleet = id;
          shore = n;
        }
      }
    });
    expect(fleet).toBeGreaterThan(0);
    const [sx, sy] = w.cellPoint(shore);
    const division = addDivision(w, chi, sx, sy);
    // The United Kingdom has no money: bankrupt at the first month's start.
    const eng = nationId('ENG');
    w.nations.cols.gold[eng] = -1e9;
    const men = (): number => {
      let m = 0;
      w.formations.forEach((id) => void (fc.nation[id] === eng && !w.afloat(id) && (m += fc.strength[id]!)));
      return m;
    };
    const before = men();
    let own = 0;
    w.formations.forEach((id) => void (fc.nation[id] === eng && w.afloat(id) && own++));
    expect(own).toBe(36);
    // An order to land that is no port (Moscow): a fleet sails, and to water or a port only
    // (PLAN 4.2c; the shore beside it may be its base's cell, and an order there is one to
    // the water it stands in). A flotilla put on land by hand (no command does it) has no
    // water to sail from, and does not march.
    const sov = nationId('SOV');
    const [mx, my] = [w.nations.cols.capitalX[sov]!, w.nations.cols.capitalY[sov]!];
    expect(w.ports.some((p) => p.cell === Math.floor(my) * W + Math.floor(mx))).toBe(false);
    s.command({ kind: 'moveFormation', id: fleet, x: mx, y: my });
    const ashore = addDivision(w, sov, mx, my, TEMPLATES_1938.findIndex((t) => t.id === 'destroyer_flotilla'));
    s.command({ kind: 'moveFormation', id: ashore, x: mx + 3, y: my });
    const rejected: number[] = [];
    let disbanded = 0;
    let bankrupt = 0;
    let engagedHours = 0;
    for (let day = 0; day < 60; day++) {
      for (const e of runEvents(s, 24)) {
        if (e[1] === EventKind.MoveRejected) rejected.push(e[2]!);
        if (e[1] === EventKind.FormationsDisbanded && e[2] === eng) disbanded += e[3]!;
        if (e[1] === EventKind.Bankruptcy && e[2] === eng && e[3] === 1) bankrupt++;
      }
      if (w.formations.has(division) && fc.engaged[division] === 1) engagedHours++;
      expect(fleets.day(w), `day ${day + 1}`).toEqual([]);
    }
    expect(rejected).toContain(fleet);
    expect(rejected).toContain(ashore);
    expect([fc.x[ashore], fc.y[ashore], fc.moving[ashore]]).toEqual([mx, my, 0]);
    expect(engagedHours).toBe(0);
    expect(bankrupt).toBe(1);
    expect(disbanded).toBeGreaterThan(0);
    expect(men()).toBeLessThan(before);
    expect(fleets.gone).toBe(0);
    let left = 0;
    w.formations.forEach((id) => void (fc.nation[id] === eng && w.afloat(id) && left++));
    expect(left).toBe(36);
  });

  it('the data set refuses a land template among the fleets, a port that is none, no naval base or another nation’s', () => {
    const data = readTree(path.resolve(import.meta.dirname, '../../data'));
    expect(validateDataSet(data)).toEqual([]);
    const f = 'scenarios/1938/fleets.json';
    const withGroup = (g: Partial<FleetGroup>): string[] => {
      const fleets = structuredClone(data[f]) as { groups: FleetGroup[] };
      Object.assign(fleets.groups[0]!, g);
      return validateDataSet({ ...data, [f]: fleets });
    };
    expect(withGroup({ template: 'infantry_div' })).toEqual([`${f}: groups[0].template: 'infantry_div' is no sea template: the groups of this file are placed on water`]);
    expect(withGroup({ port: 'Atlantis' })).toEqual([`${f}: groups[0].port: no port 'Atlantis' in scenarios/1938/ports.json`]);
    expect(withGroup({ port: 'London' })).toEqual([`${f}: groups[0].port: 'London' is no naval base`]);
    expect(withGroup({ port: 'Kiel' })).toEqual([`${f}: groups[0].port: 'Kiel' is held by 'GER', neither 'ENG' nor a puppet of it`]);
    expect(withGroup({ nation: 'XXX' })).toHaveLength(2);
    // A puppet's base will do for its overlord, and not the overlord's for the puppet.
    expect(withGroup({ port: 'Singapore' })).toEqual([]);
    expect(withGroup({ nation: 'MAL', port: 'Scapa Flow' })).toEqual([`${f}: groups[0].port: 'Scapa Flow' is held by 'ENG', neither 'MAL' nor a puppet of it`]);
  });
});
