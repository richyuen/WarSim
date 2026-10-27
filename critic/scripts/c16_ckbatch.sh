#!/bin/sh
# Critic run 16: checkpoint reads on HEAD's saves (engaged 7 days at y10/y20, pieces and hollow divisions at y20, navy),
# the 8 new seeds' 7739a78 saves in critic/wt, and the navy census of run 15's saves (7739a78) in critic/wt.
cd /c/Git/WarSim
until [ -f critic/c16_batch.done ]; do sleep 20; done
grp() { i=$1; shift; a=""; b=""; for s in "$@"; do a="$a $s:critic/c16_seed${s}_y10.bin $s:critic/c16_seed${s}_y20.bin"; b="$b $s:critic/c16_seed${s}_y20.bin"; done
  OUT=critic/c16_engaged_w$i.json npx tsx critic/scripts/c16_engaged.ts $a > critic/c16_engaged_w$i.log 2>&1
  OUT=critic/c16_frag2_w$i.json npx tsx critic/scripts/c16_frag2.ts $b > critic/c16_frag2_w$i.log 2>&1
  OUT=critic/c16_hollow_w$i.json npx tsx critic/scripts/c16_hollow.ts $b > critic/c16_hollow_w$i.log 2>&1
  OUT=critic/c16_navy_w$i.json npx tsx critic/scripts/c16_navy.ts $a > critic/c16_navy_w$i.log 2>&1; }
grp 1 1129 2081 6421 7019 4877 9437 1307 8167 &
grp 2 2347 3491 4513 5683 6151 7247 8011 8849 &
grp 3 9781 2953 3613 4219 5309 5861 7583 8693 &
grp 4 1523 2671 3847 4391 5147 6737 7901 9203 &
grp 5 1061 2417 3253 4561 5521 6833 7351 8423 &
grp 6 1187 2539 3359 4673 5651 6967 7411 8539 &
grp 7 1213 2633 3467 4789 5531 6659 7723 8861 &
grp 8 1259 2789 3571 4801 5653 6703 7789 8933 &
wait
cd critic/wt
a=""; b=""; for s in 1259 2789 3571 4801 5653 6703 7789 8933; do a="$a $s:../c16o_seed${s}_y10.bin $s:../c16o_seed${s}_y20.bin"; b="$b $s:../c16o_seed${s}_y20.bin"; done
OUT=../c16o_engaged.json npx tsx critic/scripts/c16_engaged.ts $a > ../c16o_engaged.log 2>&1 &
OUT=../c16o_frag2.json npx tsx critic/scripts/c16_frag2.ts $b > ../c16o_frag2.log 2>&1 &
OUT=../c16o_hollow.json npx tsx critic/scripts/c16_hollow.ts $b > ../c16o_hollow.log 2>&1 &
OUT=../c16o_navy.json npx tsx critic/scripts/c16_navy.ts $a > ../c16o_navy.log 2>&1 &
ngrp() { i=$1; shift; a=""; for s in "$@"; do a="$a $s:../c15_seed${s}_y10.bin $s:../c15_seed${s}_y20.bin"; done; OUT=../c15n_navy_w$i.json npx tsx critic/scripts/c16_navy.ts $a > ../c15n_navy_w$i.log 2>&1; }
ngrp 1 1129 2081 6421 7019 4877 9437 1307 8167 &
ngrp 2 2347 3491 4513 5683 6151 7247 8011 8849 &
ngrp 3 9781 2953 3613 4219 5309 5861 7583 8693 &
ngrp 4 1523 2671 3847 4391 5147 6737 7901 9203 &
wait
ngrp 5 1061 2417 3253 4561 5521 6833 7351 8423 &
ngrp 6 1187 2539 3359 4673 5651 6967 7411 8539 &
ngrp 7 1213 2633 3467 4789 5531 6659 7723 8861 &
wait
echo done > /c/Git/WarSim/critic/c16_ck.done
