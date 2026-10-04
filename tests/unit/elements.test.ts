import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { EventKind } from '../../src/shared/events';
import { SLOT_SPACING, slotPose } from '../../src/sim/core/pose';
import { applyLoss, destroyFormation, elementIndex, settleFormation } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, INF_DIV, nationId } from '../helpers/sim1938';

// Review pass after PLAN 1.10–1.14: invariants of the element table (SPEC §3.6): a formation's
// strength is always the sum of its elements; no element outlives its formation; the derived
// element index matches the table after any mix of battle, attrition, removal and load.

const W = SIZE_1938.w;

function checkInvariants(w: World): void {
  const units = w.rules!.units;
  const ec = w.elements.cols;
  const fresh = new Map<number, number[]>();
  w.elements.forEach((e) => {
    expect(w.formations.has(ec.formation[e]!)).toBe(true); // no orphans
    expect(ec.strength[e]!).toBeGreaterThan(0); // dead elements are removed
    const list = fresh.get(ec.formation[e]!) ?? [];
    list.push(e);
    fresh.set(ec.formation[e]!, list);
  });
  const idx = elementIndex(w);
  for (const [f, list] of fresh) {
    expect(idx.get(f)).toEqual(list);
    const men = Math.round(list.reduce((s, e) => s + ec.strength[e]! * units[ec.unit[e]!]!.menPerUnit, 0));
    expect(w.formations.cols.strength[f]).toBe(men);
  }
}

describe('element invariants (review after PLAN 1.14)', () => {
  it('hold through battle, encirclement attrition, removal and save/load', () => {
    const s = new Sim({ scenario: '1938', seed: 21, assets: assets1938(W) });
    const w = s.world;
    checkInvariants(w); // the 1938 start
    const [x, y] = cellOf(30.0, 50.0, W, H());
    const GER = nationId('GER');
    const POL = nationId('POL');
    w.wars.set(GER, POL, true);
    const a = addDivision(w, GER, Math.floor(x) + 0.5, Math.floor(y) + 0.5);
    addDivision(w, POL, Math.floor(x) + 1.5, Math.floor(y) + 0.5);
    addDivision(w, POL, Math.floor(x) + 1.5, Math.floor(y) + 1.2);
    s.step(24 * 3); // fighting, out of supply far from home
    checkInvariants(w);
    s.command({ kind: 'removeFormation', id: a });
    s.step(1);
    expect(elementIndex(w).has(a)).toBe(false);
    checkInvariants(w);
    const t = new Sim({ scenario: '1938', seed: 3, assets: assets1938(W) });
    t.step(1);
    t.load(s.save());
    checkInvariants(t.world);
    t.step(24);
    checkInvariants(t.world);
    expect(t.hash()).toBe((s.step(24), s.hash()));
  });

  it('destroying a formation removes its elements and emits one FormationDestroyed', () => {
    const s = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    const w = s.world;
    const before = w.elements.count;
    const id = w.formations.ids()[0]!;
    const n = elementIndex(w).get(id)!.length;
    w.out.events.length = 0;
    destroyFormation(w, id);
    expect(w.elements.count).toBe(before - n);
    expect(w.out.events.length).toBe(6);
    checkInvariants(w);
  });

  it('spawnFormation with a template places a formation with its elements; without one, a bare formation (PLAN 2.5)', () => {
    const s = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    const w = s.world;
    const fc = w.formations.cols;
    const [x, y] = cellOf(100, 38, W, H());
    const before = new Set(w.formations.ids());
    const CHI = nationId('CHI');
    s.command({ kind: 'setAi', nation: CHI, enabled: false });
    s.command({ kind: 'spawnFormation', nation: CHI, x, y, strength: 777, template: INF_DIV });
    s.command({ kind: 'spawnFormation', nation: CHI, x: x + 3, y, strength: 777 });
    s.command({ kind: 'spawnFormation', nation: CHI, x: x + 6, y, strength: 777, template: 9999 });
    s.step(1);
    const [equipped, bare, unknown] = w.formations.ids().filter((f) => !before.has(f) && fc.nation[f] === CHI && Math.abs(fc.y[f]! - y) < 0.01);
    // With its elements, as production delivers one: the strength is theirs, not the command's.
    const rule = w.rules!.templates[INF_DIV]!;
    const els = elementIndex(w).get(equipped!)!;
    expect(els).toHaveLength(rule.elements.reduce((n, e) => n + e.count, 0));
    expect(fc.template[equipped!]).toBe(INF_DIV);
    const men = Math.round(els.reduce((m, e) => m + w.elements.cols.strength[e]! * w.rules!.units[w.elements.cols.unit[e]!]!.menPerUnit, 0));
    expect(fc.strength[equipped!]).toBe(men);
    expect(men).toBeGreaterThan(10_000);
    // Without a template, or with one the scenario does not have: as before, no elements.
    for (const f of [bare!, unknown!]) {
      expect(elementIndex(w).has(f)).toBe(false);
      expect(fc.strength[f]).toBe(777);
    }
    checkInvariants(w);
    // A scenario without unit rules ignores the template.
    const toy = new Sim({ scenario: 'toy', seed: 1 });
    const had = toy.world.formations.count;
    toy.command({ kind: 'spawnFormation', nation: 1, x: 50.5, y: 50.5, strength: 900, template: 0 });
    toy.step(1);
    expect(toy.world.formations.count).toBe(had + 1);
    expect(toy.world.elements.count).toBe(0);
  });

  it('an element whose strength reaches 0 emits ElementDestroyed at the slot it stood in (PLAN 2.4b)', () => {
    const s = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    const w = s.world;
    const fc = w.formations.cols;
    const ec = w.elements.cols;
    const id = w.formations.ids()[0]!;
    const list = [...elementIndex(w).get(id)!];
    expect(list.length).toBeGreaterThan(6);
    // Two of its elements die in the same hour: both stood in the block as it was before.
    const dying = [list[1]!, list[4]!];
    const expected = dying.flatMap((e) => [w.tick, EventKind.ElementDestroyed, e, ec.unit[e]!, ...slotPose(fc.x[id]!, fc.y[id]!, fc.facing[id]!, ec.slot[e]!, list.length, SLOT_SPACING)]);
    const hash = s.hash();
    w.out.events.length = 0;
    for (const e of dying) applyLoss(w, e, ec.strength[e]!);
    settleFormation(w, id);
    expect(w.out.events).toEqual(expected);
    expect(elementIndex(w).get(id)).toEqual(list.filter((e) => !dying.includes(e)));
    checkInvariants(w);
    expect(s.hash()).not.toBe(hash); // the deaths are state; the events are not (the pinned hash covers that)

    // Wiped out: every element left has its end, then the formation its own.
    const rest = [...elementIndex(w).get(id)!];
    w.out.events.length = 0;
    for (const e of rest) applyLoss(w, e, ec.strength[e]!);
    settleFormation(w, id);
    const kinds = Array.from({ length: w.out.events.length / 6 }, (_, i) => w.out.events[i * 6 + 1]);
    expect(kinds).toEqual([...rest.map(() => EventKind.ElementDestroyed), EventKind.FormationDestroyed]);
    expect(w.formations.has(id)).toBe(false);
    checkInvariants(w);

    // Not a death: a formation removed whole (disbanded, annexed, by God) takes its elements
    // along without an end for each.
    const other = w.formations.ids()[0]!;
    w.out.events.length = 0;
    destroyFormation(w, other);
    expect(w.out.events[1]).toBe(EventKind.FormationDestroyed);
    expect(w.out.events).toHaveLength(6);
  });
});

function H(): number {
  return SIZE_1938.h;
}
