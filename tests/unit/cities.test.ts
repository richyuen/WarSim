import { describe, expect, it } from 'vitest';
import { LABEL_HYSTERESIS, layoutCityLabels, nameMaxMPerPx, priorityOrder, wanted, type CityPoint, type LabelState } from '../../src/render/labels/cityLabels';
import { CITIES_1938, NATIONS_1938, politicalMap1938, TAGS_1938 } from '../helpers/earth';

// PLAN 1.5: cities from Natural Earth (1938 names, filtered), every capital is a city of its
// own nation, and city names appear at T1 without overlapping.

const W = 2048;
const H = 1024;
const nations = NATIONS_1938;
const tags = TAGS_1938;
const defs = CITIES_1938;
const { owner, cities: placed } = politicalMap1938(W);

describe('1938 cities (PLAN 1.5)', () => {
  it('every living nation has exactly one capital city, in its own territory, named as its capital', () => {
    const problems = nations.flatMap((n, i) => {
      if (n.alive === false) return [];
      const caps = placed.filter((c) => c.capitalOf === i + 1);
      if (caps.length !== 1) return [`${n.tag}: ${caps.length} capital cities`];
      const c = caps[0]!;
      if (owner[c.cell] !== i + 1) return [`${n.tag}: capital ${c.name} lies in ${tags[owner[c.cell]! - 1] ?? 'no one'}'s land`];
      if (c.name !== n.capital.name) return [`${n.tag}: capital city ${c.name} ≠ ${n.capital.name}`];
      return [];
    });
    expect(problems).toEqual([]);
  });

  it('the list is a sensible 1938 gazetteer: size, 1938 names, no post-1938 cities', () => {
    expect(defs.length).toBeGreaterThan(1500);
    expect(defs.length).toBeLessThan(8000);
    expect(placed.length / defs.length).toBeGreaterThan(0.98); // all but a few remote islets sit on owned land
    const names = new Set(defs.map((c) => c.name));
    for (const n of ['Stalingrad', 'Leningrad', 'Königsberg', 'Danzig', 'Breslau', 'Lwów', 'Wilno', 'Peiping', 'Hsinking', 'Mukden', 'Batavia', 'Bombay', 'Saigon', 'Léopoldville']) {
      expect(names.has(n), n).toBe(true);
    }
    for (const n of ['Volgograd', 'Kaliningrad', 'Gdańsk', 'Beijing', 'Jakarta', 'Brasília', 'Islamabad', 'Abuja', 'Shenzhen']) expect(names.has(n), n).toBe(false);
  });

  it('cities belong to the nation that owns their land (Breslau German, Lwów Polish, Danzig the Free City)', () => {
    const ownerOf = (name: string): string => tags[placed.find((c) => c.name === name)!.owner - 1]!;
    expect(ownerOf('Breslau')).toBe('GER');
    expect(ownerOf('Lwów')).toBe('POL');
    expect(ownerOf('Wilno')).toBe('POL');
    expect(ownerOf('Königsberg')).toBe('GER');
    expect(ownerOf('Danzig')).toBe('DAN');
    expect(ownerOf('Hsinking')).toBe('MAN');
  });
});

describe('city label layout', () => {
  const geo = { w: W, h: H, kmPerCell: 40075 / W, wrapX: true };
  const points: CityPoint[] = placed.map((c) => ({ name: c.name, x: c.x, y: c.y, size: c.size, capital: c.capitalOf !== 0 }));
  const order = priorityOrder(points);
  const measure = (t: string, px: number): number => t.length * px * 0.55;
  const ber = placed.find((c) => c.name === 'Berlin')!;
  /** Layout of a 1600×900 view centred on Berlin. */
  const at = (scale: number) => layoutCityLabels(points, order, { cx: ber.x, cy: ber.y, scale }, geo, 1600, 900, measure);

  it('T0 world view: dots for big cities and capitals, no names', () => {
    const l = at(0.8); // ≈ 24 km/px
    expect(l.length).toBeGreaterThan(0);
    expect(l.filter((p) => p.nameAlpha > 0)).toEqual([]);
  });

  it('T1 (≈ 1.2 km/px): names appear, capitals first, and never overlap', () => {
    const l = at(16);
    const named = l.filter((p) => p.box);
    expect(named.length).toBeGreaterThan(20);
    expect(named.map((p) => points[p.index]!.name)).toEqual(expect.arrayContaining(['Berlin', 'Prague', 'Warsaw', 'Hamburg']));
    for (let i = 0; i < named.length; i++) {
      for (let j = i + 1; j < named.length; j++) {
        const a = named[i]!.box!;
        const b = named[j]!.box!;
        expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
      }
    }
  });

  // PLAN 2.7d: a dot or a name is a state. The layout says what is wanted; what is on now holds
  // through a band above its limit, and what is still fading out is placed without being wanted.
  describe('with the states of the frames before', () => {
    const mPerPx = (scale: number): number => (geo.kmPerCell * 1000) / scale;
    const layout = (scale: number, state: LabelState): ReturnType<typeof layoutCityLabels> => layoutCityLabels(points, order, { cx: ber.x, cy: ber.y, scale }, geo, 1600, 900, measure, state);
    const hamburg = points.findIndex((c) => c.name === 'Hamburg');

    it('wanted: in below the limit, held through the band above it', () => {
      expect(wanted(1999, 2000, false)).toBe(true);
      expect(wanted(2000, 2000, false)).toBe(false);
      expect(wanted(2000 * LABEL_HYSTERESIS - 1, 2000, true)).toBe(true);
      expect(wanted(2000 * LABEL_HYSTERESIS, 2000, true)).toBe(false);
      expect(wanted(1e9, Infinity, false)).toBe(true); // capitals' dots: at every zoom
    });

    it('a name that is on stays above its limit by the hysteresis; one that is off does not come in there', () => {
      const limit = nameMaxMPerPx(points[hamburg]!);
      const scale = (geo.kmPerCell * 1000) / (limit * 1.08); // inside the band above the limit
      expect(mPerPx(scale)).toBeGreaterThan(limit);
      const off = layout(scale, { held: () => false, visible: () => false });
      expect(off.find((p) => p.index === hamburg)!.nameAlpha).toBe(0);
      const on = layout(scale, { held: (i, part) => i === hamburg && part === 'name', visible: (i) => i === hamburg });
      expect(on.find((p) => p.index === hamburg)).toMatchObject({ dotAlpha: 1, nameAlpha: 1 });
    });

    it('what still fades out is placed with its box, and wants nothing', () => {
      // Far out, where only capitals and the largest cities have dots: a town that was on.
      const town = points.findIndex((c) => !c.capital && c.size === 1 && Math.abs(c.x - ber.x) < 20 && Math.abs(c.y - ber.y) < 10);
      expect(town).toBeGreaterThanOrEqual(0);
      const scale = (geo.kmPerCell * 1000) / 4000;
      expect(layout(scale, { held: () => false, visible: () => false }).some((p) => p.index === town)).toBe(false);
      const lingering = layout(scale, { held: () => false, visible: (i) => i === town }).find((p) => p.index === town)!;
      expect(lingering).toMatchObject({ dotAlpha: 0, nameAlpha: 0 });
      expect(lingering.box).toBeDefined();
    });

    it('tells the cities in view that have nothing to show, and no others', () => {
      const scale = (geo.kmPerCell * 1000) / 4000;
      const hidden: number[] = [];
      const placed = layout(scale, { held: () => false, visible: () => false, hidden: (i) => hidden.push(i) });
      expect(hidden.length).toBeGreaterThan(20);
      const shown = new Set(placed.map((p) => p.index));
      for (const i of hidden) {
        expect(shown.has(i)).toBe(false);
        // In view: within the 1600 × 900 px around Berlin, with the layout's margin.
        expect(Math.abs((points[i]!.x - ber.x) * scale)).toBeLessThanOrEqual(1000);
        expect(Math.abs((points[i]!.y - ber.y) * scale)).toBeLessThanOrEqual(490);
      }
      // Every city in view is one or the other.
      const inView = points.filter((c) => Math.abs((c.x - ber.x) * scale) <= 800 && Math.abs((c.y - ber.y) * scale) <= 450).length;
      expect(new Set([...hidden, ...shown]).size).toBeGreaterThanOrEqual(inView);
    });
  });

  it('zooming in from T1 names smaller cities that T1 left unnamed', () => {
    const named = (scale: number): Set<number> => new Set(at(scale).filter((p) => p.box).map((p) => p.index));
    const t1 = named(16);
    const fresh = [...named(48)].filter((i) => !t1.has(i));
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.some((i) => points[i]!.size <= 2)).toBe(true);
  });
});
