// `npm run parity` validates docs/PARITY.md; `npm run parity -- --write` regenerates the header score.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { checkParity, writeScore } from './parity';

const root = path.resolve(import.meta.dirname, '../..');
const file = path.join(root, 'docs/PARITY.md');
const exists = (p: string): boolean => existsSync(path.resolve(root, p));

let text = readFileSync(file, 'utf8');
let result = checkParity(text, exists);
if (process.argv.includes('--write')) {
  text = writeScore(text, result.counts);
  writeFileSync(file, text);
  result = checkParity(text, exists);
}

const { counts, score, table2 } = result;
console.log(
  `parity: ${score.toFixed(1)}% (verified ${counts.verified}, partial ${counts.partial}, ` +
    `not started ${counts.notStarted}, total ${counts.total}; additions ${table2.length})`,
);
if (result.errors.length > 0) {
  for (const e of result.errors) console.error(`  x ${e}`);
  process.exit(1);
}
