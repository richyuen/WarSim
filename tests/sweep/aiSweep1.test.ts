import { it } from 'vitest';
import { aiSweep } from '../helpers/aiSweep';

// PLAN 1.24 AT (seed 1 of 3): ten 1938 years produce ≥ 3 wars, ≥ 1 peace, ≥ 1 alliance change.
it('10-year strategic AI run, seed 1', () => aiSweep(1), 600_000);
