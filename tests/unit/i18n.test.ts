import { describe, expect, it } from 'vitest';
import en from '../../src/ui/i18n/en.json';
import { locale, pseudo, t } from '../../src/ui/i18n';

describe('i18n (PLAN 0.21)', () => {
  it('t() reads en.json and interpolates params', () => {
    locale.value = 'en';
    expect(t('app.title')).toBe(en['app.title']);
    expect(t('map.tick', { tick: 42 })).toBe('Tick 42');
    expect(t('map.tick')).toBe('Tick {tick}');
  });

  it('the pseudo-locale accents text but keeps placeholders and is reactive', () => {
    expect(pseudo('Tick {tick}')).toMatch(/^⟦Ţîçķ \{tick\}·+⟧$/);
    locale.value = 'qps';
    expect(t('map.tick', { tick: 7 })).toMatch(/^⟦Ţîçķ 7·+⟧$/);
    for (const k of Object.keys(en) as (keyof typeof en)[]) expect(t(k)).not.toBe(en[k]);
    locale.value = 'en';
  });

  it('every catalog value is a non-empty string', () => {
    for (const [k, v] of Object.entries(en)) expect(typeof v === 'string' && v.length > 0, k).toBe(true);
  });
});
