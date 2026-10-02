import { it } from 'vitest';
import { aiSweep } from '../helpers/aiSweep';

// PLAN 1.24 AT (seed 3 of 3): ten 1938 years produce ≥ 3 wars, ≥ 1 peace, ≥ 1 alliance change.
it('10-year strategic AI run, seed 3', () => aiSweep(3), 600_000);
