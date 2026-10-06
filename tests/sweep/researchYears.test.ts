import { expect, it } from 'vitest';
import { daysFromCivil } from '../../src/shared/calendar';
import { RULES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { knowsTechs, techMask } from '../../src/sim/tech';
import { assets1938 } from '../helpers/earth';

// PLAN 3.1b AT: a 1938 game without commands. No nation knows the heavy tank before 1942 (the
// year of a tech is a floor, ADR-128), and the rich know it within two years of 1942.
const RICH = 1000;

it('seed 99: nobody knows the heavy tank before 1942, the rich know it by 1944', () => {
  const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  const nc = w.nations.cols;
  const heavy = techMask([RULES_1938.techs.findIndex((t) => t.id === 'armor_heavy_1')]);
  const knowing = (): number[] => {
    const out: number[] = [];
    w.nations.forEach((n) => {
      if (knowsTechs(w, n, heavy)) out.push(n);
    });
    return out;
  };
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  const until = (year: number): void => s.step((daysFromCivil(year, 1, 1) - w.startDay) * 24 - w.tick, quiet);
  // The last hour of 1941.
  until(1942);
  expect(knowing()).toEqual([]);
  // Research went on meanwhile: every rich nation knows a tech of 1941.
  const medium2 = techMask([RULES_1938.techs.findIndex((t) => t.id === 'armor_medium_2')]);
  const rich: number[] = [];
  w.nations.forEach((n) => {
    if (nc.living[n] === 1 && nc.income[n]! >= RICH) rich.push(n);
  });
  expect(rich.length).toBeGreaterThanOrEqual(3);
  for (const n of rich) expect(knowsTechs(w, n, medium2), `${TAGS_1938[n - 1]} knows armor_medium_2 in 1942`).toBe(true);
  until(1944);
  const known = knowing();
  for (const n of rich) if (nc.living[n] === 1 && nc.income[n]! >= RICH) expect(known, `${TAGS_1938[n - 1]} knows armor_heavy_1 in 1944`).toContain(n);
  expect(known.length).toBeGreaterThanOrEqual(3);
}, 900_000);
