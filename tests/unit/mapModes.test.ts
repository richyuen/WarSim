import { describe, expect, it } from 'vitest';
import en from '../../src/ui/i18n/en.json' with { type: 'json' };
import {
  ALLY_COLOR,
  ENEMY_COLOR,
  INCOME_HIGH,
  INCOME_LOW,
  MAP_MODES,
  NEUTRAL_COLOR,
  NON_ALIGNED_COLOR,
  PEACE_COLOR,
  SELF_COLOR,
  SUBJECT_COLOR,
  WAR_COLOR,
  legendFor,
  lighten,
  mix,
  modeColor,
  PUPPET_LIGHTEN,
  type NationColors,
} from '../../src/shared/mapModes';

// Review after PLAN 1.31: the map-mode colour rules and legends (previously only covered by e2e
// pixel checks).

const base: NationColors = { own: 0x336699, allianceLeader: null, overlord: null, hasPuppets: false };

describe('map modes', () => {
  it('political and terrain/revolts keep the own colour (the shader colours the latter)', () => {
    for (const m of ['political', 'terrain', 'revolts'] as const) expect(modeColor(m, base)).toBe(0x336699);
  });

  it('alliances and puppets', () => {
    expect(modeColor('alliances', base)).toBe(NON_ALIGNED_COLOR);
    expect(modeColor('alliances', { ...base, allianceLeader: 0x112233 })).toBe(0x112233);
    expect(modeColor('puppets', base)).toBe(NON_ALIGNED_COLOR);
    expect(modeColor('puppets', { ...base, hasPuppets: true })).toBe(0x336699);
    expect(modeColor('puppets', { ...base, overlord: 0x804020 })).toBe(lighten(0x804020, PUPPET_LIGHTEN));
  });

  it('wars: red at war, grey at peace', () => {
    expect(modeColor('wars', { ...base, atWar: true })).toBe(WAR_COLOR);
    expect(modeColor('wars', base)).toBe(PEACE_COLOR);
  });

  it('diplomacy: own colours with nothing selected, else one colour per relation', () => {
    expect(modeColor('diplomacy', base)).toBe(0x336699);
    expect(modeColor('diplomacy', { ...base, relation: 'none' })).toBe(0x336699);
    const want = { self: SELF_COLOR, ally: ALLY_COLOR, enemy: ENEMY_COLOR, subject: SUBJECT_COLOR, neutral: NEUTRAL_COLOR } as const;
    for (const [r, c] of Object.entries(want)) expect(modeColor('diplomacy', { ...base, relation: r as keyof typeof want })).toBe(c);
  });

  it('income: a clamped ramp from low to high', () => {
    expect(modeColor('income', { ...base, incomeT: 0 })).toBe(INCOME_LOW);
    expect(modeColor('income', { ...base, incomeT: 1 })).toBe(INCOME_HIGH);
    expect(modeColor('income', { ...base, incomeT: 7 })).toBe(INCOME_HIGH);
    expect(modeColor('income', { ...base, incomeT: -1 })).toBe(INCOME_LOW);
    expect(modeColor('income', { ...base, incomeT: 0.5 })).toBe(mix(INCOME_LOW, INCOME_HIGH, 0.5));
  });

  it('every mode has a legend whose keys (and the mode name) exist in en.json', () => {
    const keys = new Set(Object.keys(en));
    for (const m of MAP_MODES) {
      expect(keys.has(`mapMode.${m}`), m).toBe(true);
      const legend = legendFor(m);
      expect(legend.length, m).toBeGreaterThan(0);
      for (const [, key] of legend) expect(keys.has(key), key).toBe(true);
    }
  });
});
