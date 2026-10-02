import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { GoldenCase } from '../unit/dmath-golden';

// ADR-5 / PLAN 0.9: dmath must give bit-identical results in Chromium and Node.
// The module is transpiled (types stripped only, no downlevelling) and imported into the
// page from a data: URL, so the browser's own JS engine evaluates exactly our source.
const root = path.resolve(import.meta.dirname, '../..');
const golden = JSON.parse(readFileSync(path.join(root, 'tests/unit/dmath-golden.json'), 'utf8')) as GoldenCase[];

function transpile(file: string): string {
  const src = readFileSync(path.join(root, file), 'utf8');
  return ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
}

test('dmath golden bit patterns match in Chromium', async ({ page }) => {
  await page.goto('/?paused=1&view=0');
  const dmathJs = transpile('src/sim/core/dmath.ts');
  const goldenJs = transpile('tests/unit/dmath-golden.ts');
  const mismatches = await page.evaluate(
    async ({ dmathJs, goldenJs, golden }) => {
      const url = (code: string): string => `data:text/javascript;base64,${btoa(unescape(encodeURIComponent(code)))}`;
      const dm = (await import(/* @vite-ignore */ url(dmathJs))) as Record<string, (...a: number[]) => number>;
      const g = (await import(/* @vite-ignore */ url(goldenJs))) as {
        evalGolden: (d: unknown, c: { fn: string; args: string[]; bits: string }) => string;
      };
      return golden
        .map((c) => ({ ...c, got: g.evalGolden(dm, c) }))
        .filter((c) => c.got !== c.bits);
    },
    { dmathJs, goldenJs, golden },
  );
  expect(golden.length).toBeGreaterThan(100);
  expect(mismatches).toEqual([]);
});
