#!/bin/sh
# Critic run 17: 30-year unaided worlds on HEAD (cfedb50a): run 16's 64 seeds (compare with c16_ files on 7b883084)
# + 8 new seeds, also on 7b883084 in critic/wt as c17o_.
cd /c/Git/WarSim
run() { s=$1; npx tsx critic/scripts/c17_headless.ts $s 30 critic/c17_headless_$s.json 20 critic/c17_seed${s}_y20.bin > critic/c17_headless_$s.log 2>&1; }
runo() { s=$1; (cd /c/Git/WarSim/critic/wt && npx tsx critic/scripts/c17_headless.ts $s 30 /c/Git/WarSim/critic/c17o_headless_$s.json 20 /c/Git/WarSim/critic/c17o_seed${s}_y20.bin > /c/Git/WarSim/critic/c17o_headless_$s.log 2>&1); }
wave() { for s in "$@"; do run $s & done; wait; }
wave 1607 2213 3727 4493 5419 6301 7129 8273
for s in 1607 2213 3727 4493 5419 6301 7129 8273; do runo $s & done; wait
wave 1129 2081 6421 7019 4877 9437 1307 8167
wave 1259 2789 3571 4801 5653 6703 7789 8933
wave 2347 3491 4513 5683 6151 7247 8011 8849
wave 9781 2953 3613 4219 5309 5861 7583 8693
wave 1523 2671 3847 4391 5147 6737 7901 9203
wave 1061 2417 3253 4561 5521 6833 7351 8423
wave 1187 2539 3359 4673 5651 6967 7411 8539
wave 1213 2633 3467 4789 5531 6659 7723 8861
echo ALLDONE > critic/c17_batch.done
