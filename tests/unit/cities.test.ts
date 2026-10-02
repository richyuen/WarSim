import { describe, expect, it } from 'vitest';
import { layoutCityLabels, priorityOrder, type CityPoint } from '../../src/render/labels/cityLabels';
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

  it('zooming in from T1 names smaller cities that T1 left unnamed', () => {
    const named = (scale: number): Set<number> => new Set(at(scale).filter((p) => p.box).map((p) => p.index));
    const t1 = named(16);
    const fresh = [...named(48)].filter((i) => !t1.has(i));
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.some((i) => points[i]!.size <= 2)).toBe(true);
  });
});
