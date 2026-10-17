import { describe, expect, it } from 'vitest';
import { Terrain } from '../../src/shared/terrain';
import { xxhash32View } from '../../src/sim/core/hash';
import { buildPoliticalMap } from '../../src/sim/data/politicalMap';
import { cellOf } from '../../src/sim/data/terrain';
import { politicalMapInput1938 } from '../../src/sim/scenario1938';
import { assets1938, earthAdmin1, NATIONS_1938, politicalMap1938, TAGS_1938 } from '../helpers/earth';

// PLAN 1.3: 1 January 1938 ownership from admin-1 provinces + interwar border regions +
// occupation. Known places are checked against the historical record (atlas facts as of
// 1938-01-01: before the Anschluss, Munich, the Vienna Award and the Memel ultimatum).

const tags = TAGS_1938;
/** Dead nations (e.g. Ethiopia, conquered 1936) exist only through their cores and own nothing. */
const alive = NATIONS_1938.map((n) => n.alive !== false);
const build = (w: number) => politicalMap1938(w);

/** [place, lon, lat, owner, controller (if occupied)] — chosen inland, away from 1-cell borders. */
const KNOWN: [string, number, number, string, string?][] = [
  // PLAN 1.3 AT
  ['Danzig (Free City)', 18.65, 54.35, 'DAN'],
  // Islets no province covers and no owned land touches: the nearest owned land's (PLAN 7.4f31)
  ['Lemnos (islet)', 25.2, 39.9, 'GRE'],
  ['Mayotte (islet, with Madagascar)', 45.1, -12.8, 'MAD'],
  ['Faroes (islet)', -6.8, 61.8, 'DEN'],
  ['Lwów', 24.03, 49.84, 'POL'],
  ['Königsberg', 20.5, 54.71, 'GER'],
  ['Harbin (Manchukuo)', 126.6, 45.75, 'MAN'],
  ['Addis Ababa (Italian East Africa)', 38.75, 9.03, 'ITA'],
  // Central and eastern Europe
  ['Vienna (before the Anschluss)', 16.37, 48.21, 'AUT'],
  ['Prague', 14.42, 50.08, 'CZS'],
  ['Uzhhorod (Carpathian Ruthenia)', 22.3, 48.62, 'CZS'],
  ['Stettin', 14.55, 53.43, 'GER'],
  ['Breslau', 17.03, 51.11, 'GER'],
  ['Gleiwitz', 18.67, 50.29, 'GER'],
  ['Elbing', 19.4, 54.16, 'GER'],
  ['Kattowitz (Polish Upper Silesia)', 19.02, 50.26, 'POL'],
  ['Gdynia (Corridor)', 18.53, 54.52, 'POL'],
  ['Bydgoszcz', 18.0, 53.12, 'POL'],
  ['Wilno', 25.28, 54.69, 'POL'],
  ['Brest-Litovsk', 23.7, 52.1, 'POL'],
  ['Pinsk', 26.1, 52.11, 'POL'],
  ['Równe', 26.25, 50.62, 'POL'],
  ['Minsk', 27.56, 53.9, 'SOV'],
  ['Memel (Klaipėda)', 21.13, 55.71, 'LIT'],
  ['Viipuri', 28.75, 60.71, 'FIN'],
  ['Petsamo', 31.0, 69.5, 'FIN'],
  ['Leningrad', 30.3, 59.94, 'SOV'],
  ['Czernowitz', 25.94, 48.29, 'ROM'],
  ['Kishinev (Bessarabia)', 28.86, 47.0, 'ROM'],
  ['Izmail (Budjak)', 28.83, 45.35, 'ROM'],
  ['Camenca (Moldavian ASSR)', 28.72, 48.03, 'SOV'],
  ['Dobrich (Southern Dobruja)', 27.83, 43.57, 'ROM'],
  ['Pazin (Istria)', 13.94, 45.24, 'ITA'],
  ['Rhodes (Dodecanese)', 28.0, 36.3, 'ITA'],
  ['Antioch (Sanjak of Alexandretta)', 36.16, 36.2, 'SYR'],
  // Spain at war
  ['Barcelona', 2.17, 41.39, 'REP'],
  ['Madrid', -3.7, 40.42, 'REP'],
  ['Valencia', -0.38, 39.47, 'REP'],
  ['Seville', -5.98, 37.39, 'NSP'],
  ['Burgos', -3.7, 42.34, 'NSP'],
  ['Tétouan (Spanish Morocco)', -5.37, 35.57, 'NSP'],
  ['Sidi Ifni', -10.17, 29.38, 'NSP'],
  // East Asia
  ['Seoul (Keijō)', 126.98, 37.57, 'JAP'],
  ['Taipei', 121.56, 25.04, 'JAP'],
  ['Dairen (Kwantung)', 121.6, 38.91, 'JAP'],
  ['Toyohara (Karafuto)', 142.73, 46.96, 'JAP'],
  ['Hsinking', 125.3, 43.9, 'MAN'],
  ['Chengde (Jehol)', 117.9, 40.97, 'MAN'],
  ['Kalgan (Mengjiang)', 114.88, 40.77, 'MEN'],
  ['Peking (occupied)', 116.4, 39.9, 'CHI', 'JAP'],
  ['Nanking (occupied)', 118.8, 32.06, 'CHI', 'JAP'],
  ['Hankou', 114.3, 30.6, 'CHI'],
  ["Yan'an", 109.49, 36.6, 'CCP'],
  ['Lhasa', 91.1, 29.65, 'TIB'],
  ['Urumqi', 87.6, 43.8, 'SIN'],
  ['Urga', 106.9, 47.9, 'MON'],
  ['Kyzyl', 94.45, 51.72, 'TAN'],
  // Empires
  ['Hanoi', 105.85, 21.03, 'INC'],
  ['Batavia', 106.85, -6.2, 'DEI'],
  ['Manila', 120.98, 14.6, 'PHI'],
  ['Delhi', 77.2, 28.6, 'RAJ'],
  ['Rangoon', 96.2, 16.8, 'BUR'],
  ['Goa', 74.0, 15.4, 'POR'],
  ['Kuala Lumpur', 101.7, 3.14, 'MAL'],
  ['Gander (Newfoundland)', -54.6, 48.95, 'NFL'],
  ['Algiers', 3.06, 36.75, 'FRA'],
  ['Rabat', -6.84, 34.02, 'FMO'],
  ['Tripoli', 13.18, 32.89, 'ITA'],
  ['Asmara', 38.93, 15.33, 'ITA'],
  ['Mogadishu', 45.34, 2.04, 'ITA'],
  ['Hargeisa', 44.06, 9.56, 'ENG'],
  ['Damascus', 36.29, 33.51, 'SYR'],
  ['Jerusalem', 35.21, 31.77, 'PAL'],
  ['Lahij (Aden Protectorate)', 44.88, 13.06, 'ENG'],
  ["Sana'a", 44.2, 15.35, 'YEM'],
  ['Buea (British Cameroons)', 9.24, 4.16, 'NIG'],
  ['Windhoek (South West Africa)', 17.08, -22.56, 'SAF'],
  ['Valletta', 14.51, 35.9, 'ENG'],
];

describe('1938 ownership at 2048×1024 (PLAN 1.3)', () => {
  const r = build(2048);
  const W = 2048;
  const cell = (lon: number, lat: number): number => {
    const [x, y] = cellOf(lon, lat, W, 1024);
    return Math.floor(y) * W + Math.floor(x);
  };
  const tagAt = (a: Uint16Array, c: number): string => (a[c] === 0 ? '-' : tags[a[c]! - 1]!);

  it('every admin-0 unit and province override is mapped', () => {
    expect(r.unmappedCountries).toEqual([]);
    expect(r.unknownProvinces).toEqual([]);
  });

  it('known places have their 1 January 1938 owner and controller', () => {
    const wrong = KNOWN.flatMap(([name, lon, lat, owner, controller]) => {
      const c = cell(lon, lat);
      const got = `${tagAt(r.owner, c)}/${tagAt(r.controller, c)}`;
      const want = `${owner}/${controller ?? owner}`;
      return got === want ? [] : [`${name}: ${got} (want ${want})`];
    });
    expect(wrong).toEqual([]);
  });

  it('every living nation owns land, dead ones own none, Manchukuo is a real state, water is unowned', () => {
    const cells = new Array<number>(tags.length + 1).fill(0);
    for (const v of r.owner) cells[v]!++;
    expect(tags.filter((_, i) => alive[i] && cells[i + 1] === 0)).toEqual([]);
    expect(tags.filter((_, i) => !alive[i] && cells[i + 1]! > 0)).toEqual([]);
    expect(cells[tags.indexOf('MAN') + 1]).toBeGreaterThan(5000); // ~1.3 M km² at ~400 km²/cell
    expect(cells[tags.indexOf('DAN') + 1]).toBeGreaterThanOrEqual(3);
    for (let c = 0; c < r.owner.length; c++) if (r.terrain[c]! < Terrain.Plains) expect(r.owner[c]).toBe(0);
  });

  it('every region and occupation changes cells; occupation only touches its owner', () => {
    const idle = Object.entries(r.regionCells).filter(([id, n]) => n === 0 && id !== 'italy_lagosta'); // Lastovo is sub-cell
    expect(idle).toEqual([]);
    const chi = tags.indexOf('CHI') + 1;
    for (let c = 0; c < r.owner.length; c++) if (r.controller[c] !== r.owner[c]) expect(r.owner[c]).toBe(chi);
  });

  // PLAN 7.4f31 (ADR-454): the Spratly Islands, France's since 1933, were the one land of the start
  // that was nobody's but Antarctica.
  it('no land is nobody\'s but Antarctica\'s; the Spratly Islands are France\'s', () => {
    const nobodys: string[] = [];
    for (let c = 0; c < r.owner.length; c++) {
      if (r.terrain[c]! < Terrain.Plains || r.owner[c] !== 0) continue;
      const y = Math.floor(c / W);
      if (y < 1024 * 0.8) nobodys.push(`${c % W},${y}`);
    }
    expect(nobodys).toEqual([]);
    const fra = tags.indexOf('FRA') + 1;
    let spratly = 0;
    const [x0, y0] = cellOf(111.5, 11.5, W, 1024);
    const [x1, y1] = cellOf(115.5, 7.5, W, 1024); // west of Palawan
    for (let y = Math.floor(y0); y <= Math.floor(y1); y++)
      for (let x = Math.floor(x0); x <= Math.floor(x1); x++) {
        const c = y * W + x;
        if (r.terrain[c]! < Terrain.Plains) continue;
        expect(r.owner[c], `cell ${x},${y}`).toBe(fra);
        spratly++;
      }
    expect(spratly).toBeGreaterThanOrEqual(1);
  });

  // PLAN 7.4f32: a province smaller than a cell with no room by its label point takes a cell away
  // from it; in another country's land that cell was its owner's (Liechtenstein's Balzers by the
  // Po delta, Switzerland's; Slovenia's Preddvor in Friuli, Yugoslavia's). Its owner is now its
  // neighbours'. A one-cell land province owned unlike every land cell beside it is an enclave.
  it('a one-cell province owned unlike all the land beside it is a real enclave', () => {
    const count = new Map<number, number>();
    for (const id of r.provinceIds) if (id) count.set(id, (count.get(id) ?? 0) + 1);
    const meta = earthAdmin1().meta;
    const lone: string[] = [];
    for (let c = 0; c < r.provinceIds.length; c++) {
      const id = r.provinceIds[c]!;
      if (!id || count.get(id) !== 1 || r.terrain[c]! < Terrain.Plains) continue;
      const beside = new Set<number>();
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const y = Math.floor(c / W) + dy;
          if ((!dx && !dy) || y < 0 || y >= 1024) continue;
          const n = y * W + (((c % W) + dx + W) % W);
          if (r.terrain[n]! >= Terrain.Plains) beside.add(r.owner[n]!);
        }
      if (beside.size > 0 && !beside.has(r.owner[c]!)) lone.push(`${meta[id - 1]!.adm0} ${meta[id - 1]!.name} ${tagAt(r.owner, c)}`);
    }
    expect(lone.sort()).toEqual(['AIA East End ENG', 'GIB Gibraltar ENG', 'IND Puducherry FRA', 'MAC Macau POR', 'USG USNB, Guantanamo Bay USA']);
  });

  it('island territories keep one land cell, and the build is deterministic', () => {
    expect(r.islands).toEqual(expect.arrayContaining(['MLT', 'BMU', 'MDV', 'GIB']));
    const again = buildPoliticalMap(politicalMapInput1938(assets1938(2048), 2048, 1024)); // a fresh, independent build
    expect(xxhash32View(again.owner)).toBe(xxhash32View(r.owner));
    expect(xxhash32View(again.controller)).toBe(xxhash32View(r.controller));
  });
});

describe('1938 ownership at 1024×512', () => {
  it('every living nation still owns land at the small map size', () => {
    const r = build(1024);
    const cells = new Array<number>(tags.length + 1).fill(0);
    for (const v of r.owner) cells[v]!++;
    expect(tags.filter((_, i) => alive[i] && cells[i + 1] === 0)).toEqual([]);
  });
});
