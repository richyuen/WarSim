import { describe, expect, it } from 'vitest';
import { layoutCityLabels, NAME_CLEAR_PX, NAME_REACH_PX, nameMaxMPerPx, nameTextBox, priorityOrder, wanted, type CityPoint, type LabelState } from '../../src/render/labels/cityLabels';
import { ZOOM_HYSTERESIS, type SwitchState } from '../../src/render/timing';
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
    const OFF: SwitchState<number> = { held: () => false, visible: () => false };
    /** City `i`'s part is on, nothing else. */
    const only = (i: number): SwitchState<number> => ({ held: (k) => k === i, visible: (k) => k === i });

    it('wanted: in below the limit, held through the band above it', () => {
      expect(wanted(1999, 2000, false)).toBe(true);
      expect(wanted(2000, 2000, false)).toBe(false);
      expect(wanted(2000 * ZOOM_HYSTERESIS - 1, 2000, true)).toBe(true);
      expect(wanted(2000 * ZOOM_HYSTERESIS, 2000, true)).toBe(false);
      expect(wanted(1e9, Infinity, false)).toBe(true); // capitals' dots: at every zoom
    });

    it('a name that is on stays above its limit by the hysteresis; one that is off does not come in there', () => {
      const limit = nameMaxMPerPx(points[hamburg]!);
      const scale = (geo.kmPerCell * 1000) / (limit * 1.08); // inside the band above the limit
      expect(mPerPx(scale)).toBeGreaterThan(limit);
      const off = layout(scale, { dot: OFF, name: OFF });
      expect(off.find((p) => p.index === hamburg)!.nameAlpha).toBe(0);
      const on = layout(scale, { dot: OFF, name: only(hamburg) });
      expect(on.find((p) => p.index === hamburg)).toMatchObject({ dotAlpha: 1, nameAlpha: 1 });
    });

    it('what still fades out is placed with its box, and wants nothing', () => {
      // Far out, where only capitals and the largest cities have dots: a town that was on.
      const town = points.findIndex((c) => !c.capital && c.size === 1 && Math.abs(c.x - ber.x) < 20 && Math.abs(c.y - ber.y) < 10);
      expect(town).toBeGreaterThanOrEqual(0);
      const scale = (geo.kmPerCell * 1000) / 4000;
      expect(layout(scale, { dot: OFF, name: OFF }).some((p) => p.index === town)).toBe(false);
      // Its dot is still on screen, on its way out: no longer held, and not wanted at this zoom.
      const lingering = layout(scale, { dot: { held: () => false, visible: (i) => i === town }, name: OFF }).find((p) => p.index === town)!;
      expect(lingering).toMatchObject({ dotAlpha: 0, nameAlpha: 0 });
      expect(lingering.box).toBeDefined();
    });

    it('tells the cities in view that have nothing to show, and no others', () => {
      const scale = (geo.kmPerCell * 1000) / 4000;
      const hidden: number[] = [];
      const hiddenNames: number[] = [];
      const placed = layout(scale, { dot: { ...OFF, hidden: (i) => hidden.push(i) }, name: { ...OFF, hidden: (i) => hiddenNames.push(i) } });
      expect(hidden.length).toBeGreaterThan(20);
      expect(hiddenNames).toEqual(hidden); // the dot and the name of such a city, both
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

// PLAN 2.7r: a name keeps clear of what the frame gives it as obstacles (the T0 counters, the
// capital flags): it takes the first place by its dot that is free, keeps that place to the pixel
// while any of it is on screen, and is left out when it has none.
describe('city names among obstacles (PLAN 2.7r)', () => {
  const geo = { w: 100, h: 100, kmPerCell: 1, wrapX: false };
  const town: CityPoint[] = [{ name: 'Sample', x: 50, y: 50, size: 3, capital: true }];
  const measure = (t: string, px: number): number => t.length * px * 0.55;
  const cam = { cx: 50, cy: 50, scale: 8 }; // 125 m/px: the dot at 400, 300 of an 800 × 600 view
  const OFF: SwitchState<number> = { held: () => false, visible: () => false };
  const ON: SwitchState<number> = { held: () => true, visible: () => true };
  type Rect = { x: number; y: number; w: number; h: number; clear?: number };
  /** A counter: a name takes a place only with room to spare beside it. */
  const counterAt = (x: number, y: number): Rect => ({ x, y, w: 44, h: 14, clear: NAME_CLEAR_PX });
  const hit = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const lay = (obstacles: Rect[], state: LabelState = { dot: OFF, name: OFF }) => layoutCityLabels(town, [0], cam, geo, 800, 600, measure, state, obstacles)[0]!;
  /** The letters of a placed name. */
  const letters = (p: ReturnType<typeof lay>): Rect => nameTextBox(p.box!);

  const alone = lay([]);
  it('with nothing in the way a name stands to the right of its dot, as it always did', () => {
    expect(alone).toMatchObject({ nameAlpha: 1, side: 0 });
    expect(alone.box!.x).toBeGreaterThan(400);
    expect(alone.box!.y + alone.box!.h / 2).toBeCloseTo(300, 9);
  });

  it('a counter on that place: the next free place is taken, and the letters are clear of it', () => {
    // A counter to the right of the dot, where the name stood.
    const counter = counterAt(412, 293);
    const p = lay([counter]);
    expect(p).toMatchObject({ nameAlpha: 1, side: 1 }); // to the left
    expect(p.box!.x + p.box!.w).toBeLessThan(400);
    expect(hit(letters(p), counter)).toBe(false);
  });

  it('a counter on the dot: the name stands past it, as near as the counter leaves room', () => {
    const counter = counterAt(378, 293); // centred on the dot: no place beside the dot is clear of it
    const p = lay([counter]);
    expect(p).toMatchObject({ nameAlpha: 1, side: 8 }); // past it, to the right
    expect(letters(p).x - (counter.x + counter.w)).toBeCloseTo(NAME_CLEAR_PX + 1, 9);
    expect(hit(letters(p), counter)).toBe(false);
    // With a wall to the right of that counter too, past it to the left; with one there as well, below it.
    const right = { x: 422, y: 280, w: 120, h: 40 };
    const left = { x: 258, y: 280, w: 120, h: 40 };
    expect(lay([counter, right])).toMatchObject({ nameAlpha: 1, side: 9 });
    const under = lay([counter, right, left]);
    expect(under).toMatchObject({ nameAlpha: 1, side: 10 });
    expect(hit(letters(under), counter)).toBe(false);
  });

  it('counters all around, further than a name reaches: it is left out', () => {
    // A block of counters 200 px wide and 80 high on the dot.
    const wall = [{ x: 300, y: 260, w: 200, h: 80 }];
    const p = lay(wall);
    expect(p.nameAlpha).toBe(0);
    expect(p.box).toBeUndefined();
    expect(NAME_REACH_PX.side).toBeLessThan(100);
  });

  it('a name on screen keeps its place to the pixel while that place is free, though a place it prefers is free too', () => {
    // It stood past a counter that has gone since: 30 px to the right of where it would stand now.
    const place = { side: 8, dx: alone.box!.x - 400 + 30, dy: alone.box!.y - 300 };
    const p = lay([], { dot: ON, name: ON, place: () => place });
    expect(p).toMatchObject({ nameAlpha: 1, side: 8 });
    expect(p.box!.x).toBeCloseTo(alone.box!.x + 30, 9);
  });

  it('when something comes to stand on it, it takes the first free place at once; with none, it goes out where it stood', () => {
    const place = { side: 0, dx: alone.box!.x - 400, dy: alone.box!.y - 300 };
    const counter = counterAt(412, 293);
    // (The layer cross-fades: what showed at the old place goes out there.)
    expect(lay([counter], { dot: ON, name: ON, place: () => place })).toMatchObject({ nameAlpha: 1, side: 1 });
    const going = lay([{ x: 300, y: 260, w: 200, h: 80 }], { dot: ON, name: ON, place: () => place });
    expect(going.nameAlpha).toBe(0);
    expect(going.box).toEqual(alone.box);
  });

  it('a new place needs room to spare; a place held only has to be untouched', () => {
    // A counter whose left edge is 1 px from the letters of the name to the right of the dot.
    const text = nameTextBox(alone.box!);
    const counter = counterAt(text.x + text.w + 1, 293);
    expect(NAME_CLEAR_PX).toBeGreaterThan(1);
    // Not taken as a new place...
    expect(lay([counter]).side).not.toBe(0);
    // ...and kept by a name that stands there: a counter that moves by a pixel moves no name.
    const place = { side: 0, dx: alone.box!.x - 400, dy: alone.box!.y - 300 };
    expect(lay([counter], { dot: ON, name: ON, place: () => place })).toMatchObject({ nameAlpha: 1, side: 0, box: alone.box });
  });

  it('a flag by a pixel on the box of a name is not on its letters', () => {
    // A capital's own flag: 24 × 16, its foot 8 px above the dot, with a frame of 1 px.
    const flag = { x: 400 - 12 - 1, y: 300 - 24 - 1, w: 26, h: 18 };
    expect(hit(alone.box!, flag)).toBe(true);
    expect(lay([flag])).toMatchObject({ nameAlpha: 1, side: 0 });
  });
});
