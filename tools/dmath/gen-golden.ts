// Regenerates tests/unit/dmath-golden.json from the current dmath implementation.
// Run only when dmath changes intentionally (`npx tsx tools/dmath/gen-golden.ts`): the
// file pins exact bits so any engine or code drift fails in Node and Chromium.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import * as dm from '../../src/sim/core/dmath';
import { evalGolden, toBits, type DmathLike, type GoldenCase } from '../../tests/unit/dmath-golden';

const angles = [
  0.1, -0.5, 0.7853981633974483, 1, 1.5707963267948966, 2, 3.141592653589793, -3.14159, 4.71238898038469,
  6.283185307179586, 10, -100.25, 12345.678, -987654.321, 1e-10, 355,
];
const unit = [-1, -0.999, -0.5, -1e-9, 0, 0.3, 0.70710678118654757, 0.9999999, 1];
const reals = [-1e10, -1000, -2.4375, -1.1875, -0.6875, -0.4375, -1e-20, 0.25, 0.5, 0.9, 1.5, 3, 7.5, 1e5, 1e20, 1e300];
const expIn = [-745, -740, -708.5, -20, -1, -0.3, -1e-12, 1e-30, 0.3465, 0.5, 1, 1.0397, 2.5, 30, 300, 709.7];
const logIn = [5e-324, 1e-310, 1e-100, 0.001, 0.5, 0.7071, 0.999999, 1.000001, 1.5, 2, 2.718281828459045, 10, 1e10, 1e300];
const pow2In: [number, number][] = [
  [2, 0.5], [10, -3], [1.0001, 10000], [0.5, 100.5], [123.456, 2.2], [7, 1 / 3], [1e-3, 2.5], [1e3, -2.5],
  [-2, 3], [-2, -65], [3, 64], [0.9, 1000], [2, -1074], [9, 0.5],
];
const atan2In: [number, number][] = [
  [1, 1], [1, -1], [-1, -1], [-1, 1], [0, -1], [-0, -1], [3, 4], [-3, -4], [1e-300, 1e300], [1e300, 1e-300],
  [5, -1e-25], [0.5, 2],
];

const cases: GoldenCase[] = [];
const add = (fn: string, args: number[]): void => {
  const g: GoldenCase = { fn, args: args.map(toBits), bits: '' };
  g.bits = evalGolden(dm as unknown as DmathLike, g);
  cases.push(g);
};
for (const x of angles) {
  add('sin', [x]);
  add('cos', [x]);
  add('tan', [x]);
}
for (const x of reals) add('atan', [x]);
for (const x of unit) {
  add('asin', [x]);
  add('acos', [x]);
}
for (const x of expIn) add('exp', [x]);
for (const x of logIn) add('log', [x]);
for (const [x, y] of pow2In) add('pow', [x, y]);
for (const [y, x] of atan2In) add('atan2', [y, x]);

const out = path.resolve(import.meta.dirname, '../../tests/unit/dmath-golden.json');
writeFileSync(out, `${JSON.stringify(cases, null, 0).replace(/\},\{/g, '},\n{')}\n`);
console.log(`wrote ${cases.length} golden cases to ${out}`);
