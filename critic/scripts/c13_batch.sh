#!/bin/sh
# Critic run 13: 30-year unaided worlds; run 12's 32 seeds (same-seed compare with c12_ files on 896ff77) + 8 new seeds.
cd /c/Git/WarSim
run() { s=$1; npx tsx critic/scripts/c13_headless.ts $s 30 critic/c13_headless_$s.json 20 critic/c13_seed${s}_y20.bin > critic/c13_headless_$s.log 2>&1; }
wave() { for s in "$@"; do run $s & done; wait; }
wave 1129 2081 6421 7019 4877 9437 1307 8693
wave 2347 3491 4513 5683 6151 7247 8011 8849
wave 9781 2953 3613 4219 5309 5861 7583 8167
wave 1523 2671 3847 4391 5147 6737 7901 9203
wave 1061 2417 3253 4561 5521 6833 7351 8423
echo ALLDONE > critic/c13_batch.done
