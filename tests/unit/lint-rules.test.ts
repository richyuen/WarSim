import { ESLint } from 'eslint';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Each fixture in tests/lint-fixtures/ is linted as if it lived at
// src/<layer>/<file>, where <layer> is the fixture-name prefix (SPEC §2.1).
const root = path.resolve(import.meta.dirname, '../..');
const fixtureDir = path.join(root, 'tests/lint-fixtures');
const eslint = new ESLint({ cwd: root });

async function lintFixture(name: string): Promise<string[]> {
  const layer = name.split('-')[0] ?? '';
  const code = readFileSync(path.join(fixtureDir, name), 'utf8');
  const filePath = path.join(root, 'src', layer, name);
  const [result] = await eslint.lintText(code, { filePath });
  if (!result) throw new Error(`no lint result for ${name}`);
  const fatal = result.messages.filter((m) => m.fatal);
  if (fatal.length) throw new Error(`parse error in ${name}: ${fatal[0]?.message ?? ''}`);
  return result.messages.map((m) => m.ruleId ?? 'unknown');
}

const mustFail: [string, string][] = [
  ['sim-math-random.ts', 'no-restricted-properties'],
  ['sim-math-trig.ts', 'no-restricted-properties'],
  ['sim-math-destructure.ts', 'no-restricted-syntax'],
  ['sim-pow-operator.ts', 'no-restricted-syntax'],
  ['sim-date.ts', 'no-restricted-globals'],
  ['sim-performance.ts', 'no-restricted-globals'],
  ['sim-window.ts', 'no-restricted-globals'],
  ['sim-settimeout.ts', 'no-restricted-globals'],
  ['sim-for-in.ts', 'no-restricted-syntax'],
  ['sim-locale.ts', 'no-restricted-properties'],
  ['sim-imports-render.ts', 'warsim/module-boundaries'],
  ['sim-imports-package.ts', 'warsim/module-boundaries'],
  ['sim-imports-tools.ts', 'warsim/module-boundaries'],
  ['render-imports-sim.ts', 'warsim/module-boundaries'],
  ['shared-imports-sim.ts', 'warsim/module-boundaries'],
  ['ui-imports-worker.ts', 'warsim/module-boundaries'],
  ['ui-literal-string.tsx', 'warsim/no-literal-ui-string'],
];

const mustPass = ['sim-clean.ts', 'worker-imports-sim.ts', 'app-uses-browser.ts', 'ui-translated.tsx'];

describe('ESLint sim purity and module boundaries (SPEC §2.1)', () => {
  it.each(mustFail)('%s fails with %s', async (name, rule) => {
    expect(await lintFixture(name)).toContain(rule);
  });

  it.each(mustPass)('%s is clean', async (name) => {
    expect(await lintFixture(name)).toEqual([]);
  });

  it('every literal in the UI fixture is reported (JSX text, title, aria-label, string child)', async () => {
    const rules = await lintFixture('ui-literal-string.tsx');
    expect(rules.filter((r) => r === 'warsim/no-literal-ui-string')).toHaveLength(4);
  });

  it('Math.atan2 and Math.sin are both reported', async () => {
    const rules = await lintFixture('sim-math-trig.ts');
    expect(rules.filter((r) => r === 'no-restricted-properties')).toHaveLength(2);
  });
});
