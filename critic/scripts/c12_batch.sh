#!/bin/sh
# Critic run 12: 30-year unaided worlds; run 11's 24 seeds (same-seed compare with c11_ files on dd3b730) + 8 new seeds.
# 8 at a time (memory).
cd /c/Git/WarSim
run() { s=$1; npx tsx critic/scripts/c12_headless.ts $s 30 critic/c12_headless_$s.json 20 critic/c12_seed${s}_y20.bin > critic/c12_headless_$s.log 2>&1; }
wave() { for s in "$@"; do run $s & done; wait; }
wave 1129 2081 6421 7019 4877 9437 1307 8693
wave 2347 3491 4513 5683 6151 7247 8011 8849
wave 9781 2953 3613 4219 5309 5861 7583 8167
wave 1523 2671 3847 4391 5147 6737 7901 9203
echo ALLDONE > critic/c12_batch.done
