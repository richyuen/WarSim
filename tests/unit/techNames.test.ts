import { expect, it } from 'vitest';
import { RULES_1938 } from '../../src/sim/scenario1938';
import en from '../../src/ui/i18n/en.json';

// PLAN 3.1e: the nation panel names a tech by `tech.<id>` of the i18n catalog.
it('every tech of the 1938 rules has a name in the catalog', () => {
  const catalog = en as Record<string, string>;
  expect(RULES_1938.techs.length).toBeGreaterThan(30);
  for (const t of RULES_1938.techs) expect(catalog[`tech.${t.id}`], t.id).toMatch(/\S/);
});
