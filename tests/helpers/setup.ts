import { keepWorldTemplates } from '../../src/sim/scenario1938';

// The unit tests' setup (vitest.config.ts). A 1938 world takes 2.2 s to build and the unit tests
// build some 900: each file builds the first, and the next are made from its state (ADR-279).
if (process.env['NOTEMPLATES'] === undefined) keepWorldTemplates();
