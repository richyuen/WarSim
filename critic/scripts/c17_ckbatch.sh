#!/bin/sh
# Critic run 17: checkpoint reads on HEAD's y10/y20 saves (engaged 7 days, navy census by class).
cd /c/Git/WarSim
grp() { i=$1; shift; a=""; for s in "$@"; do a="$a $s:critic/c17_seed${s}_y10.bin $s:critic/c17_seed${s}_y20.bin"; done
  OUT=critic/c17_engaged_w$i.json npx tsx critic/scripts/c17_engaged.ts $a > critic/c17_engaged_w$i.log 2>&1
  OUT=critic/c17_navy_w$i.json npx tsx critic/scripts/c17_navy.ts $a > critic/c17_navy_w$i.log 2>&1; }
grp 1 1129 2081 6421 7019 4877 9437 1307 8167 1259 2789 3571 4801 5653 6703 7789 8933 &
grp 2 2347 3491 4513 5683 6151 7247 8011 8849 9781 2953 3613 4219 5309 5861 7583 8693 &
grp 3 1523 2671 3847 4391 5147 6737 7901 9203 1061 2417 3253 4561 5521 6833 7351 8423 &
grp 4 1187 2539 3359 4673 5651 6967 7411 8539 1213 2633 3467 4789 5531 6659 7723 8861 &
wait
echo done > critic/c17_ck.done
