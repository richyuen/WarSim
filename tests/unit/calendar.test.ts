import { describe, expect, it } from 'vitest';
import { civilFromDays, dateOfTick, dayOfIso, daysFromCivil, isDayStart, isMonthStart, tickOfDate, ticksInYear } from '../../src/shared/calendar';
import { clampSpeedLevel, DEFAULT_SPEED_LEVEL, SPEED_LEVELS, speedOfLevel } from '../../src/shared/speed';
import { Sim } from '../../src/sim/sim';

// PLAN 1.8: calendar (1938-01-01 start, 1 tick = 1 hour, Gregorian) and speed levels.

const START = dayOfIso('1938-01-01');

describe('calendar (PLAN 1.8)', () => {
  it('1 sim year of 1938 is 8760 ticks; leap years have 8784', () => {
    expect(ticksInYear(1938)).toBe(8760);
    expect(tickOfDate(START, 1939, 1, 1)).toBe(8760);
    expect(dateOfTick(START, 8760)).toEqual({ year: 1939, month: 1, day: 1, hour: 0 });
    expect(dateOfTick(START, 8759)).toEqual({ year: 1938, month: 12, day: 31, hour: 23 });
    expect(ticksInYear(1940)).toBe(8784);
    expect(tickOfDate(START, 1941, 1, 1) - tickOfDate(START, 1940, 1, 1)).toBe(8784);
    expect(dateOfTick(START, tickOfDate(START, 1940, 2, 29) + 13)).toEqual({ year: 1940, month: 2, day: 29, hour: 13 });
  });

  it('day numbers match known dates and round-trip over centuries', () => {
    expect(daysFromCivil(1970, 1, 1)).toBe(0);
    expect(daysFromCivil(2000, 3, 1)).toBe(11017);
    expect(START).toBe(-11688);
    expect(dayOfIso('1939-09-01') - START).toBe(608);
    for (let z = -60000; z <= 60000; z += 37) {
      const { year, month, day } = civilFromDays(z);
      expect(daysFromCivil(year, month, day)).toBe(z);
    }
    expect(() => dayOfIso('1938/01/01')).toThrow(/bad date/);
  });

  it('day and month boundaries (monthly systems run 12 times a year)', () => {
    let months = 0;
    let days = 0;
    for (let t = 0; t < 8760; t++) {
      if (isMonthStart(START, t)) months++;
      if (isDayStart(t)) days++;
    }
    expect(months).toBe(12);
    expect(days).toBe(365);
    expect(isMonthStart(START, tickOfDate(START, 1938, 3, 1))).toBe(true);
    expect(isMonthStart(START, tickOfDate(START, 1938, 3, 1) + 1)).toBe(false);
  });

  it('the world carries its start day through save/load', () => {
    const sim = new Sim({ scenario: 'toy', seed: 7 });
    expect(sim.world.startDay).toBe(START);
    sim.step(30);
    const copy = new Sim({ scenario: 'toy', seed: 1 });
    copy.world.startDay = 0;
    copy.load(sim.save());
    expect(copy.world.startDay).toBe(START);
    expect(dateOfTick(copy.world.startDay, copy.world.tick)).toEqual({ year: 1938, month: 1, day: 2, hour: 6 });
  });
});

describe('speed levels', () => {
  it('step from 1 h/s to Max; the default runs one day per second; bad input clamps', () => {
    expect(SPEED_LEVELS[0]).toBe(1);
    expect(SPEED_LEVELS[SPEED_LEVELS.length - 1]).toBe('max');
    expect(speedOfLevel(DEFAULT_SPEED_LEVEL)).toBe(24);
    expect(clampSpeedLevel(-3)).toBe(0);
    expect(clampSpeedLevel(99)).toBe(SPEED_LEVELS.length - 1);
    expect(clampSpeedLevel(Number('abc'))).toBe(DEFAULT_SPEED_LEVEL);
  });
});
