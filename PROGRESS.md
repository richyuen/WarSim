# PROGRESS (append-only)

## 2026-10-02 — PLAN 0.2: Vite + TypeScript strict + Preact
- Scaffolded `package.json` (scripts `dev`, `build` = `tsc -b && vite build`, `preview`, `typecheck`),
  `index.html` (title "WarSim", `#map` canvas + `#ui` overlay), `src/app/{main.tsx,App.tsx,style.css}`.
- Toolchain resolved to: Vite 8.3, TypeScript 7.0 (`tsc -b` works unchanged), Preact 11, @preact/signals 2.11,
  @preact/preset-vite 2.10, Node 24.21.
- tsconfig: solution-style (`tsconfig.app.json` for `src/`, `tsconfig.node.json` for `vite.config.ts`, shared
  `tsconfig.base.json`) with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, unused-locals/params checks. Verified that the flags apply: a probe file indexing
  `number[]` into `number` fails `tsc -b` with TS2322.
- Vite `base: './'` so the build runs from any static-host subpath; workers emit as ES modules.
- Verified: `npm run build` green; `vite preview` serves `index.html` with `<title>WarSim</title>` and the
  canvas; JS asset returns 200; headless Chrome `--dump-dom` shows the canvas resized by the script
  (764×485), so the bundle executes without errors.
- Gotcha: `npm run parity` does not exist yet (PLAN 0.8); PARITY.md is created in 0.7. No critic report yet.
- PROGRESS.md was created here (ahead of 0.5) because every iteration must log; 0.5 still owns
  BLOCKERS.md / DATA_SOURCES.md and the `reference/NOTES.md`-missing note.

## 2026-10-02 — PLAN 0.3: ESLint flat config + sim purity + module boundaries
- ESLint 10.11 + typescript-eslint 8.71 (recommended, non-type-checked) + `globals`; `npm run lint`, `npm test`
  (vitest 5.0.3, installed now because the AT needs it; 0.4 still owns Playwright and `npm run check`).
- TypeScript downgraded 7.0.2 → 6.0.3: TS 7 has no JS API, typescript-eslint needs `<6.1` (ADR-12).
- `tools/eslint/warsim-plugin.js`: `warsim/module-boundaries` (layer table + sim/shared package allowlist,
  lexical resolution). SPEC §2.1 table updated (app may import editor; ui/editor/app rows split).
- Sim rules: forbidden globals (Date, performance, window, self, timers, Intl, WeakRef, ...), `Math.random` +
  non-exact `Math.*`, `localeCompare`/`toLocaleString`, `for-in`, `**`, Math destructuring/computed access.
- `tests/lint-fixtures/` (ignored by `eslint .` and tsc) linted via the ESLint API at virtual `src/<layer>/` paths:
  16 must-fail + 3 must-pass cases, 20 tests green. Also checked the CLI: a real `src/sim/probe.ts` with
  `Math.random() ** 2` fails `eslint src` with exit 1 (probe deleted).
- `tsconfig.node.json` now type-checks `tools/`, `tests/unit/`, `vitest.config.ts`, `eslint.config.js` (checkJs).
- Gotcha: no-undef is off for TS files (typescript-eslint), but `no-restricted-globals` still reports implicit
  global references, so `window` in sim is caught even though the app tsconfig includes DOM libs.

## 2026-10-02 — PLAN 0.4: Playwright + `npm run check`
- `@playwright/test` 1.63 (Chromium already in the local ms-playwright cache). `playwright.config.ts` runs
  `tests/e2e` against `vite preview` of a fresh build on 127.0.0.1:4173 (tests see what ships).
- `tests/e2e/smoke.spec.ts`: title "WarSim", visible `canvas#map` with a non-trivial backing size, and zero
  page errors / console errors (catches bundle crashes, not just DOM presence).
- Scripts: `e2e` = `playwright test`; `check` = typecheck → lint → vitest → build → e2e. Parity joins `check`
  in PLAN 0.8 (the script does not exist yet). SPEC §10 documents the gate.
- `tsconfig.node.json` now covers `playwright.config.ts` + `tests/e2e` and adds the DOM lib (for
  `evaluate` callbacks); `src/sim` is type-checked by the app config, so this doesn't loosen sim purity.
- Verified: `npm run check` green (tsc, eslint, 20 vitest, build, 1 e2e).
