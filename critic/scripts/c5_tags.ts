import { writeFileSync } from 'node:fs';
import { NATIONS_1938 } from '../../src/sim/scenario1938';
writeFileSync('critic/c5_tags.json', JSON.stringify(Object.fromEntries(NATIONS_1938.map((n, i) => [n.tag, i + 1]))));
