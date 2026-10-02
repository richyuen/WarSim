#!/usr/bin/env bash
# Re-runs the acceptance test (AT) of every Phase 0 PLAN task at HEAD and prints a result table.
# Usage: bash tools/verify-phase0.sh   (assumes `npm run build` artefacts are current)
cd "$(dirname "$0")/.." || exit 1
pass=0; fail=0
row() { # id, description, command
  if bash -c "$3" > /dev/null 2>&1; then echo "| $1 | $2 | PASS |"; pass=$((pass+1)); else echo "| $1 | $2 | FAIL |"; fail=$((fail+1)); fi
}
echo "| task | acceptance test | result |"
echo "|---|---|---|"
row 0.1 "reference/ ignored and never tracked" "git check-ignore -q reference/screens && [ -z \"\$(git ls-files reference)\" ]"
row 0.2 "build succeeds; built page has a canvas and title WarSim" "npm run build && grep -q '<title>WarSim</title>' dist/index.html && grep -q 'canvas id=\"map\"' dist/index.html"
row 0.3 "sim purity / module-boundary fixtures fail lint" "npx vitest run tests/unit/lint-rules.test.ts"
row 0.4 "npm run check script exists; Playwright smoke finds the canvas" "grep -q '\"check\"' package.json && npx playwright test tests/e2e/smoke.spec.ts"
row 0.5 "BLOCKERS/DATA_SOURCES exist; PROGRESS dated; NOTES.md-missing noted" "[ -f BLOCKERS.md ] && [ -f DATA_SOURCES.md ] && grep -q '^## 2026-' PROGRESS.md && grep -q 'NOTES.md' PROGRESS.md"
row 0.6 "reference/frames has >= 30 PNGs; VISUAL observations logged" "[ \$(ls reference/frames/*.png | wc -l) -ge 30 ] && grep -q 'VISUAL, 2026-10-02' PROGRESS.md"
row 0.7 "PARITY Table 1 rows all source-tagged and dated" "npm run parity"
row 0.8 "parity checker fixtures (header mismatch / missing evidence fail)" "npx vitest run tests/unit/parity.test.ts"
row 0.9 "dmath accuracy + golden bits in Node and Chromium" "npx vitest run tests/unit/dmath.test.ts && npx playwright test tests/e2e/dmath.spec.ts"
row 0.10 "PCG32/xxHash known-answer vectors; stream independence" "npx vitest run tests/unit/rng-hash.test.ts"
row 0.11 "table round trip identical bytes; hash changes on 1-byte mutation" "npx vitest run tests/unit/table.test.ts"
row 0.12 "invariants I1, I2, I5 (Node) and I3 (Node == worker)" "npx vitest run tests/unit/determinism.test.ts && npx playwright test tests/e2e/worker.spec.ts"
row 0.13 "I4, no snapshot without ack, pool stable over 10k frames" "npx vitest run tests/unit/server.test.ts && npx playwright test tests/e2e/snapshots.spec.ts"
row 0.14 "bench A JSON with T0 numbers; 3-zoom screenshots exist" "[ -f docs/bench/A-webgl2-map.json ] && ls docs/bench/A-webgl2-map-z0-world.png docs/bench/A-webgl2-map-z1-region.png docs/bench/A-webgl2-map-z2-close.png && npx playwright test tests/e2e/bench-pages.spec.ts"
row 0.15 "bench JSON for both stacks; ADR-4 accepted" "[ -f docs/bench/B-webgl2-proxies.json ] && [ -f docs/bench/BP-pixi-proxies.json ] && grep -q 'ADR-4 · 2026-10-02 · accepted' DECISIONS.md"
row 0.16 "sprite jitter <= 0.5 px at 1 m/px near lon 179" "npx playwright test tests/e2e/precision.spec.ts"
row 0.17 "camera keys/drag/wheel/pinch + seamless dateline wrap" "npx vitest run tests/unit/camera.test.ts && npx playwright test tests/e2e/camera.spec.ts"
row 0.18 "npm run data idempotent (--check); manifest verified by test" "npm run data -- --check && npx vitest run tests/unit/data-manifest.test.ts"
row 0.19 "M raster < 1.5 s in Chromium; every province present; == Node" "npx vitest run tests/unit/provinces.test.ts && npx playwright test tests/e2e/provinces.spec.ts"
row 0.20 "toy world 10 years writes metrics with tick ms" "npm run sim -- --years 10 --out .cache/runs/verify.json && grep -q '\"tickMs\"' .cache/runs/verify.json"
row 0.21 "literal UI string fixture fails lint; UI renders en.json" "npx vitest run tests/unit/lint-rules.test.ts tests/unit/i18n.test.ts && npx playwright test tests/e2e/i18n.spec.ts"
row 0.22 "gate green; ADR-4 final" "npm run check && grep -q 'ADR-4 · 2026-10-02 · accepted' DECISIONS.md"
echo
echo "pass $pass, fail $fail"
[ "$fail" -eq 0 ]
