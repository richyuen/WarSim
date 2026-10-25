#!/bin/sh
# Critic run 14: 30-year unaided worlds; run 13's 40 seeds (same-seed compare with c13_ files on 0c80db1) + 8 new seeds.
cd /c/Git/WarSim
run() { s=$1; npx tsx critic/scripts/c14_headless.ts $s 30 critic/c14_headless_$s.json 20 critic/c14_seed${s}_y20.bin > critic/c14_headless_$s.log 2>&1; }
wave() { for s in "$@"; do run $s & done; wait; }
wave 1129 2081 6421 7019 4877 9437 1307 8693
wave 2347 3491 4513 5683 6151 7247 8011 8849
wave 9781 2953 3613 4219 5309 5861 7583 8167
wave 1523 2671 3847 4391 5147 6737 7901 9203
wave 1061 2417 3253 4561 5521 6833 7351 8423
wave 1187 2539 3359 4673 5651 6967 7411 8539
echo ALLDONE > critic/c14_batch.done
