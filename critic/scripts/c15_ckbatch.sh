#!/bin/sh
# Critic run 15: checkpoint reads (engaged over 7 days at y10/y20; pieces and hollow divisions at y20) on HEAD's saves,
# and on 311988d's saves of the 8 new seeds (in critic/wt).
cd /c/Git/WarSim
until [ -f critic/c15_batch.done ]; do sleep 20; done
grp() { i=$1; shift; a=""; b=""; for s in "$@"; do a="$a $s:critic/c15_seed${s}_y10.bin $s:critic/c15_seed${s}_y20.bin"; b="$b $s:critic/c15_seed${s}_y20.bin"; done
  OUT=critic/c15_engaged_w$i.json npx tsx critic/scripts/c15_engaged.ts $a > critic/c15_engaged_w$i.log 2>&1
  OUT=critic/c15_frag2_w$i.json npx tsx critic/scripts/c15_frag2.ts $b > critic/c15_frag2_w$i.log 2>&1
  OUT=critic/c15_hollow_w$i.json npx tsx critic/scripts/c15_hollow.ts $b > critic/c15_hollow_w$i.log 2>&1; }
grp 1 1129 2081 6421 7019 4877 9437 1307 8167 &
grp 2 2347 3491 4513 5683 6151 7247 8011 8849 &
grp 3 9781 2953 3613 4219 5309 5861 7583 8693 &
grp 4 1523 2671 3847 4391 5147 6737 7901 9203 &
grp 5 1061 2417 3253 4561 5521 6833 7351 8423 &
grp 6 1187 2539 3359 4673 5651 6967 7411 8539 &
grp 7 1213 2633 3467 4789 5531 6659 7723 8861 &
wait
until [ -f critic/c15o_batch.done ]; do sleep 20; done
cd critic/wt
a=""; b=""; for s in 1213 2633 3467 4789 5531 6659 7723 8861; do a="$a $s:../c15o_seed${s}_y10.bin $s:../c15o_seed${s}_y20.bin"; b="$b $s:../c15o_seed${s}_y20.bin"; done
cp ../scripts/c15_engaged.ts ../scripts/c15_frag2.ts ../scripts/c15_hollow.ts critic/scripts/
OUT=../c15o_engaged.json npx tsx critic/scripts/c15_engaged.ts $a > ../c15o_engaged.log 2>&1 &
OUT=../c15o_frag2.json npx tsx critic/scripts/c15_frag2.ts $b > ../c15o_frag2.log 2>&1 &
OUT=../c15o_hollow.json npx tsx critic/scripts/c15_hollow.ts $b > ../c15o_hollow.log 2>&1 &
wait
echo done > /c/Git/WarSim/critic/c15_ck.done
