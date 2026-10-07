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
  const richNow = (): number[] => {
    const out: number[] = [];
    w.nations.forEach((n) => {
      if (nc.living[n] === 1 && nc.income[n]! >= RICH) out.push(n);
    });
    return out;
  };
  until(1940);
  const richIn1940 = richNow();
  // The last hour of 1941.
  until(1942);
  expect(knowing()).toEqual([]);
  // Research went on meanwhile: every nation that was rich through 1940 and 1941 knows a tech
  // of 1941. The two years are the premise this check always had (PLAN 3.4Rj, ADR-147: in the
  // game since, Denmark's income in peace is 157 until it takes 1,096 cells of Germany at the
  // peace of February 1941, and 1,087 after; rich for ten months, it has learnt 6 techs, the
  // earliest first, and has 6 of 1939 and 1940 to go before `armor_medium_2`). The check of
  // 1944 below takes every nation that is rich in 1942, Denmark too.
  const medium2 = techMask([RULES_1938.techs.findIndex((t) => t.id === 'armor_medium_2')]);
  const rich = richNow();
  const richBoth = rich.filter((n) => richIn1940.includes(n));
  expect(richBoth.length).toBeGreaterThanOrEqual(3);
  for (const n of richBoth) expect(knowsTechs(w, n, medium2), `${TAGS_1938[n - 1]} knows armor_medium_2 in 1942`).toBe(true);
  until(1944);
  const known = knowing();
  for (const n of rich) if (nc.living[n] === 1 && nc.income[n]! >= RICH) expect(known, `${TAGS_1938[n - 1]} knows armor_heavy_1 in 1944`).toContain(n);
  expect(known.length).toBeGreaterThanOrEqual(3);
}, 900_000);

// PLAN 3.4Rg AT (ADR-144): a nation that is played, or lives in a world with no AI, researches
// as the AI's nations do. Two years: France taken at tick 0, its AI twin, and a world with the
// AI off from the start.
it('seed 99: France played from tick 0, and France in a world with no AI, know after two years a tech of 1939 that the AI\'s France knows', () => {
  const FRA = TAGS_1938.indexOf('FRA') + 1;
  const make = (): Sim => new Sim({ scenario: '1938', seed: 99, assets: assets1938(SIZE_1938.w) });
  const quiet = (ww: Sim['world']): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  const twoYears = (s: Sim): number[] => {
    const start = RULES_1938.techs.flatMap((_, i) => (knowsTechs(s.world, FRA, techMask([i])) ? [i] : []));
    s.step((daysFromCivil(1940, 1, 1) - s.world.startDay) * 24 - s.world.tick, quiet);
    return RULES_1938.techs.flatMap((_, i) => (!start.includes(i) && knowsTechs(s.world, FRA, techMask([i])) ? [i] : []));
  };
  const ai = twoYears(make());
  const played = make();
  played.command({ kind: 'setPlayer', nation: FRA });
  const mine = twoYears(played);
  const noAi = make();
  noAi.world.settings.aiEnabled = false;
  const alone = twoYears(noAi);
  const of1939 = (l: number[]): number[] => l.filter((i) => RULES_1938.techs[i]!.year === 1939);
  expect(of1939(ai).length).toBeGreaterThan(0);
  for (const [name, l] of [['played', mine], ['no AI', alone]] as const) {
    expect(l.length, `${name}: techs learned in two years (the AI's France: ${ai.length})`).toBeGreaterThanOrEqual(ai.length - 2);
    expect(of1939(l).some((i) => of1939(ai).includes(i)), `${name}: a tech of 1939 the AI's France knows`).toBe(true);
  }
}, 900_000);
