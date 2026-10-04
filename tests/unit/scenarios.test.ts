import { describe, expect, it } from 'vitest';
import en from '../../src/ui/i18n/en.json';
import { LISTED_SCENARIOS, SCENARIO_INFO, scenarioIdOf } from '../../src/shared/scenarios';

// PLAN 1.43: the scenario catalog behind the title screen. The 1938 world is offered first; the
// toy world is a test world that opens by its URL only.

describe('scenario catalog (PLAN 1.43)', () => {
  it('lists the 1938 world first and hides the toy world', () => {
    expect(LISTED_SCENARIOS[0]).toBe('1938');
    expect(LISTED_SCENARIOS).not.toContain('toy');
    expect(SCENARIO_INFO.toy.hidden).toBe(true);
    expect(SCENARIO_INFO['1938'].hidden).toBe(false);
  });

  it('every scenario carries the texts the title screen shows', () => {
    const texts = en as Record<string, string>;
    for (const info of Object.values(SCENARIO_INFO)) {
      for (const key of [info.nameKey, info.descKey, info.mapNameKey]) expect(texts[key], key).toBeTruthy();
    }
    expect(texts[SCENARIO_INFO['1938'].nameKey]).toBe('World, 1938');
    expect(texts[SCENARIO_INFO['1938'].mapNameKey]).toBe('Earth');
  });

  it('reads the scenario of a URL: a hidden one opens, an unknown one or none is the title screen', () => {
    expect(scenarioIdOf('1938')).toBe('1938');
    expect(scenarioIdOf('toy')).toBe('toy');
    for (const v of [null, '', '1939', 'TOY', 'toString', 'constructor']) expect(scenarioIdOf(v), String(v)).toBeNull();
  });
});
