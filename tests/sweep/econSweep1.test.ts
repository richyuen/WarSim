import { it } from 'vitest';
import { econSweep } from '../helpers/econSweep';

// PLAN 1.26 AT (seed 1 of 3): no AI nation goes bankrupt in 10 peaceful years.
it('10 peaceful years without bankruptcy, seed 1', () => econSweep(1), 900_000);
